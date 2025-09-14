const express = require('express');
const router = express.Router();
// Redirección de /orders a /orders/history para evitar errores y mantener compatibilidad
router.get('/', (req, res) => {
  res.redirect('/orders/history');
});
const { sendNotificationToUser, sendNotificationToRestaurant } = require('./push');
const { isRestaurantOpen } = require('../utils/restaurantUtils');
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendEmail } = require('../config/mailer');

// Configuración de Multer para comprobantes de pago
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/comprobantes');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `comprobante-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

const uploadConfig = {
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten archivos JPEG, JPG, PNG o PDF'));
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
};

// Crear instancias de multer según el uso
const uploadComprobante = multer(uploadConfig).single('comprobante');
const uploadComprobantePago = multer(uploadConfig).single('comprobante_pago');

const upload = multer();

// Middleware to check if user is logged in
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  if (req.session.user.tipo_usuario === 'restaurante') {
    return res.redirect('/dashboard/orders');
  }
  next();
}

// Checkout page
router.get('/checkout', requireAuth, async (req, res) => {
  const cart = req.session.cart || [];
    if (cart.length === 0) {
        return res.redirect('/cart');
    }

  try {
    // Get restaurant info from the first cart item
    const restaurantId = cart[0].restaurante_id;
    const [restaurants] = await db.execute(`
      SELECT *, mp_access_token, mp_user_id, imagen_logo FROM restaurantes WHERE id = ?
    `, [restaurantId]);

    if (restaurants.length === 0) {
      return res.redirect('/cart');
    }

    const restaurant = restaurants[0];
    
    // Convertir valores numéricos del restaurante
    restaurant.costo_delivery = parseFloat(restaurant.costo_delivery) || 0;
    restaurant.descuento_delivery = parseFloat(restaurant.descuento_delivery) || 0;
    restaurant.tiempo_entrega_min = parseInt(restaurant.tiempo_entrega_min) || 30;
    restaurant.tiempo_entrega_max = parseInt(restaurant.tiempo_entrega_max) || 60;
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = restaurant.costo_delivery;
    const total = subtotal + deliveryFee;
    
    // Obtener información completa del usuario incluyendo la dirección
    const [users] = await db.execute(`
      SELECT id, nombre, apellido, email, telefono, ciudad, direccion_principal 
      FROM usuarios WHERE id = ?
    `, [req.session.user.id]);
    
    const user = users[0];
    
    // Preparar los datos del restaurante para el carrito
    const cartWithRestaurantInfo = cart.map(item => ({
      ...item,
      restaurante_logo: restaurant.imagen_logo,
      restaurante_nombre: restaurant.nombre,
      restaurante_delivery_time: restaurant.tiempo_entrega_min + '-' + restaurant.tiempo_entrega_max,
      restaurante_descuento: restaurant.descuento_delivery || 0
    }));
    
    res.render('orders/checkout', {
      title: 'Finalizar Pedido - A la Mesa',
      cart: cartWithRestaurantInfo,
      restaurant,
      user: req.session.user,
      subtotal,
      deliveryFee,
      total,
      currentPath: '/orders/checkout',
      script: '<script src="/js/checkout.js"></script>'
    });
  } catch (error) {
    console.error('Error cargando checkout:', error);
    res.redirect('/cart');
  }
});

