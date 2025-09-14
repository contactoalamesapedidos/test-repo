const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth, requireDriver } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { sendNotificationToUser } = require('./push');

// Multer config for receipt uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/comprobantes_drivers/')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

// RUTA PÚBLICA PARA REGISTRO DE REPARTIDORES (GET)
router.get('/registro', async (req, res) => {
    try {
        const [restaurantes] = await db.execute('SELECT id, nombre FROM restaurantes WHERE activo = 1 ORDER BY nombre');
        res.render('drivers/register', {
            title: 'Registro de Repartidor - A la Mesa',
            user: req.session.user,
            restaurantes: restaurantes,
            path: '/repartidores/registro',
            activePage: 'driver-register'
        });
    } catch (error) {
        console.error('Error al obtener la lista de restaurantes para el registro:', error);
        res.status(500).render('error', { message: 'No se pudo cargar la página de registro.' });
    }
});

// RUTA PÚBLICA PARA PROCESAR EL REGISTRO (POST)
router.post('/registro', async (req, res) => {
    const { nombre, apellido, email, password, telefono, tipo_afiliacion, restaurante_id } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Verificar si el email ya existe
        const [users] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (users.length > 0) {
            return res.status(400).send('El correo electrónico ya está en uso.');
        }

        // 2. Hashear contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Crear nuevo usuario
        const [result] = await connection.execute(
            'INSERT INTO usuarios (nombre, apellido, email, password, telefono, tipo_usuario) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, apellido, email, hashedPassword, telefono, 'repartidor']
        );
        const nuevoUsuarioId = result.insertId;

        // 4. Crear nuevo registro en la tabla `drivers`
        const idRestaurante = (tipo_afiliacion === 'restaurante') ? restaurante_id : null;

        await connection.execute(
            'INSERT INTO drivers (user_id, restaurante_id, request_status) VALUES (?, ?, ?)',
            [nuevoUsuarioId, idRestaurante, 'pending']
        );

        await connection.commit();

        res.redirect('/auth/login?mensaje=registro-exitoso');

    } catch (error) {
        await connection.rollback();
        console.error('Error en el registro de repartidor:', error);
        res.status(500).render('error', { message: 'Ocurrió un error durante el registro.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Middleware para obtener el conteo de pedidos asignados (si aplica)
async function getAssignedOrdersCount(req, res, next) {
    if (req.session.user && req.session.user.tipo_usuario === 'repartidor') {
        try {
            const userId = req.session.user.id;
            // Obtener el driver_id correcto
            const [driverResult] = await db.execute('SELECT id FROM drivers WHERE user_id = ?', [userId]);
            if (driverResult.length > 0) {
                const driverId = driverResult[0].id;
                const [[{ assigned_orders }]] = await db.execute(`
                    SELECT COUNT(*) as assigned_orders
                    FROM pedidos
                    WHERE repartidor_id = ? AND estado IN ('confirmado', 'preparando', 'listo', 'en_camino')
                `, [driverId]);
                res.locals.assignedOrders = assigned_orders || 0;
            } else {
                res.locals.assignedOrders = 0;
            }
        } catch (error) {
            console.error('Error obteniendo conteo de pedidos asignados:', error);
            res.locals.assignedOrders = 0;
        }
    }
    next();
}

// Aplicar middleware globalmente para todas las rutas de repartidores
router.use(requireAuth, requireDriver, getAssignedOrdersCount);

// Ruta para estadísticas detalladas
router.get('/estadisticas', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [users] = await db.execute(
            `SELECT u.id, u.nombre, u.apellido, u.email, u.telefono,
                    d.id as driver_id, d.vehicle_type, d.status, d.request_status, d.current_latitude, d.current_longitude,
                    r.nombre as restaurante_nombre
             FROM usuarios u
             JOIN drivers d ON u.id = d.user_id
             LEFT JOIN restaurantes r ON d.restaurante_id = r.id
             WHERE u.id = ?`,
            [userId]
        );

        if (users.length === 0) {
            req.session.destroy(() => {
                res.redirect('/auth/login?error=Usuario no encontrado');
            });
            return;
        }
        const driver = users[0];
        const driverId = driver.driver_id;

        // Obtener estadísticas usando driverId correcto
        const today = new Date().toISOString().slice(0, 10);
        const [[{ pedidosHoy }]] = await db.execute('SELECT COUNT(*) as pedidosHoy FROM pedidos WHERE repartidor_id = ? AND DATE(fecha_pedido) = ? AND estado = \'entregado\'', [driverId, today]);
        const [[{ gananciasHoy }]] = await db.execute('SELECT SUM(monto) as gananciasHoy FROM comisiones WHERE repartidor_id = ? AND DATE(fecha_creacion) = ?', [driverId, today]);
        const [[{ totalEntregas }]] = await db.execute('SELECT COUNT(*) as total FROM pedidos WHERE repartidor_id = ? AND estado = \'entregado\'', [driverId]);
        const [[{ reputacion }]] = await db.execute('SELECT AVG(calificacion_repartidor) as reputacion FROM calificaciones WHERE repartidor_id = ?', [driverId]);

        // Calcular ganancias totales (entregas × $200)
        const gananciasTotales = (totalEntregas || 0) * 200;

        const [repartidores] = await db.execute('SELECT u.id, u.nombre, u.apellido, COUNT(p.id) as total_entregas FROM usuarios u JOIN drivers d ON u.id = d.user_id JOIN pedidos p ON d.id = p.repartidor_id WHERE u.tipo_usuario = ? AND p.estado = ? GROUP BY u.id ORDER BY total_entregas DESC', ['repartidor', 'entregado']);
        const ranking = repartidores.findIndex(r => r.id === userId) + 1;

        const [distanciaTotal] = await db.execute('SELECT SUM(distancia) as distancia_total FROM pedidos WHERE repartidor_id = ? AND estado = ?', [driverId, 'entregado']);

        const [entregasSemanales] = await db.execute("SELECT DAYOFWEEK(fecha_pedido) as dia, COUNT(*) as entregas FROM pedidos WHERE repartidor_id = ? AND estado = 'entregado' AND fecha_pedido >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY dia", [driverId]);

        const stats = {
            pedidosHoy: pedidosHoy || 0,
            gananciasHoy: parseFloat(gananciasHoy) || 0,
            totalEntregas: totalEntregas || 0,
            reputacion: reputacion || 5.0,
            ranking: ranking || 'N/A',
            distanciaTotal: distanciaTotal[0].distancia_total || 0,
            entregasSemanales: entregasSemanales || []
        };

        res.render('drivers/estadisticas', {
            title: 'Estadísticas - A la Mesa',
            user: req.session.user,
            driver,
            stats,
            gananciasTotales,
            path: req.path,
            activePage: 'estadisticas'
        });
    } catch (error) {
        console.error('Error en estadísticas de repartidor:', error);
        res.render('error', {
            title: 'Error',
            message: 'Error cargando las estadísticas del repartidor',
            error: {}
        });
    }
});

// Dashboard Principal para Repartidores
router.get('/', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [users] = await db.execute(
            `SELECT u.id, u.nombre, u.apellido, u.email, u.telefono,
                    d.id as driver_id, d.vehicle_type, d.status, d.request_status, d.current_latitude, d.current_longitude,
                    r.nombre as restaurante_nombre
             FROM usuarios u
             JOIN drivers d ON u.id = d.user_id
             LEFT JOIN restaurantes r ON d.restaurante_id = r.id
             WHERE u.id = ?`,
            [userId]
        );

        if (users.length === 0) {
            req.session.destroy(() => {
                res.redirect('/auth/login?error=Usuario no encontrado');
            });
            return;
        }
        const driver = users[0];
        const driverId = driver.driver_id; // ID correcto de la tabla drivers

        // Obtener pedidos asignados al repartidor usando el driver_id correcto
        const [pedidos] = await db.execute(`
            SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido,
                   r.nombre as restaurante_nombre, r.direccion as restaurante_direccion,
                   r.imagen_logo as restaurante_logo,
                   r.latitud as restaurante_lat, r.longitud as restaurante_lng,
                   p.latitud_entrega as cliente_lat, p.longitud_entrega as cliente_lng
            FROM pedidos p
            JOIN usuarios u ON p.cliente_id = u.id
            JOIN restaurantes r ON p.restaurante_id = r.id
            WHERE p.repartidor_id = ? AND p.estado IN ('preparando', 'en_camino') ORDER BY p.fecha_pedido ASC
        `, [driverId]);

        console.log('📊 Dashboard repartidor - Coordenadas actuales:', {
            driverId: driver.driver_id,
            current_latitude: driver.current_latitude,
            current_longitude: driver.current_longitude,
            pedidosCount: pedidos.length
        });

        // Verificar y asegurar que las coordenadas estén disponibles
        pedidos.forEach(pedido => {
            // Si no hay coordenadas de entrega, intentar usar coordenadas del restaurante como fallback
            if ((!pedido.cliente_lat || !pedido.cliente_lng) && pedido.restaurante_lat && pedido.restaurante_lng) {
                // Usando coordenadas del restaurante como fallback para cliente
                pedido.cliente_lat = pedido.restaurante_lat;
                pedido.cliente_lng = pedido.restaurante_lng;
                pedido.usa_coordenadas_restaurante = true; // Flag para indicar que se usan coordenadas del restaurante
            }
        });

        // Obtener los items de cada pedido
        for (let pedido of pedidos) {
            const [items] = await db.execute(`
                SELECT ip.*, pr.nombre as producto_nombre
                FROM items_pedido ip
                JOIN productos pr ON ip.producto_id = pr.id
                WHERE ip.pedido_id = ?
            `, [pedido.id]);
            pedido.items = items;
        }

        // Obtener estadísticas usando driverId correcto
        const today = new Date().toISOString().slice(0, 10);
        const [[{ pedidosHoy }]] = await db.execute('SELECT COUNT(*) as pedidosHoy FROM pedidos WHERE repartidor_id = ? AND DATE(fecha_pedido) = ? AND estado = \'entregado\'', [driverId, today]);
        const [[{ gananciasHoy }]] = await db.execute('SELECT SUM(monto) as gananciasHoy FROM comisiones WHERE repartidor_id = ? AND DATE(fecha_creacion) = ?', [driverId, today]);
        const [[{ totalEntregas }]] = await db.execute('SELECT COUNT(*) as total FROM pedidos WHERE repartidor_id = ? AND estado = \'entregado\'', [driverId]);
        const [[{ reputacion }]] = await db.execute('SELECT AVG(calificacion_repartidor) as reputacion FROM calificaciones WHERE repartidor_id = ?', [driverId]);

        // Calcular ganancias totales (entregas × $200)
        const gananciasTotales = (totalEntregas || 0) * 200;

        const stats = {
            pedidosHoy: pedidosHoy || 0,
            gananciasHoy: parseFloat(gananciasHoy) || 0,
            totalEntregas: totalEntregas || 0,
            reputacion: reputacion || 5.0
        };

        res.render('drivers/dashboard', {
            title: 'Panel de Repartidor - A la Mesa',
            user: req.session.user,
            driver,
            pedidos,
            stats,
            gananciasTotales,
            assignedOrders: res.locals.assignedOrders,
            path: req.path,
            activePage: 'dashboard'
        });
    } catch (error) {
        console.error('Error en dashboard de repartidor:', error);
        res.render('error', {
            title: 'Error',
            message: 'Error cargando el panel de control del repartidor',
            error: {}
        });
    }
});