// Process order
router.post('/create', requireAuth, upload.none(), async (req, res) => {
  const connection = await db.getConnection();

  try {
    // Verificar que el usuario esté autenticado y tenga un ID válido
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado. Por favor, inicia sesión nuevamente.' });
    }

    // Verificar que el usuario existe en la base de datos
    const [userCheck] = await db.execute('SELECT id FROM usuarios WHERE id = ?', [req.session.user.id]);
    if (userCheck.length === 0) {
      // Limpiar la sesión inválida
      req.session.destroy(err => {
        if (err) console.error('Error destruyendo sesión:', err);
      });
      return res.status(401).json({ success: false, message: 'Sesión inválida. Por favor, inicia sesión nuevamente.' });
    }

    let { cart, subtotal, deliveryFee, total, direccion, ciudad, instrucciones, metodo_pago, latitude, longitude, payment_status } = req.body;

    // Validar que el carrito esté presente y sea un string válido
    if (!cart || typeof cart !== 'string' || cart.trim() === '') {
      return res.status(400).json({ success: false, message: 'El carrito está vacío o no es válido' });
    }

    // Parsear el carrito de JSON string a objeto
    try {
      cart = JSON.parse(cart);
    } catch (parseError) {
      console.error('Error parsing cart JSON:', parseError);
      return res.status(400).json({ success: false, message: 'El formato del carrito no es válido' });
    }
    subtotal = parseFloat(subtotal);
    deliveryFee = parseFloat(deliveryFee);
    total = parseFloat(total);
    
    const restaurantId = cart[0].restaurante_id;
    // Aplicar descuento del 5% para pagos en efectivo y transferencia
    const [restaurantRows] = await connection.execute('SELECT ofrece_descuento_efectivo FROM restaurantes WHERE id = ?', [restaurantId]);

    if (restaurantRows.length > 0 && restaurantRows[0].ofrece_descuento_efectivo && (metodo_pago === 'efectivo' || metodo_pago === 'transferencia')) {
      const descuento = total * 0.05;
      total = total - descuento;
    }

    if (!cart || cart.length === 0) {
      return res.status(400).json({ success: false, message: 'El carrito está vacío' });
    }

    // Obtener la información completa del restaurante para verificar el horario
    const [fullRestaurantInfo] = await connection.execute(
      'SELECT * FROM restaurantes WHERE id = ?',
      [restaurantId]
    );

    if (fullRestaurantInfo.length === 0) {
      console.error(`Restaurante con ID ${restaurantId} no encontrado. Limpiando carrito.`);
      // Limpiar el carrito si el restaurante no existe
      req.session.cart = [];
      req.session.cartTotal = 0;
      req.session.cartCount = 0;
      return res.status(400).json({
        success: false,
        message: 'El restaurante seleccionado ya no está disponible. Tu carrito ha sido limpiado.',
        redirect: '/cart'
      });
    }

    const restaurant = fullRestaurantInfo[0];

    // Verificar si el restaurante está abierto
    if (!isRestaurantOpen(restaurant)) {
      return res.status(400).json({ success: false, message: 'El restaurante está cerrado en este momento. No se puede realizar el pedido.' });
    }

    
    
    await connection.beginTransaction();

    let orderStatus = 'pendiente';
    if (metodo_pago === 'mercadopago') {
      if (payment_status === 'approved') {
        orderStatus = 'pagado';
      } else {
        orderStatus = 'pendiente_pago';
      }
    }
    
    // Create order (numero_pedido temporal, luego se actualiza)
    const [orderResult] = await connection.execute(`
      INSERT INTO pedidos (
        numero_pedido, cliente_id, restaurante_id, direccion_entrega, latitud_entrega, longitud_entrega,
        subtotal, costo_delivery, total, estado, metodo_pago
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'TEMP', // valor temporal
      req.session.user.id,
      restaurantId,
      direccion,
      latitude || null,
      longitude || null,
      subtotal,
      deliveryFee,
      total,
      orderStatus, // Use the determined orderStatus
      metodo_pago
    ]);

    const orderId = orderResult.insertId;

    // Verificar que las coordenadas se guardaron correctamente
    const [verifyOrder] = await connection.execute(
      'SELECT latitud_entrega, longitud_entrega FROM pedidos WHERE id = ?',
      [orderId]
    );

    // Actualizar numero_pedido con el id real
    const numeroPedidoCorto = orderId.toString();
    await connection.execute(`
      UPDATE pedidos SET numero_pedido = ? WHERE id = ?
    `, [numeroPedidoCorto, orderId]);

    // Create order items
    for (const item of cart) {
      await connection.execute(`
        INSERT INTO items_pedido (
          pedido_id, producto_id, cantidad, precio_unitario, subtotal, notas_especiales
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        item.producto_id,
        item.quantity,
        item.price,
        item.price * item.quantity,
        item.specialInstructions || null
      ]);
    }
    
    await connection.commit();

    // Enviar email y notificación push de confirmación de pedido
    try {
      const [infoRows] = await connection.execute(`
        SELECT p.id, p.numero_pedido, p.total, u.email, u.nombre, u.apellido, u.recibir_notificaciones,
               r.nombre AS restaurante_nombre
        FROM pedidos p
        JOIN usuarios u ON p.cliente_id = u.id
        JOIN restaurantes r ON p.restaurante_id = r.id
        WHERE p.id = ?
      `, [orderId]);

      if (infoRows.length > 0) {
        const info = infoRows[0];

        // Enviar email si el usuario optó por recibirlos
        if (Number(info.recibir_notificaciones) === 1) {
          const subject = `Pedido #${info.numero_pedido} recibido por ${info.restaurante_nombre}`;
          await sendEmail(
            info.email,
            subject,
            'order-created',
            {
              numero_pedido: info.numero_pedido,
              restaurante_nombre: info.restaurante_nombre,
              total: info.total,
              order_id: orderId
            }
          );
        }

        // Enviar notificación PUSH al cliente (independientemente de sus preferencias de email)
        const pushNotificationData = {
            title: '✅ Pedido Recibido',
            body: `Tu pedido en ${info.restaurante_nombre} ha sido recibido. Te notificaremos cuando cambie de estado.`,
            url: `/orders/${info.id}`
        };
        await sendNotificationToUser(req.session.user.id, pushNotificationData);

        // Enviar notificación PUSH al restaurante
        const restaurantNotificationData = {
            title: '🍽️ Nuevo pedido recibido',
            body: `Pedido #${info.numero_pedido} - Total: $${info.total}`,
            url: `/dashboard/orders/${info.id}`,
            orderId: info.id
        };
        await sendNotificationToRestaurant(restaurantId, restaurantNotificationData);
      }
    } catch (notificationErr) {
      console.error('Error enviando email o notificación push de creación de pedido:', notificationErr);
    }

    // Notificar al restaurante sobre el nuevo pedido
    const io = req.app.get('io');
    if (io) {
      const [pedidoCreado] = await connection.execute(
        `SELECT 
          p.*, 
          u.nombre as cliente_nombre, 
          u.apellido as cliente_apellido,
          (SELECT COUNT(*) FROM pedidos WHERE restaurante_id = ? AND estado = 'pendiente') as total_pendientes
        FROM pedidos p
        JOIN usuarios u ON p.cliente_id = u.id
        WHERE p.id = ?`,
        [restaurantId, orderId]
      );

      if (pedidoCreado.length > 0) {
        io.to(`restaurante_${restaurantId}`).emit('nuevo_pedido', pedidoCreado[0]);
      }
    }
    
    // Clear cart
    req.session.cart = [];
    req.session.cartTotal = 0;
    req.session.cartCount = 0;
    
    res.json({
      success: true,
      message: 'Pedido creado exitosamente',
      orderId: orderId
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error creando pedido:', error);

    // Manejar errores específicos de base de datos
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Error de autenticación. Por favor, inicia sesión nuevamente.'
      });
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un pedido similar. Por favor, intenta de nuevo.'
      });
    }

    res.status(500).json({ success: false, message: 'Error creando el pedido. Por favor, intenta de nuevo.' });
  } finally {
    connection.release();
  }
});

// Upload payment proof
router.post('/:id/upload-comprobante', requireAuth, uploadComprobante, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        const connection = await db.getConnection();

        // Verificar que el pedido existe y pertenece al usuario
        const [order] = await connection.execute(
            'SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?',
            [orderId, req.session.user.id]
        );

        if (!order[0]) {
            return res.json({
                success: false,
                message: 'Pedido no encontrado o no autorizado'
            });
        }

        // Verificar que el método de pago es transferencia
        if (order[0].metodo_pago !== 'transferencia') {
            return res.json({
                success: false,
                message: 'Este pedido no utiliza transferencia bancaria'
            });
        }

        // Verificar que no hay comprobante previo
        if (order[0].comprobante_pago_url) {
            return res.json({
                success: false,
                message: 'Ya existe un comprobante de pago para este pedido'
            });
        }

        // Verificar que el archivo se subió correctamente
        if (!req.file) {
            return res.json({
                success: false,
                message: 'No se subió ningún archivo'
            });
        }

        // Guardar solo el nombre del archivo
        const fileName = req.file.filename;
        
        // Actualizar el pedido con el nombre del comprobante
        await connection.execute(
            'UPDATE pedidos SET comprobante_pago_url = ? WHERE id = ?',
            [fileName, orderId]
        );

        res.json({
            success: true,
            message: 'Comprobante de pago subido exitosamente',
            comprobante_url: fileName
        });

    } catch (error) {
        console.error('Error subiendo comprobante:', error);
        res.json({
            success: false,
            message: 'Error subiendo el comprobante de pago'
        });
    }
});


router.get('/:id/chat-content', requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    // You might want to fetch some order data here if needed for the partial
    // For now, we just render the partial
    res.render('partials/chat-interface', { layout: false }); // layout: false ensures only the partial is rendered
  } catch (error) {
    console.error('Error cargando contenido del chat:', error);
    res.status(500).send('<div class="alert alert-danger">Error al cargar el chat.</div>');
  }
});