// Ruta para el historial de entregas
router.get('/historial', async (req, res) => {
    try {
        const userId = req.session.user.id;
        // Obtener el driver_id correcto
        const [driverResult] = await db.execute('SELECT id FROM drivers WHERE user_id = ?', [userId]);
        if (driverResult.length === 0) {
            return res.status(404).render('error', { message: 'Repartidor no encontrado.' });
        }
        const driverId = driverResult[0].id;

        const [pedidos] = await db.execute(`
            SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido, r.nombre as restaurante_nombre
            FROM pedidos p
            JOIN usuarios u ON p.cliente_id = u.id
            JOIN restaurantes r ON p.restaurante_id = r.id
            WHERE p.repartidor_id = ? AND p.estado = 'entregado'
            ORDER BY p.fecha_pedido DESC
        `, [driverId]);

        res.render('drivers/historial', {
            title: 'Historial de Entregas - A la Mesa',
            user: req.session.user,
            pedidos,
            path: req.path,
            activePage: 'historial'
        });
    } catch (error) {
        console.error('Error en el historial de entregas:', error);
        res.status(500).render('error', { message: 'Error al cargar el historial de entregas.' });
    }
});


router.post('/status', async (req, res) => {
    const connection = await db.getConnection();
    try {
        const userId = req.session.user.id;
        const { status, latitude, longitude } = req.body;

        if (status && !['available', 'offline'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado inválido proporcionado.' });
        }

        let query = 'UPDATE drivers SET';
        const params = [];

        if (status) {
            query += ' status = ?';
            params.push(status);
        }

        if (latitude && longitude) {
            if (status) query += ',';
            query += ' current_latitude = ?, current_longitude = ?';
            params.push(latitude, longitude);
        }

        query += ' WHERE user_id = ?';
        params.push(userId);

        await connection.execute(query, params);

        res.json({ success: true, message: `Estado actualizado.` });
    } catch (error) {
        console.error('Error actualizando estado del repartidor:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar estado.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Ruta para ver comisiones
router.get('/comisiones', async (req, res) => {
    try {
        const userId = req.session.user.id;
        // Obtener el driver_id correcto
        const [driverResult] = await db.execute('SELECT id FROM drivers WHERE user_id = ?', [userId]);
        if (driverResult.length === 0) {
            return res.status(404).render('error', { message: 'Repartidor no encontrado.' });
        }
        const driverId = driverResult[0].id;

        const [comisiones] = await db.execute(
            `SELECT c.*, p.numero_pedido, r.nombre as restaurante_nombre, u.nombre as cliente_nombre
             FROM comisiones c
             JOIN pedidos p ON c.pedido_id = p.id
             JOIN restaurantes r ON p.restaurante_id = r.id
             JOIN usuarios u ON p.cliente_id = u.id
             WHERE c.repartidor_id = ?
             ORDER BY c.fecha_creacion DESC`,
            [driverId]
        );

        const [[{ saldo_pendiente }]] = await db.execute(
            "SELECT SUM(monto) as saldo_pendiente FROM comisiones WHERE repartidor_id = ? AND estado = 'pendiente'",
            [driverId]
        );

        const saldoPendiente = parseFloat(saldo_pendiente) || 0;

        res.render('drivers/comisiones', {
            title: 'Mis Comisiones - A la Mesa',
            user: req.session.user,
            comisiones,
            saldoPendiente: saldoPendiente,
            path: req.path,
            activePage: 'comisiones'
        });
    } catch (error) {
        console.error('Error al obtener comisiones del repartidor:', error);
        res.status(500).render('error', { message: 'Error al cargar la página de comisiones.' });
    }
});

router.post('/comisiones/pagar', upload.single('comprobante'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        const userId = req.session.user.id;
        const comprobante = req.file;

        if (!comprobante) {
            return res.status(400).send('No se subió ningún comprobante.');
        }

        await connection.beginTransaction();

        // Obtener el driver_id correcto
        const [driverResult] = await connection.execute('SELECT id FROM drivers WHERE user_id = ?', [userId]);
        if (driverResult.length === 0) {
            throw new Error('Driver not found');
        }
        const driverId = driverResult[0].id;

        // Calcular saldo pendiente
        const [[{ saldo_pendiente }]] = await connection.execute(
            "SELECT SUM(monto) as saldo_pendiente FROM comisiones WHERE repartidor_id = ? AND estado = 'pendiente'",
            [driverId]
        );

        const saldoPendiente = parseFloat(saldo_pendiente) || 0;

        if (saldoPendiente <= 0) {
            return res.status(400).send('No tienes comisiones pendientes para pagar.');
        }

        // Crear el registro de pago
        await connection.execute(
            'INSERT INTO pagos_comisiones (repartidor_id, monto_total, estado, comprobante_pago) VALUES (?, ?, ?, ?)',
            [driverId, saldoPendiente, 'en_revision', comprobante.path]
        );

        // Actualizar estado de las comisiones a 'en_revision'
        await connection.execute(
            "UPDATE comisiones SET estado = 'en_revision' WHERE repartidor_id = ? AND estado = 'pendiente'",
            [driverId]
        );

        await connection.commit();

        // Notificar al admin
        const adminId = 1; // Asumiendo que el admin tiene id 1
        const notificationData = {
            title: 'Nueva solicitud de pago de comisión',
            body: `El repartidor ${req.session.user.nombre} ${req.session.user.apellido} ha solicitado un pago de comisiones por un total de ${saldoPendiente.toFixed(2)}`,
            url: '/admin/comisiones'
        };
        await sendNotificationToUser(adminId, notificationData);

        res.redirect('/repartidores/comisiones?pago=exitoso');

    } catch (error) {
        await connection.rollback();
        console.error('Error al solicitar pago de comisiones:', error);
        res.status(500).render('error', { message: 'Error al procesar la solicitud de pago.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Ruta para gestionar la disponibilidad
router.get('/disponibilidad', async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Get the driver ID from the drivers table using the user ID
        const [driverResult] = await db.execute(
            'SELECT id FROM drivers WHERE user_id = ?',
            [userId]
        );

        if (driverResult.length === 0) {
            return res.status(404).render('error', { message: 'Repartidor no encontrado.' });
        }

        const driverId = driverResult[0].id;

        const [horarios] = await db.execute(
            'SELECT * FROM horarios_trabajo_repartidor WHERE repartidor_id = ?',
            [driverId]
        );

        const horariosPorDia = {};
        horarios.forEach(h => {
            horariosPorDia[h.dia_semana] = { hora_inicio: h.hora_inicio, hora_fin: h.hora_fin };
        });

        res.render('drivers/disponibilidad', {
            title: 'Mi Disponibilidad - A la Mesa',
            user: req.session.user,
            horarios: horariosPorDia,
            path: req.path,
            activePage: 'disponibilidad'
        });
    } catch (error) {
        console.error('Error al obtener la disponibilidad:', error);
        res.status(500).render('error', { message: 'Error al cargar la página de disponibilidad.' });
    }
});

// Ruta para guardar la disponibilidad
router.post('/disponibilidad', async (req, res) => {
    const { dias, hora_inicio, hora_fin } = req.body;
    const userId = req.session.user.id;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Get the driver ID from the drivers table using the user ID
        const [driverResult] = await connection.execute(
            'SELECT id FROM drivers WHERE user_id = ?',
            [userId]
        );

        if (driverResult.length === 0) {
            throw new Error('Driver not found');
        }

        const driverId = driverResult[0].id;

        // Delete existing schedules for this driver
        await connection.execute('DELETE FROM horarios_trabajo_repartidor WHERE repartidor_id = ?', [driverId]);

        // Insert new schedules if days and times are provided
        if (dias && hora_inicio && hora_fin) {
            for (let i = 0; i < 7; i++) { // 7 days of the week
                if (dias[i] === '1') { // Checkbox was checked
                    await connection.execute(
                        'INSERT INTO horarios_trabajo_repartidor (repartidor_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)',
                        [driverId, i, hora_inicio, hora_fin]
                    );
                }
            }
        }

        await connection.commit();
        res.redirect('/repartidores/disponibilidad?success=1');
    } catch (error) {
        await connection.rollback();
        console.error('Error al guardar la disponibilidad:', error);
        res.status(500).render('error', { message: 'Error al guardar la disponibilidad.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Ruta para actualizar ubicación GPS del repartidor
router.post('/update-location', requireAuth, requireDriver, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const userId = req.session.user.id;

        console.log('📍 Recibida actualización de ubicación:', { userId, latitude, longitude });

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Latitud y longitud requeridas' });
        }

        // Actualizar ubicación del repartidor
        const [result] = await db.execute(
            'UPDATE drivers SET current_latitude = ?, current_longitude = ? WHERE user_id = ?',
            [latitude, longitude, userId]
        );

        // Obtener pedidos activos del repartidor para emitir actualizaciones
        const [driverResult] = await db.execute('SELECT id FROM drivers WHERE user_id = ?', [userId]);
        if (driverResult.length > 0) {
            const driverId = driverResult[0].id;

            const [activeOrders] = await db.execute(
                'SELECT id FROM pedidos WHERE repartidor_id = ? AND estado = "en_camino"',
                [driverId]
            );

            // Emitir actualización a todas las salas de pedidos activos
            const io = req.app.get('io');
            if (io) {
                activeOrders.forEach(order => {
                    io.to(`order-${order.id}`).emit('driver-location-update', {
                        driverId: driverId,
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude),
                        orderId: order.id
                    });
                });
            }
        }

        res.json({ success: true, message: 'Ubicación actualizada correctamente' });

    } catch (error) {
        console.error('Error actualizando ubicación del repartidor:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// Ruta para actualizar estado de pedidos (para repartidores)
router.post('/orders/:id/status', requireAuth, requireDriver, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const orderId = req.params.id;
        const { estado } = req.body;
        const userId = req.session.user.id;

        // Obtener el driver_id correcto
        const [driverResult] = await connection.execute('SELECT id FROM drivers WHERE user_id = ?', [userId]);
        if (driverResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Repartidor no encontrado' });
        }
        const driverId = driverResult[0].id;

        // Verificar que el pedido pertenece a este repartidor
        const [order] = await connection.execute(
            'SELECT * FROM pedidos WHERE id = ? AND repartidor_id = ?',
            [orderId, driverId]
        );

        if (order.length === 0) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado o no pertenece a este repartidor' });
        }

        const currentStatus = order[0].estado;

        // Solo permitir marcar como entregado si está en 'en_camino'
        if (estado === 'entregado' && currentStatus === 'en_camino') {
            await connection.execute('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, orderId]);

            // Generar comisión para el repartidor
            const comisionMonto = 200; // Monto fijo de la comisión
            await connection.execute(
                'INSERT INTO comisiones (repartidor_id, pedido_id, monto, estado) VALUES (?, ?, ?, ?)',
                [driverId, orderId, comisionMonto, 'pendiente']
            );

            res.json({ success: true, message: 'Pedido marcado como entregado exitosamente' });
        } else {
            res.status(400).json({ success: false, message: 'Transición de estado no permitida' });
        }

    } catch (error) {
        console.error('Error actualizando estado del pedido:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    } finally {
        connection.release();
    }
});

// Endpoint de prueba para verificar actualizaciones GPS
router.get('/test-gps', requireAuth, requireDriver, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Obtener coordenadas actuales del repartidor
        const [driverResult] = await db.execute('SELECT current_latitude, current_longitude FROM drivers WHERE user_id = ?', [userId]);

        if (driverResult.length === 0) {
            return res.json({ success: false, message: 'Repartidor no encontrado' });
        }

        const driver = driverResult[0];

        res.json({
            success: true,
            coordinates: {
                latitude: driver.current_latitude,
                longitude: driver.current_longitude
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error en test GPS:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// Endpoint para simular movimiento del repartidor (para testing)
router.post('/simulate-movement', requireAuth, requireDriver, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Latitud y longitud requeridas' });
        }

        // Actualizar coordenadas del repartidor
        await db.execute(
            'UPDATE drivers SET current_latitude = ?, current_longitude = ? WHERE user_id = ?',
            [latitude, longitude, userId]
        );

        // Emitir actualización a través de Socket.IO
        const io = req.app.get('io');
        if (io) {
            // Obtener pedidos activos del repartidor
            const [driverResult] = await db.execute('SELECT id FROM drivers WHERE user_id = ?', [userId]);
            if (driverResult.length > 0) {
                const driverId = driverResult[0].id;

                const [activeOrders] = await db.execute(
                    'SELECT id FROM pedidos WHERE repartidor_id = ? AND estado = "en_camino"',
                    [driverId]
                );

                console.log(`📡 [SERVIDOR] Emitiendo actualización GPS para repartidor ${driverId} a ${activeOrders.length} pedidos`);

                // Emitir actualización a todas las salas de pedidos activos
                activeOrders.forEach(order => {
                    console.log(`📡 [SERVIDOR] Enviando actualización a sala order-${order.id}`);
                    io.to(`order-${order.id}`).emit('driver-location-update', {
                        driverId: driverId,
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude),
                        orderId: order.id
                    });
                    console.log(`✅ [SERVIDOR] Actualización enviada: driverId=${driverId}, lat=${latitude}, lng=${longitude}, orderId=${order.id}`);
                });
            } else {
                console.log('❌ [SERVIDOR] No se encontró driver para userId:', userId);
            }
        } else {
            console.log('❌ [SERVIDOR] Socket.IO no disponible en la aplicación');
        }

        res.json({
            success: true,
            message: 'Movimiento simulado correctamente',
            coordinates: { latitude, longitude }
        });

    } catch (error) {
        console.error('Error simulando movimiento:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

module.exports = router;