// Get chat messages for an order
router.get('/:id/chat/messages', requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);

    // Verify the order belongs to the user
    const [orders] = await db.execute(
      'SELECT id FROM pedidos WHERE id = ? AND cliente_id = ?',
      [orderId, req.session.user.id]
    );

    if (orders.length === 0) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este chat' });
    }

    // Get chat messages
    const [messages] = await db.execute(`
      SELECT
        mp.id,
        mp.mensaje,
        mp.fecha_envio,
        mp.remitente_tipo,
        CASE
          WHEN mp.remitente_tipo = 'cliente' THEN u.nombre
          WHEN mp.remitente_tipo = 'restaurante' THEN r.nombre
          ELSE 'Sistema'
        END as remitente_nombre
      FROM mensajes_pedido mp
      LEFT JOIN usuarios u ON mp.remitente_id = u.id AND mp.remitente_tipo = 'cliente'
      LEFT JOIN restaurantes r ON mp.remitente_id = r.usuario_id AND mp.remitente_tipo = 'restaurante'
      WHERE mp.pedido_id = ?
      ORDER BY mp.fecha_envio ASC
    `, [orderId]);

    res.json({
      success: true,
      messages: messages
    });

  } catch (error) {
    console.error('Error obteniendo mensajes del chat:', error);
    res.status(500).json({ success: false, message: 'Error al cargar los mensajes' });
  }
});

// Ruta para mostrar la página de completar pago
router.get('/:id/complete-payment', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);

    // Verificar que el pedido existe y está pendiente de pago
    const [orders] = await db.execute(`
      SELECT p.*, r.nombre as restaurante_nombre
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      WHERE p.id = ? AND p.estado = 'pendiente_pago'
    `, [orderId]);

    if (orders.length === 0) {
      return res.render('orders/complete-payment', {
        title: 'Completar Pago - A la Mesa',
        order: null
      });
    }

    const order = orders[0];

    // Verificar que no hayan pasado más de 15 minutos
    const orderTime = new Date(order.fecha_pedido);
    const currentTime = new Date();
    const minutesDiff = (currentTime - orderTime) / (1000 * 60);

    if (minutesDiff > 15) {
      // Cancelar el pedido automáticamente
      await db.execute(`
        UPDATE pedidos 
        SET estado = 'cancelado', 
            motivo_cancelacion = 'Pago no completado dentro del tiempo límite (15 minutos)'
        WHERE id = ?
      `, [orderId]);

      return res.render('orders/complete-payment', {
        title: 'Completar Pago - A la Mesa',
        order: null
      });
    }

    res.render('orders/complete-payment', {
      title: 'Completar Pago - A la Mesa',
      order: order
    });

  } catch (error) {
    console.error('Error mostrando página de completar pago:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando la página de completar pago',
      error: {}
    });
  }
});

// Ruta para completar pago posteriormente (hasta 15 minutos después)
router.post('/:id/complete-payment', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { paymentMethod } = req.body;

    // Verificar que el pedido existe y está pendiente de pago
    const [orders] = await db.execute(`
      SELECT p.*, r.mp_public_key, r.nombre as restaurante_nombre
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      WHERE p.id = ? AND p.estado = 'pendiente_pago'
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado o no está pendiente de pago' });
    }

    const order = orders[0];
    let total = parseFloat(order.total);
    const subtotal = parseFloat(order.subtotal);
    const deliveryFee = parseFloat(order.costo_delivery);

    // Verificar que no hayan pasado más de 15 minutos
    const orderTime = new Date(order.fecha_pedido);
    const currentTime = new Date();
    const minutesDiff = (currentTime - orderTime) / (1000 * 60);

    if (minutesDiff > 15) {
      // Cancelar el pedido automáticamente
      await db.execute(`
        UPDATE pedidos 
        SET estado = 'cancelado', 
            motivo_cancelacion = 'Pago no completado dentro del tiempo límite (15 minutos)'
        WHERE id = ?
      `, [orderId]);

      return res.status(400).json({ 
        success: false, 
        message: 'El tiempo límite para completar el pago ha expirado. El pedido ha sido cancelado.' 
      });
    }

    // Aplicar descuento si corresponde
    if (paymentMethod === 'efectivo' || paymentMethod === 'transferencia') {
      const originalTotal = subtotal + deliveryFee;
      const discount = originalTotal * 0.05;
      total = originalTotal - discount;
    } else {
      // Si se cambia a otro método, asegurar que el total sea el original sin descuento
      total = subtotal + deliveryFee;
    }

    // Actualizar el método de pago y el total
    await db.execute(`
      UPDATE pedidos 
      SET metodo_pago = ?, 
          estado = 'pendiente',
          total = ?
      WHERE id = ?
    `, [paymentMethod, total, orderId]);

    // Si es MercadoPago, crear preferencia de pago
    if (paymentMethod === 'mercadopago') {
      if (!order.mp_public_key) {
        return res.status(400).json({ 
          success: false, 
          message: 'El restaurante no tiene configurado MercadoPago' 
        });
      }

      // Crear preferencia de pago
      const absoluteUrl = `${req.protocol}://${req.get('host')}/payments/create-preference`;
      const preferenceResponse = await fetch(absoluteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId
        })
      });

      const preferenceData = await preferenceResponse.json();
      
      if (!preferenceData.success) {
        return res.status(400).json({ 
          success: false, 
          message: preferenceData.message || 'Error creando preferencia de pago' 
        });
      }

      return res.json({ 
        success: true, 
        message: 'Pago iniciado exitosamente',
        preferenceId: preferenceData.preferenceId,
        redirectUrl: `/payments/mercadopago/${preferenceData.preferenceId}`
      });
    } else {
      // Para otros métodos de pago, solo confirmar
      return res.json({ 
        success: true, 
        message: 'Método de pago actualizado. El restaurante procesará tu pedido.' 
      });
    }

  } catch (error) {
    console.error('Error completando pago:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Ruta unificada: historial de pedidos del cliente autenticado con paginación y filtros
router.get('/history', requireAuth, async (req, res) => {
  try {
    const pageSize = 10;
    const currentPage = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
    const offset = (currentPage - 1) * pageSize;
    let query = `SELECT p.*, p.fecha_entrega, r.nombre as restaurante_nombre, r.imagen_logo, COUNT(DISTINCT ip.id) as total_items
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN items_pedido ip ON p.id = ip.pedido_id`;
    let params = [];
    let where = [];
    where.push('p.cliente_id = ?');
    params.push(req.session.user.id);
    // Filtros
    let { status, date, search } = req.query;
    // Normalizar valores vacíos
    status = status && status !== 'todos' ? status : '';
    date = date && date.trim() !== '' ? date : '';
    search = search && search.trim() !== '' ? search : '';
    if (status) {
      where.push('p.estado = ?');
      params.push(status);
    }
    if (date) {
      // Convertir dd/mm/aaaa a aaaa-mm-dd si es necesario
      let dateSQL = date;
      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(date)) {
        const [d, m, y] = date.split('/');
        dateSQL = `${y}-${m}-${d}`;
      }
      where.push('DATE(p.fecha_pedido) = ?');
      params.push(dateSQL);
    }
    if (search) {
      where.push('(r.nombre LIKE ? OR p.numero_pedido LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (where.length > 0) {
      query += ' WHERE ' + where.join(' AND ');
    }
    query += ' GROUP BY p.id ORDER BY p.fecha_pedido DESC';
    // Conteo total para paginación (debe reflejar los mismos filtros y joins)
    let countQuery = `SELECT COUNT(DISTINCT p.id) as total
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN items_pedido ip ON p.id = ip.pedido_id`;
    let countParams = [];
    let countWhere = [];
    countWhere.push('p.cliente_id = ?');
    countParams.push(req.session.user.id);
    if (status) {
      countWhere.push('p.estado = ?');
      countParams.push(status);
    }
    if (date) {
      let dateSQL = date;
      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(date)) {
        const [d, m, y] = date.split('/');
        dateSQL = `${y}-${m}-${d}`;
      }
      countWhere.push('DATE(p.fecha_pedido) = ?');
      countParams.push(dateSQL);
    }
    if (search) {
      countWhere.push('(r.nombre LIKE ? OR p.numero_pedido LIKE ?)');
      countParams.push(`%${search}%`, `%${search}%`);
    }
    if (countWhere.length > 0) {
      countQuery += ' WHERE ' + countWhere.join(' AND ');
    }
    // Pedidos paginados
    // Para evitar errores de argumentos, interpolar LIMIT y OFFSET directamente en la consulta
    let paginatedQuery = `${query} LIMIT ${parseInt(pageSize, 10)} OFFSET ${parseInt(offset, 10)}`;
    const [ordersRows] = await db.execute(paginatedQuery, params);
    const [countRows] = await db.execute(countQuery, countParams);
    const totalOrders = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalOrders / pageSize);
    res.render('orders/history', {
      title: 'Mis Pedidos - A la Mesa',
      orders: ordersRows,
      currentPage,
      totalPages,
      totalOrders,
      filters: { status: req.query.status || '', date: req.query.date || '', search: req.query.search || '' },
      getPageUrl: (p) => {
        const url = new URL(req.originalUrl, 'http://localhost');
        url.searchParams.set('page', p);
        return url.pathname + url.search;
      },
      errorMessage: ordersRows.length === 0 ? 'No tienes pedidos aún.' : '',
      user: req.session.user
    });
  } catch (err) {
    console.error('Error en GET /orders/history:', err);
    res.status(500).render('error', { message: 'Error al cargar pedidos', error: err });
  }
});

// Order detail
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    // Get order info
    const [orders] = await db.execute(`
      SELECT p.id, p.numero_pedido, p.cliente_id, p.restaurante_id, p.direccion_entrega,
             p.latitud_entrega, p.longitud_entrega, p.subtotal, p.costo_delivery, p.total,
             p.estado, p.metodo_pago, p.notas_especiales, p.comprobante_pago_url, p.fecha_pedido, p.repartidor_id,
             r.nombre as restaurante_nombre, r.latitud as restaurante_lat, r.longitud as restaurante_lng,
             r.direccion as restaurante_direccion, r.imagen_logo as restaurante_logo,
             u_driver.nombre as repartidor_nombre, u_driver.telefono as repartidor_telefono,
             d.current_latitude as driver_lat, d.current_longitude as driver_lng
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      LEFT JOIN drivers d ON p.repartidor_id = d.id
      LEFT JOIN usuarios u_driver ON d.user_id = u_driver.id
      LEFT JOIN restaurantes r ON p.restaurante_id = r.id
      WHERE p.id = ? AND p.cliente_id = ?
    `, [orderId, req.session.user.id]);

    // Verificar que el pedido existe
    if (orders.length === 0) {
      return res.render('orders/history', {
        title: 'Mis Pedidos - A la Mesa',
        orders: [],
        script: '<script src="/js/orders.js"></script>',
        errorMessage: 'El pedido que buscas no existe o no tienes acceso a él.',
        user: req.session.user,
        currentPage: 1,
        totalPages: 1,
        totalOrders: 0
      });
    }
    const order = orders[0];
    // Get order items
    const [items] = await db.execute(`
      SELECT ip.*, pr.nombre, pr.imagen
      FROM items_pedido ip
      JOIN productos pr ON ip.producto_id = pr.id
      WHERE ip.pedido_id = ?
    `, [orderId]);
    // Get restaurant info
    const [restaurants] = await db.execute(`
      SELECT * FROM restaurantes WHERE id = ?
    `, [order.restaurante_id]);
    if (restaurants.length === 0) {
      return res.render('orders/history', {
        title: 'Mis Pedidos - A la Mesa',
        orders: [],
        script: '<script src="/js/orders.js"></script>',
        errorMessage: 'No se encontró la información del restaurante asociado al pedido.',
        user: req.session.user,
        currentPage: 1,
        totalPages: 1,
        totalOrders: 0
      });
    }
    const restaurant = restaurants[0];
    // Calcular si el chat debe estar disponible (menos de 14 horas desde el pedido)
    const orderTime = new Date(order.fecha_pedido);
    const currentTime = new Date();
    const hoursDiff = (currentTime - orderTime) / (1000 * 60 * 60); // Diferencia en horas
    const canChat = hoursDiff < 14;
    // Preparar los datos para la vista
    const viewData = {
      title: `Pedido #${order.numero_pedido} - A la Mesa`,
      order,
      items,
      restaurant,
      canChat, // Pasar la variable canChat a la vista
      script: '<script src="/js/order-detail.js"></script>',
      user: req.session.user,
      driverLocation: (order.estado === 'en_camino' && order.repartidor_id && order.driver_lat && order.driver_lng) ? {
        latitude: order.driver_lat,
        longitude: order.driver_lng
      } : null
    };

    res.render('orders/detail', viewData);
  } catch (error) {
    console.error('Error cargando pedido:', error);
    res.render('orders/history', {
      title: 'Mis Pedidos - A la Mesa',
      orders: [],
      script: '<script src="/js/orders.js"></script>',
      errorMessage: 'Error cargando el detalle del pedido. Por favor, intenta de nuevo más tarde.',
      user: req.session.user,
      currentPage: 1,
      totalPages: 1,
      totalOrders: 0
    });
  }
});

// Cancel order
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { motivo } = req.body;
    
    // Check if order can be cancelled
    const [orders] = await db.execute(`
      SELECT estado FROM pedidos 
      WHERE id = ? AND cliente_id = ?
    `, [orderId, req.session.user.id]);
    
    if (orders.length === 0) {
      return res.json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }
    
    const order = orders[0];
    
    if (!['pendiente', 'confirmado'].includes(order.estado)) {
      return res.json({
        success: false,
        message: 'No se puede cancelar el pedido en este estado'
      });
    }
    
    // Cancel order
    await db.execute(`
      UPDATE pedidos 
      SET estado = 'cancelado', motivo_cancelacion = ?
      WHERE id = ?
    `, [motivo || 'Cancelado por el cliente', orderId]);
    
    res.json({
      success: true,
      message: 'Pedido cancelado exitosamente'
    });
    
  } catch (error) {
    console.error('Error cancelando pedido:', error);
    res.json({
      success: false,
      message: 'Error cancelando el pedido'
    });
  }
});

// Mark order as delivered
router.post('/:id/mark-delivered', requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    // Check if order exists and belongs to user
    const [orders] = await db.execute(`
      SELECT estado FROM pedidos 
      WHERE id = ? AND cliente_id = ?
    `, [orderId, req.session.user.id]);
    if (orders.length === 0) {
      return res.json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }
    const order = orders[0];
    // Check if order is in the correct state
    if (order.estado !== 'en_camino') {
      return res.json({
        success: false,
        message: 'Solo se pueden marcar como entregados los pedidos que están en camino'
      });
    }
    // Mark order as delivered
    await db.execute(`
      UPDATE pedidos
      SET estado = 'entregado', fecha_entrega = NOW()
      WHERE id = ?
    `, [orderId]);

    // Create $100 commission for the driver
    const [orderInfo] = await db.execute(`
      SELECT repartidor_id FROM pedidos WHERE id = ?
    `, [orderId]);

    if (orderInfo.length > 0 && orderInfo[0].repartidor_id) {
      await db.execute(`
        INSERT INTO comisiones (repartidor_id, pedido_id, monto, estado, fecha_creacion)
        VALUES (?, ?, 100.00, 'pendiente', NOW())
      `, [orderInfo[0].repartidor_id, orderId]);
    }

    res.json({
      success: true,
      message: 'Pedido marcado como entregado exitosamente'
    });
  } catch (error) {
    console.error('Error marcando pedido como entregado:', error);
    res.json({
      success: false,
      message: 'Error marcando el pedido como entregado'
    });
  }
});

// Order chat
router.get('/:id/chat', requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);

    // Get order info
    const [orders] = await db.execute(`
      SELECT p.id, p.numero_pedido, p.cliente_id, p.restaurante_id, p.estado,
             r.nombre as restaurante_nombre, r.imagen_logo as restaurante_logo,
             u.nombre as cliente_nombre, u.apellido as cliente_apellido
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.id = ? AND (p.cliente_id = ? OR r.usuario_id = ?)
    `, [orderId, req.session.user.id, req.session.user.id]);

    if (orders.length === 0) {
      return res.status(404).render('error-404', {
        title: 'Chat de Pedido No Encontrado',
        user: req.session.user || null
      });
    }

    const order = orders[0];

    // Check if the user is authorized to view this chat
    if (order.cliente_id !== req.session.user.id && order.restaurante_id !== req.session.user.id) {
        // If the user is not the client or the restaurant owner, check if they are an admin
        if (req.session.user.tipo_usuario !== 'admin') {
            return res.status(403).render('error', {
                title: 'Acceso Denegado',
                message: 'No tienes permiso para acceder a este chat.',
                user: req.session.user || null
            });
        }
    }

    // Get chat messages for initial render (opcional, ya que Socket.IO los cargará)
    let messages = [];
    try {
      const [messagesResult] = await db.execute(`
        SELECT mp.*, u.nombre as remitente_nombre
        FROM mensajes_pedido mp
        LEFT JOIN usuarios u ON mp.remitente_id = u.id AND mp.remitente_tipo = 'cliente'
        WHERE mp.pedido_id = ?
        ORDER BY mp.fecha_envio ASC
      `, [orderId]);
      messages = messagesResult || [];
    } catch (msgError) {
      console.warn('No se pudieron cargar mensajes iniciales:', msgError);
    }

    res.render('orders/chat', {
      title: `Chat Pedido #${order.numero_pedido} - A la Mesa`,
      order,
      messages, // Pasar mensajes para compatibilidad, aunque Socket.IO los recargará
      user: req.session.user
    });

  } catch (error) {
    console.error('Error cargando chat de pedido:', error);
    res.status(500).render('error', {
      title: 'Error del Servidor',
      message: 'Error al cargar el chat del pedido. Por favor, intenta de nuevo más tarde.',
      error: process.env.NODE_ENV === 'development' ? error : {},
      user: req.session.user || null
    });
  }
});

// Endpoint para verificar coordenadas del repartidor
router.get('/:id/driver-coordinates', requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);

    // Verificar que el pedido existe y pertenece al usuario
    const [orders] = await db.execute(
      'SELECT p.repartidor_id, p.estado, d.current_latitude, d.current_longitude FROM pedidos p LEFT JOIN drivers d ON p.repartidor_id = d.user_id WHERE p.id = ? AND p.cliente_id = ?',
      [orderId, req.session.user.id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const order = orders[0];



    res.json({
      success: true,
      driverId: order.repartidor_id,
      estado: order.estado,
      coordinates: {
        latitude: order.current_latitude,
        longitude: order.current_longitude
      },
      hasCoordinates: !!(order.current_latitude && order.current_longitude)
    });

  } catch (error) {
    console.error('Error verificando coordenadas del repartidor:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Endpoint para calcular rutas
router.get('/:orderId/route', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { startLat, startLng, endLat, endLng } = req.query;



        if (!startLat || !startLng || !endLat || !endLng) {
            return res.status(400).json({ success: false, message: 'Faltan parámetros de coordenadas' });
        }

        // Usar OSRM (Open Source Routing Machine) - API gratuita y confiable
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=false`;

        const response = await fetch(osrmUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'A-la-Mesa-Delivery-App/1.0'
            }
        });

        if (!response.ok) {
            console.error('❌ Error en respuesta OSRM:', response.status, response.statusText);
            throw new Error(`OSRM API Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates) {
            // Extraer coordenadas de la ruta
            const coordinates = data.routes[0].geometry.coordinates;
            // OSRM devuelve [lng, lat], convertir a [lat, lng] para Leaflet
            const routeCoordinates = coordinates.map(coord => [coord[1], coord[0]]);

            res.json({
                success: true,
                route: routeCoordinates,
                distance: data.routes[0].distance,
                duration: data.routes[0].duration
            });
        } else {
            console.warn('⚠️ OSRM no devolvió ruta válida, usando fallback');
            // Fallback a línea recta si no hay ruta
            res.json({
                success: true,
                route: [[parseFloat(startLat), parseFloat(startLng)], [parseFloat(endLat), parseFloat(endLng)]],
                fallback: true
            });
        }
    } catch (error) {
        console.error('❌ Error calculando ruta:', error);

        // Fallback a línea recta en caso de error
        const fallbackRoute = [
            [parseFloat(req.query.startLat || startLat), parseFloat(req.query.startLng || startLng)],
            [parseFloat(req.query.endLat || endLat), parseFloat(req.query.endLng || endLng)]
        ];



        res.json({
            success: true,
            route: fallbackRoute,
            fallback: true,
            error: error.message
        });
    }
});

// Endpoint para calificar el servicio de delivery
router.post('/:id/rate-delivery', requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { rating, comentario } = req.body;

    // Verificar que el pedido existe y pertenece al usuario
    const [orders] = await db.execute(
      'SELECT id, estado, restaurante_id FROM pedidos WHERE id = ? AND cliente_id = ?',
      [orderId, req.session.user.id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const order = orders[0];

    // Verificar que el pedido esté entregado
    if (order.estado !== 'entregado') {
      return res.status(400).json({ success: false, message: 'Solo puedes calificar pedidos entregados' });
    }

    // Verificar que la calificación sea válida
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'La calificación debe ser entre 1 y 5' });
    }

    // Verificar si ya existe una calificación para este pedido
    const [existingRating] = await db.execute(
      'SELECT id FROM calificaciones WHERE pedido_id = ? AND cliente_id = ?',
      [orderId, req.session.user.id]
    );

    if (existingRating.length > 0) {
      // Actualizar calificación existente
      await db.execute(
        'UPDATE calificaciones SET calificacion_repartidor = ?, comentario_repartidor = ?, fecha_resena = NOW() WHERE pedido_id = ? AND cliente_id = ?',
        [ratingNum, comentario || null, orderId, req.session.user.id]
      );
    } else {
      // Crear nueva calificación
      await db.execute(
        'INSERT INTO calificaciones (pedido_id, cliente_id, restaurante_id, calificacion_repartidor, comentario_repartidor, fecha_resena) VALUES (?, ?, ?, ?, ?, NOW())',
        [orderId, req.session.user.id, order.restaurante_id, ratingNum, comentario || null]
      );
    }

    res.json({
      success: true,
      message: '¡Gracias por tu calificación! Ayudas a mejorar nuestro servicio.'
    });

  } catch (error) {
    console.error('Error calificando delivery:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

module.exports = router;
