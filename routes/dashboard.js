const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../config/database');
const ejs = require('ejs');
const fs = require('fs');
const { sendOrderStatusNotification } = require('./push');
const { isRestaurantOpen } = require('../utils/restaurantUtils');
const axios = require('axios');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const mercadopagoConfig = require('../config/mercadopago');
const { requireAuth, requireRestaurant, requireVerifiedRestaurant } = require('../middleware/auth');
const { sendEmail } = require('../config/mailer');

// --- Middleware específico del Dashboard ---

// Middleware para obtener el conteo de pedidos no entregados
async function getPendingOrdersCount(req, res, next) {
  if (req.session.user && req.session.user.tipo_usuario === 'restaurante') {
    try {
      const userId = req.session.user.id;
      const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
      if (restaurants.length > 0) {
        const restaurantId = restaurants[0].id;
        const [[{ pedidos_no_entregados }]] = await db.execute(`
          SELECT COUNT(*) as pedidos_no_entregados
          FROM pedidos
          WHERE restaurante_id = ? AND estado IN ('pendiente', 'confirmado', 'preparando', 'listo', 'en_camino')
        `, [restaurantId]);
        req.session.pedidosNoEntregados = pedidos_no_entregados;
        // Exponer en ambas claves por compatibilidad con vistas existentes
        res.locals.pedidosNoEntregados = pedidos_no_entregados;
        res.locals.pedidos_no_entregados = pedidos_no_entregados;

      }
  } catch (error) {
    // Error getting pending orders count - setting to 0
    req.session.pedidosNoEntregados = 0;
  }
  }
  next();
}

// Middleware para asegurar que el usuario es un restaurante o admin
function requireRestaurantOrAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  if (req.session.user.tipo_usuario !== 'restaurante' && req.session.user.tipo_usuario !== 'admin') {
    return res.status(403).render('error', { title: 'Acceso Denegado', message: 'No tienes permiso para acceder a esta página.', user: req.session.user });
  }
  next();
}

// --- Configuración de Multer ---

// Configuración de Multer para subir imágenes de productos
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/productos');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `producto-${uniqueSuffix}${extension}`);
  }
});

const uploadProductImage = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes JPEG, JPG, PNG o WEBP'));
  }
});

const restaurantStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `restaurante-${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

const uploadRestaurantImages = multer({
  storage: restaurantStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes JPEG, JPG, PNG o WEBP'));
  }
});

const upload = multer(); // For handling form-data without files

// Configuración de Multer para comprobantes de pago de restaurantes
const restaurantComprobanteStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/comprobantes_restaurantes'); // New directory for restaurant comprobantes
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `restaurante-comprobante-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

const uploadRestaurantComprobante = multer({
  storage: restaurantComprobanteStorage,
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
}).single('comprobante'); // 'comprobante' is the field name in the form

// Aplicar middleware globalmente para todas las rutas del dashboard
router.use(requireAuth, requireRestaurantOrAdmin, getPendingOrdersCount);

// --- Rutas del Dashboard ---

// Dashboard Principal (para restaurantes)
router.get('/', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  // Dashboard route accessed
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id, nombre, imagen_logo, imagen_banner, activo, verificado, mp_public_key, mp_access_token, mp_user_id, horario_apertura, horario_cierre, dias_operacion FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.render('dashboard/pending', {
        title: 'Panel de Restaurante - A la Mesa',
        message: 'Tu restaurante está pendiente de aprobación.',
        user: req.session.user
      });
    }
    const restaurant = restaurants[0];

    // Procesar dias_operacion como array de números y calcular abierto
    if (typeof restaurant.dias_operacion === 'string') {
      try {
        restaurant.dias_operacion = JSON.parse(restaurant.dias_operacion);
      } catch (e) {
        restaurant.dias_operacion = [];
      }
    }
    if (!Array.isArray(restaurant.dias_operacion)) restaurant.dias_operacion = [];
    restaurant.dias_operacion = restaurant.dias_operacion.map(Number).filter(dia => !isNaN(dia));
    restaurant.abierto = isRestaurantOpen(restaurant);

    // Obtener estadísticas de pedidos
    const [statsPedidos] = await db.execute(`
      SELECT
        -- Productos activos del restaurante
        (SELECT COUNT(*) FROM productos WHERE restaurante_id = ? AND disponible = 1) as total_productos,
        -- Pedidos últimos 30 días
        COUNT(*) as total_pedidos,
        -- Pedidos pendientes (en curso)
        SUM(CASE WHEN estado IN ('pendiente','confirmado','preparando','listo','en_camino') THEN 1 ELSE 0 END) as pedidos_pendientes,
        -- Ingresos totales (últimos 30 días, pedidos entregados)
        COALESCE(SUM(CASE WHEN estado = 'entregado' THEN total ELSE 0 END), 0) as ingresos_totales
      FROM pedidos
      WHERE restaurante_id = ? AND fecha_pedido >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [restaurant.id, restaurant.id]);

    // Daily earnings
    const [[dailyEarnings]] = await db.execute(`
      SELECT COALESCE(SUM(total), 0) as daily
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'entregado' AND DATE(fecha_pedido) = CURDATE()
    `, [restaurant.id]);

    // Weekly earnings
    const [[weeklyEarnings]] = await db.execute(`
      SELECT COALESCE(SUM(total), 0) as weekly
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'entregado' AND fecha_pedido >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `, [restaurant.id]);

    // Monthly earnings
    const [[monthlyEarnings]] = await db.execute(`
      SELECT COALESCE(SUM(total), 0) as monthly
      FROM pedidos
      WHERE restaurante_id = ? AND estado = 'entregado' AND fecha_pedido >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [restaurant.id]);

    // Obtener pedidos recientes
    const [pedidosRecientes] = await db.execute(`
      SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.restaurante_id = ? AND p.estado NOT IN ('pendiente_pago', 'pago_cancelado')
      ORDER BY p.fecha_pedido DESC
      LIMIT 5
    `, [restaurant.id]);

    // Obtener productos más vendidos (ejemplo, podrías necesitar una tabla de ventas para esto)
    const [productosMasVendidos] = await db.execute(`
      SELECT pr.nombre, SUM(ip.cantidad) as total_vendido
      FROM items_pedido ip
      JOIN productos pr ON ip.producto_id = pr.id
      JOIN pedidos p ON ip.pedido_id = p.id
      WHERE p.restaurante_id = ? AND p.estado = 'entregado' AND p.fecha_pedido >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY pr.nombre
      ORDER BY total_vendido DESC
      LIMIT 5
    `, [restaurant.id]);

    // Obtener solicitudes de repartidores pendientes
    const [[{ pending_drivers_count }]] = await db.execute(`
        SELECT COUNT(*) as pending_drivers_count
        FROM drivers
        WHERE restaurante_id = ? AND request_status = 'pending'
    `, [restaurant.id]);

    // Obtener calificaciones promedio
    const [calificaciones] = await db.execute(`
      SELECT AVG(calificacion_restaurante) as promedio, COUNT(*) as total
      FROM calificaciones
      WHERE restaurante_id = ? AND calificacion_restaurante IS NOT NULL
    `, [restaurant.id]);
    const calificacionPromedio = calificaciones[0].promedio ? parseFloat(calificaciones[0].promedio).toFixed(1) : 'N/A';
    const totalCalificaciones = calificaciones[0].total || 0;

    // Obtener el link de Mercado Pago de la tabla configuraciones
    const [rows] = await db.execute("SELECT valor FROM configuraciones WHERE clave = 'mercadopago_url' LIMIT 1");
    const mercadopago_url = rows.length > 0 ? rows[0].valor : '';

    res.render('dashboard/index', {
      title: 'Panel de Restaurante - A la Mesa',
      user: req.session.user,
      restaurant,
      stats: statsPedidos[0],
      dailyEarnings: dailyEarnings.daily,
      weeklyEarnings: weeklyEarnings.weekly,
      monthlyEarnings: monthlyEarnings.monthly,
      pedidosRecientes,
      productosMasVendidos,
      calificacionPromedio,
      totalCalificaciones,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      pendingDriversCount: pending_drivers_count, // Pasar el conteo a la vista
      mercadopago_url,
      path: req.path,
      isDashboardPage: true,
      activePage: 'dashboard',
      scripts: ['/js/dashboard.js']
    });
  } catch (error) {
    console.error('Error en dashboard principal:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el panel de control',
      error: {}
    });
  }
});

// Toggle de estado del restaurante (activar/desactivar)
router.post('/toggle-status', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { accion } = req.body || {};

    if (!accion || !['activar', 'desactivar'].includes(accion)) {
      return res.status(400).json({ success: false, message: 'Acción inválida' });
    }

    const [restaurants] = await db.execute('SELECT id, activo FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }

    const nuevoEstado = accion === 'activar' ? 1 : 0;
    await db.execute('UPDATE restaurantes SET activo = ? WHERE usuario_id = ?', [nuevoEstado, userId]);

    return res.json({ success: true, message: `Restaurante ${accion}do correctamente`, activo: !!nuevoEstado });
  } catch (error) {
    console.error('Error al cambiar el estado del restaurante:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Ruta para la página de restaurante pendiente de aprobación
router.get('/pending', requireRestaurant, getPendingOrdersCount, (req, res) => {
  res.render('dashboard/pending', {
    title: 'Restaurante Pendiente de Aprobación - A la Mesa',
    message: 'Tu restaurante está pendiente de aprobación. Pronto nos pondremos en contacto contigo.',
    user: req.session.user,
    pedidosNoEntregados: req.session.pedidosNoEntregados,
    path: req.path,
    isDashboardPage: true
  });
});

// --- Configuración del Restaurante ---
router.get('/settings', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT * FROM restaurantes WHERE usuario_id = ?', [userId]);
    // Cargar preferencias de email del usuario para mostrarlas en la vista
    try {
      const [userRows] = await db.execute(
        'SELECT email_notif_nuevo_pedido FROM usuarios WHERE id = ? LIMIT 1',
        [userId]
      );
      if (userRows && userRows.length > 0) {
        req.session.user.email_notif_nuevo_pedido = userRows[0].email_notif_nuevo_pedido ? 1 : 0;
      }
    } catch (e) {
      console.warn('No se pudo cargar email_notif_nuevo_pedido para el usuario:', e);
    }
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurant = restaurants[0];

    // Parsear dias_operacion si es un string JSON
    let diasOperacionParsed = null;
    try {
      if (restaurant.dias_operacion) {
        if (Array.isArray(restaurant.dias_operacion)) {
          diasOperacionParsed = restaurant.dias_operacion;
        } else if (typeof restaurant.dias_operacion === 'string') {
          const diasOperacionClean = restaurant.dias_operacion.trim();
          if (diasOperacionClean) {
            diasOperacionParsed = JSON.parse(diasOperacionClean);
          }
        }
      }
    } catch (e) {
      console.error('Error al procesar dias_operacion:', e);
    }

    // Si no hay días de operación o hubo error, usar valor por defecto
    if (!diasOperacionParsed || !Array.isArray(diasOperacionParsed)) {
      diasOperacionParsed = [1, 2, 3, 4, 5, 6, 7];
    }

    // Asegurarnos de que todos los valores sean números
    diasOperacionParsed = diasOperacionParsed.map(Number).filter(dia => !isNaN(dia));

    res.render('dashboard/settings', {
      title: 'Configuración del Restaurante - A la Mesa',
      user: req.session.user,
      restaurant: {
        ...restaurant,
        dias_operacion: diasOperacionParsed
      },
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
    isDashboardPage: true,
      scripts: ['/js/dashboard-settings.js'],
      activePage: 'configuracion'
    });
  } catch (error) {
    console.error('Error en configuración del restaurante:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando la configuración del restaurante',
      error: {}
    });
  }
});

router.post('/settings', requireRestaurant, requireVerifiedRestaurant, uploadRestaurantImages.fields([{ name: 'imagen_logo', maxCount: 1 }, { name: 'imagen_banner', maxCount: 1 }]), [
  body('nombre').if(body('edit_user').not().exists() && body('edit_transfer').not().exists()).trim().notEmpty().withMessage('El nombre es requerido'),
  body('descripcion').if(body('edit_user').not().exists() && body('edit_transfer').not().exists()).trim().isLength({ min: 20 }).withMessage('La descripción debe tener al menos 20 caracteres'),
  body('direccion').if(body('edit_user').not().exists() && body('edit_transfer').not().exists()).trim().notEmpty().withMessage('La dirección es requerida'),
  body('telefono').if(body('edit_user').not().exists() && body('edit_transfer').not().exists()).trim().notEmpty().withMessage('El teléfono es requerido'),
  body('email_contacto').if(body('edit_user').not().exists() && body('edit_transfer').not().exists()).trim().isEmail().withMessage('Email de contacto inválido'),
  body('horario_apertura')
    .if(body('edit_user').not().exists() && body('edit_transfer').not().exists())
    .custom((value) => {
      if (!value) return true;
      if (!/^([0-1]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
        throw new Error('Formato de hora de apertura inválido (HH:MM o HH:MM:SS)');
      }
      return true;
    })
    .customSanitizer(v => (v && typeof v === 'string' ? v.slice(0,5) : v))
    .withMessage('Formato de hora de apertura inválido (HH:MM)'),
  body('horario_cierre')
    .if(body('edit_user').not().exists() && body('edit_transfer').not().exists())
    .custom((value) => {
      if (!value) return true;
      if (!/^([0-1]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
        throw new Error('Formato de hora de cierre inválido (HH:MM o HH:MM:SS)');
      }
      return true;
    })
    .customSanitizer(v => (v && typeof v === 'string' ? v.slice(0,5) : v))
    .withMessage('Formato de hora de cierre inválido (HH:MM)'),
  body('tiempo_entrega_min').if(body('edit_user').not().exists() && body('edit_transfer').not().exists()).customSanitizer(v => Number(v)).isInt({ min: 0 }).withMessage('Tiempo de entrega mínimo debe ser un número'),
  body('tiempo_entrega_max').if(body('edit_user').not().exists() && body('edit_transfer').not().exists()).customSanitizer(v => Number(v)).isInt({ min: 0 }).withMessage('Tiempo de entrega máximo debe ser un número'),
  body('costo_delivery').if(body('edit_user').not().exists() && body('edit_transfer').not().exists()).customSanitizer(v => Number(v)).isFloat({ min: 0 }).withMessage('Costo de delivery debe ser un número'),
  body('dias_operacion').if(body('edit_user').not().exists() && body('edit_transfer').not().exists()).notEmpty().withMessage('Debe seleccionar al menos un día de operación')
], async (req, res) => {
  // Verificar tipo de edición
  if (req.body.edit_user) {
    return await handleUserUpdate(req, res);
  } else if (req.body.edit_transfer) {
    return await handleTransferUpdate(req, res);
  } else {
    return await handleRestaurantSettingsUpdate(req, res);
  }
});

// Función para manejar actualización de datos de usuario
async function handleUserUpdate(req, res) {
  try {
    const userId = req.session.user.id;
    const { user_nombre, user_apellido, user_email, user_telefono, user_ciudad, recibir_notificaciones, email_notif_nuevo_pedido } = req.body;

    // Validar datos del usuario
    if (!user_nombre || !user_apellido || !user_email) {
      return res.status(400).json({ success: false, message: 'Nombre, apellido y email son requeridos' });
    }

    // Actualizar datos del usuario
    await db.execute(`
      UPDATE usuarios SET
        nombre = ?, apellido = ?, email = ?, telefono = ?, ciudad = ?, recibir_notificaciones = ?, email_notif_nuevo_pedido = ?
      WHERE id = ?
    `, [
      user_nombre,
      user_apellido,
      user_email,
      user_telefono || null,
      user_ciudad || null,
      recibir_notificaciones === 'on' ? 1 : 0,
      email_notif_nuevo_pedido === 'on' ? 1 : 0,
      userId
    ]);
    req.session.user.recibir_notificaciones = recibir_notificaciones === 'on' ? 1 : 0;
    req.session.user.email_notif_nuevo_pedido = email_notif_nuevo_pedido === 'on' ? 1 : 0;

    // Actualizar datos del usuario en la sesión
    req.session.user.nombre = user_nombre;
    req.session.user.apellido = user_apellido;
    req.session.user.email = user_email;
    req.session.user.telefono = user_telefono || null;
    req.session.user.ciudad = user_ciudad || null;
    req.session.user.recibir_notificaciones = recibir_notificaciones === 'on' ? 1 : 0;

    // Save the session explicitly to ensure changes are persisted
    req.session.save(err => {
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).json({ success: false, message: 'Error interno del servidor al guardar la sesión' });
      }
  
      res.json({
        success: true,
        message: 'Datos del usuario actualizados exitosamente',
        updatedUser: { // Return updated user data for client-side update
          nombre: user_nombre,
          apellido: user_apellido,
          email: user_email,
          telefono: user_telefono || null,
          ciudad: user_ciudad || null,
          recibir_notificaciones: recibir_notificaciones === 'on' ? 1 : 0,
          email_notif_nuevo_pedido: email_notif_nuevo_pedido === 'on' ? 1 : 0
        }
      });
    });

  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar datos del usuario' });
  }
}

// Función para manejar configuración del restaurante
// Función para manejar actualización de datos de transferencia
async function handleTransferUpdate(req, res) {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT * FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;
    const { datos_transferencia_cbu, datos_transferencia_alias, datos_transferencia_titular, datos_transferencia_dni } = req.body;
    await db.execute(`
      UPDATE restaurantes SET
        datos_transferencia_cbu = ?,
        datos_transferencia_alias = ?,
        datos_transferencia_titular = ?,
        datos_transferencia_dni = ?
      WHERE id = ?
    `, [
      datos_transferencia_cbu || null,
      datos_transferencia_alias || null,
      datos_transferencia_titular || null,
      datos_transferencia_dni || null,
      restaurantId
    ]);
    res.json({ success: true, message: 'Datos de transferencia actualizados exitosamente' });
  } catch (error) {
    console.error('Error updating transfer data:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar datos de transferencia' });
  }
}

router.post('/settings/discount', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
    const { ofrece_descuento_efectivo } = req.body;
    const userId = req.session.user.id;

    try {
        const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
        if (restaurants.length === 0) {
            return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
        }
        const restaurantId = restaurants[0].id;

        await db.execute('UPDATE restaurantes SET ofrece_descuento_efectivo = ? WHERE id = ?', [ofrece_descuento_efectivo, restaurantId]);

        res.json({ success: true, message: 'Configuración de descuento actualizada exitosamente.' });
    } catch (error) {
        console.error('Error updating discount setting:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar la configuración de descuento.' });
    }
});

async function handleRestaurantSettingsUpdate(req, res) {
  const connection = await db.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg);
      return res.status(400).json({ success: false, message: 'Errores de validación', errors: errorMessages });
    }

    const userId = req.session.user.id;
    
    const [restaurants] = await connection.execute('SELECT * FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    const {
      nombre, descripcion, direccion, telefono, email_contacto,
      horario_apertura, horario_cierre, tiempo_entrega_min,
      tiempo_entrega_max, costo_delivery,
      dias_operacion, mp_public_key, latitud, longitud
    } = req.body;

    let emailUpdated = false;
    if (email_contacto && email_contacto !== req.session.user.email) {
      // Verificar si el email ya existe en otro usuario
      const [existingEmail] = await connection.execute(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [email_contacto, userId]
      );

      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado por otro usuario. Por favor, utiliza un email diferente.'
        });
      }

      await connection.execute('UPDATE usuarios SET email = ? WHERE id = ?', [email_contacto, userId]);
      req.session.user.email = email_contacto;
      emailUpdated = true;
    }

    // Validar que dias_operacion sea un array válido
    let diasOperacionArray = [];
    if (Array.isArray(dias_operacion)) {
      diasOperacionArray = dias_operacion;
    } else if (typeof dias_operacion === 'string') {
      try {
        diasOperacionArray = JSON.parse(dias_operacion);
      } catch (e) {
        console.error('Error parsing dias_operacion:', e);
        return res.status(400).json({ success: false, message: 'Formato de días de operación inválido' });
      }
    }

    if (diasOperacionArray.length === 0) {
      return res.status(400).json({ success: false, message: 'Debe seleccionar al menos un día de operación' });
    }

    let logoPath = restaurants[0].imagen_logo;
    let bannerPath = restaurants[0].imagen_banner;

    if (req.files && req.files.imagen_logo && req.files.imagen_logo[0]) {
      logoPath = `/uploads/${req.files.imagen_logo[0].filename}`;
    }
    if (req.files && req.files.imagen_banner && req.files.imagen_banner[0]) {
      bannerPath = `/uploads/${req.files.imagen_banner[0].filename}`;
    }

    // Convertir dias_operacion a JSON string
    const diasOperacionJSON = JSON.stringify(diasOperacionArray.map(Number));

    await connection.execute(`
      UPDATE restaurantes SET
        nombre = ?, descripcion = ?, direccion = ?, telefono = ?, email_contacto = ?,
        horario_apertura = ?, horario_cierre = ?, tiempo_entrega_min = ?,
        tiempo_entrega_max = ?, costo_delivery = ?,
        imagen_logo = ?, imagen_banner = ?, dias_operacion = ?, mp_public_key = ?,
        latitud = ?, longitud = ?
      WHERE id = ?
    `, [
      nombre || null,
      descripcion || null,
      direccion || null,
      telefono || null,
      email_contacto || null,
      horario_apertura || null,
      horario_cierre || null,
      tiempo_entrega_min || null,
      tiempo_entrega_max || null,
      costo_delivery || null,
      logoPath || null,
      bannerPath || null,
      diasOperacionJSON || null,
      mp_public_key || null,
      latitud || null,
      longitud || null,
      restaurantId
    ]);


    // Siempre responder JSON para ser compatible con fetch desde el frontend
    const sendResponse = () => {
      if (!res.headersSent) {
        return res.json({ success: true, message: 'Configuración del restaurante actualizada exitosamente' });
      }
    };

    if (emailUpdated) {
      req.session.save(err => {
        if (err) {
          console.error('Error saving session:', err);
          if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Error interno del servidor al guardar la sesión' });
          }
          return;
        }
    
        sendResponse();
      });
    } else {
      sendResponse();
    }
  } catch (error) {
    console.error('Error updating restaurant settings:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar configuración del restaurante' });
    }
  } finally {
    connection.release();
  }
}

// --- Gestión de Productos ---
router.get('/products', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { search, categoria, disponible } = req.query;

    let sql = `
      SELECT p.*, cp.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.restaurante_id = ?
    `;
    let countSql = `
      SELECT COUNT(*) as total_count
      FROM productos p
      WHERE p.restaurante_id = ?
    `;
    const filterValues = [restaurantId];

    if (search && search !== '') {
      sql += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ?)`;
      countSql += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ?)`;
      filterValues.push(`%${search}%`, `%${search}%`);
    }
    if (categoria && categoria !== '') {
      sql += ` AND p.categoria_id = ?`;
      countSql += ` AND p.categoria_id = ?`;
      filterValues.push(categoria);
    }
    if (disponible !== undefined && disponible !== '') {
      sql += ` AND p.disponible = ?`;
      countSql += ` AND p.disponible = ?`;
      filterValues.push(disponible === 'true' ? 1 : 0);
    }

    sql += ` ORDER BY p.destacado DESC, p.nombre LIMIT ${offset}, ${limit}`;

    const queryParams = [...filterValues];
    const countQueryParams = [...filterValues];

    // Validación y logs de depuración
    if (
      !restaurantId || isNaN(Number(restaurantId)) ||
      !limit || isNaN(Number(limit)) ||
      offset === undefined || isNaN(Number(offset))
    ) {
      throw new Error('Parámetros inválidos para consulta de productos: ' + JSON.stringify({restaurantId, limit, offset, queryParams}));
    }

    const [productos] = await db.execute(sql, queryParams);
    const [totalCountResult] = await db.execute(countSql, countQueryParams);
    const totalProductos = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalProductos / limit);

    // Obtener categorías de productos para este restaurante
    const [categorias] = await db.execute(`
      SELECT id, nombre, orden_display FROM categorias_productos WHERE restaurante_id = ? OR restaurante_id IS NULL ORDER BY orden_display, nombre
    `, [restaurantId]);

    res.render('dashboard/products', {
      title: 'Productos del Restaurante - A la Mesa',
      user: req.session.user,
      products: productos,
      globalCategories: categorias,
      filtros: { search: search || '', categoria: categoria || '', disponible: disponible || '' },
      currentPage: page,
      totalPages,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
    isDashboardPage: true,
      scripts: ['/js/dashboard/dashboard-products.js'],
      activePage: 'productos'
    });
  } catch (error) {
    console.error('Error en productos del restaurante:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando los productos del restaurante',
      error: {}
    });
  }
});

// Obtener un producto por ID (para editar)
router.get('/products/:id', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user.id;

    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(403).json({ success: false, message: 'No tienes un restaurante asignado.' });
    }
    const restaurantId = restaurants[0].id;

    const [products] = await db.execute('SELECT * FROM productos WHERE id = ? AND restaurante_id = ?', [productId, restaurantId]);

    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado o no pertenece a tu restaurante.' });
    }

    res.json({ success: true, product: products[0] });
  } catch (error) {
    console.error('Error al obtener datos del producto:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
});

// Añadir Producto
router.post('/products/add', requireRestaurant, requireVerifiedRestaurant, uploadProductImage.single('imagen'), [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
  body('precio').isFloat({ gt: 0 }).withMessage('El precio debe ser un número positivo'),
  body('categoria_id').isInt().withMessage('Selecciona una categoría válida')
], async (req, res) => {
  console.log('Products ADD request received');
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  console.log('Request headers:', req.headers);
  
  const connection = await db.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
      return res.status(400).json({ success: false, message: 'Errores de validación', errors: errorMessages });
    }

    const userId = req.session.user.id;
    
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
        return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    const { nombre, descripcion, precio, precio_descuento, categoria_id, destacado, disponible } = req.body;
    let imagenPath = null;
    if (req.file) {
      imagenPath = `/uploads/productos/${req.file.filename}`;
      }

    await connection.execute(`
      INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, precio_descuento, imagen, destacado, disponible)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      restaurantId,
      categoria_id,
      nombre,
      descripcion,
      precio,
      precio_descuento || null,
      imagenPath,
      destacado ? 1 : 0,
      disponible ? 1 : 0
    ]);

    res.json({ success: true, message: 'Producto agregado exitosamente' });
  } catch (error) {
    console.error('Error agregando producto:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al agregar producto' });
  } finally {
    connection.release();
  }
});

// Editar Producto
router.post('/products/edit/:id', requireRestaurant, requireVerifiedRestaurant, uploadProductImage.single('imagen'), [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
  body('precio').isFloat({ gt: 0 }).withMessage('El precio debe ser un número positivo'),
  body('categoria_id').isInt().withMessage('Selecciona una categoría válida')
], async (req, res) => {
  const connection = await db.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg);
      return res.status(400).json({ success: false, message: 'Errores de validación', errors: errorMessages });
    }

    const productId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify product belongs to this restaurant
    const [product] = await connection.execute('SELECT * FROM productos WHERE id = ? AND restaurante_id = ?', [productId, restaurantId]);
    if (product.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado o no pertenece a tu restaurante' });
    }

    const { nombre, descripcion, precio, precio_descuento, categoria_id, destacado, disponible } = req.body;
    let imagenPath = product[0].imagen; // Keep existing image if no new one is uploaded

    if (req.file) {
      // Delete old image if it exists and is not a default
      if (imagenPath && !imagenPath.startsWith('/images/')) {
        const relativeImg = imagenPath.replace(/^\//, '');
        const oldImagePath = path.join(__dirname, '..', 'public', relativeImg);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      imagenPath = `/uploads/productos/${req.file.filename}`;
    }

    await connection.execute(`
      UPDATE productos SET
        nombre = ?, descripcion = ?, precio = ?, precio_descuento = ?, categoria_id = ?, imagen = ?, destacado = ?, disponible = ?
      WHERE id = ? AND restaurante_id = ?
    `, [
      nombre,
      descripcion,
      precio,
      precio_descuento || null,
      categoria_id,
      imagenPath,
      destacado ? 1 : 0,
      disponible ? 1 : 0,
      productId,
      restaurantId
    ]);

    res.json({ success: true, message: 'Producto actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar producto' });
  } finally {
    connection.release();
  }
});

// Eliminar Producto
router.delete('/products/:id', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const productId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify product belongs to this restaurant
    const [product] = await connection.execute('SELECT * FROM productos WHERE id = ? AND restaurante_id = ?', [productId, restaurantId]);
    if (product.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado o no pertenece a tu restaurante' });
    }

    // Delete image file if it exists and is not a default
    if (product[0].imagen && !product[0].imagen.startsWith('/images/')) {
      const imagePath = path.join(__dirname, '..', 'public', product[0].imagen);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await connection.execute('DELETE FROM productos WHERE id = ? AND restaurante_id = ?', [productId, restaurantId]);

    res.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al eliminar producto' });
  } finally {
    connection.release();
  }
});

// Cambiar disponibilidad de Producto
router.put('/products/:id/availability', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const productId = req.params.id;
    const { disponible } = req.body;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify product belongs to this restaurant
    const [product] = await connection.execute('SELECT disponible FROM productos WHERE id = ? AND restaurante_id = ?', [productId, restaurantId]);
    if (product.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado o no pertenece a tu restaurante' });
    }

    const newAvailability = disponible === 'true' ? 1 : 0;
    await connection.execute('UPDATE productos SET disponible = ? WHERE id = ?', [newAvailability, productId]);

    res.json({ success: true, message: 'Disponibilidad del producto actualizada', disponible: newAvailability });
  } catch (error) {
    console.error('Error toggling product availability:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar disponibilidad' });
  } finally {
    connection.release();
  }
});

// Cambiar estado destacado de Producto
router.put('/products/:id/featured', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const productId = req.params.id;
    const { destacado } = req.body;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify product belongs to this restaurant
    const [product] = await connection.execute('SELECT destacado FROM productos WHERE id = ? AND restaurante_id = ?', [productId, restaurantId]);
    if (product.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado o no pertenece a tu restaurante' });
    }

    const newFeatured = destacado === 'true' ? 1 : 0;
    await connection.execute('UPDATE productos SET destacado = ? WHERE id = ?', [newFeatured, productId]);

    res.json({ success: true, message: 'Estado destacado del producto actualizado', destacado: newFeatured });
  } catch (error) {
    console.error('Error toggling product featured status:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar estado destacado' });
  } finally {
    connection.release();
  }
});

// --- Gestión de Repartidores ---
router.get('/drivers', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    const [drivers] = await db.execute(`
      SELECT u.id as user_id, u.nombre, u.apellido, u.email, u.telefono, d.id, d.vehicle_type, d.status, d.request_status
      FROM usuarios u
      JOIN drivers d ON u.id = d.user_id
      WHERE d.restaurante_id = ? AND d.request_status = 'accepted' AND u.activo = 1
      ORDER BY u.nombre ASC
    `, [restaurantId]);
    console.log('Drivers:', drivers);

    res.render('dashboard/drivers', {
      title: 'Repartidores - A la Mesa',
      user: req.session.user,
      drivers,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
    isDashboardPage: true,
      activePage: 'conductores',
      scripts: ['/js/dashboard/dashboard-drivers.js']
    });
  } catch (error) {
    console.error('Error en gestión de repartidores:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando la sección de repartidores',
      error: {}
    });
  }
});

// Ruta para ver solicitudes de repartidores
router.get('/driver-requests', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    const [pendingDrivers] = await db.execute(`
      SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, d.vehicle_type, d.request_status
      FROM usuarios u
      JOIN drivers d ON u.id = d.user_id
      WHERE d.restaurante_id = ? AND d.request_status = 'pending'
      ORDER BY u.nombre ASC
    `, [restaurantId]);

    res.render('dashboard/driver-requests', {
      title: 'Solicitudes de Repartidores - A la Mesa',
      user: req.session.user,
      pendingDrivers,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
      isDashboardPage: true,
      activePage: 'driver-requests',
      hideFooterBeneficios: true
    });
  } catch (error) {
    console.error('Error en solicitudes de repartidores:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando las solicitudes de repartidores',
      error: {}
    });
  }
});

router.post('/drivers/add', requireRestaurant, requireVerifiedRestaurant, [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
  body('apellido').trim().notEmpty().withMessage('El apellido es requerido'),
  body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('vehicle_type').trim().notEmpty().withMessage('El tipo de vehículo es requerido')
], async (req, res) => {
  const connection = await db.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
      return res.status(400).json({ success: false, message: 'Errores de validación', errors: errorMessages });
    }

    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    const { nombre, apellido, email, password, telefono, vehicle_type } = req.body;

    // Check if email already exists
    const [existingUser] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'El email ya está registrado' });
    }

    await connection.beginTransaction();

    // Create user with 'repartidor' role
    const hashedPassword = await bcrypt.hash(password, 10);
    const [userResult] = await connection.execute(
      `INSERT INTO usuarios (nombre, apellido, email, password, tipo_usuario, telefono)
       VALUES (?, ?, ?, ?, 'repartidor', ?)`
      , [nombre, apellido, email, hashedPassword, telefono || null]
    );
    const newUserId = userResult.insertId;

    // Create driver entry
    await connection.execute(
      `INSERT INTO drivers (user_id, restaurante_id, vehicle_type, request_status, status)
       VALUES (?, ?, ?, 'accepted', 'offline')`
      , [newUserId, restaurantId, vehicle_type]
    );

    await connection.commit();

    res.json({ success: true, message: 'Repartidor añadido exitosamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error adding driver:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al añadir repartidor: ' + error.message });
  } finally {
    connection.release();
  }
});

// Ruta para aprobar una solicitud de repartidor
router.post('/driver-requests/:id/approve', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const driverUserId = req.params.id;
    const userId = req.session.user.id; // User ID of the restaurant owner

    const [restaurants] = await connection.execute('SELECT id, nombre FROM restaurantes WHERE usuario_id = ?', [userId]); // Fetch restaurant name
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;
    const restaurantName = restaurants[0].nombre; // Get restaurant name

    // Verify the driver request belongs to this restaurant and is pending
    const [driverRequest] = await connection.execute(
      'SELECT * FROM drivers WHERE user_id = ? AND restaurante_id = ? AND request_status = \'pending\'',
      [driverUserId, restaurantId]
    );

    if (driverRequest.length === 0) {
      return res.status(404).json({ success: false, message: 'Solicitud de repartidor no encontrada o no pendiente para este restaurante.' });
    }

    await connection.beginTransaction();

    // Update driver status to accepted and set initial status to 'offline'
    await connection.execute(
      'UPDATE drivers SET request_status = \'accepted\', status = \'offline\' WHERE user_id = ? AND restaurante_id = ?',
      [driverUserId, restaurantId]
    );

    // Optionally, update the user's 'activo' status if they were inactive
    await connection.execute(
      'UPDATE usuarios SET activo = 1 WHERE id = ? AND tipo_usuario = \'repartidor\'',
      [driverUserId]
    );

    await connection.commit();

    // Fetch driver's email and name for notification
    const [driverUser] = await db.execute('SELECT nombre, email FROM usuarios WHERE id = ?', [driverUserId]);
    if (driverUser.length > 0) {
        await sendEmail(
            driverUser[0].email,
            '¡Tu Solicitud de Repartidor ha sido Aprobada!',
            'driver-request-approved',
            {
                nombre: driverUser[0].nombre,
                restauranteNombre: restaurantName,
                loginLink: `${process.env.BASE_URL}/auth/login` // Assuming BASE_URL is available
            }
        );
    }

    res.json({ success: true, message: 'Solicitud de repartidor aprobada exitosamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error aprobando solicitud de repartidor:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al aprobar solicitud.' });
  } finally {
    connection.release();
  }
});

// Ruta para rechazar una solicitud de repartidor
router.post('/driver-requests/:id/reject', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const driverUserId = req.params.id;
    const userId = req.session.user.id; // User ID of the restaurant owner

    const [restaurants] = await connection.execute('SELECT id, nombre FROM restaurantes WHERE usuario_id = ?', [userId]); // Fetch restaurant name
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;
    const restaurantName = restaurants[0].nombre; // Get restaurant name

    // Verify the driver request belongs to this restaurant and is pending
    const [driverRequest] = await connection.execute(
      'SELECT * FROM drivers WHERE user_id = ? AND restaurante_id = ? AND request_status = \'pending\'',
      [driverUserId, restaurantId]
    );

    if (driverRequest.length === 0) {
      return res.status(404).json({ success: false, message: 'Solicitud de repartidor no encontrada o no pendiente para este restaurante.' });
    }

    await connection.beginTransaction();

    // Update driver status to rejected
    await connection.execute(
      'UPDATE drivers SET request_status = \'rejected\' WHERE user_id = ? AND restaurante_id = ?',
      [driverUserId, restaurantId]
    );

    // Optionally, you might want to delete the driver entry or user if rejected permanently
    // For now, just setting status to 'rejected'

    await connection.commit();

    // Fetch driver's email and name for notification
    const [driverUser] = await db.execute('SELECT nombre, email FROM usuarios WHERE id = ?', [driverUserId]);
    if (driverUser.length > 0) {
        await sendEmail(
            driverUser[0].email,
            'Actualización de tu Solicitud de Repartidor',
            'driver-request-rejected',
            {
                nombre: driverUser[0].nombre,
                restauranteNombre: restaurantName
            }
        );
    }

    res.json({ success: true, message: 'Solicitud de repartidor rechazada exitosamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error rechazando solicitud de repartidor:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al rechazar solicitud.' });
  } finally {
    connection.release();
  }
});

// Ruta para editar un repartidor
router.put('/drivers/:id/edit', requireRestaurant, requireVerifiedRestaurant, upload.none(), [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
  body('apellido').trim().notEmpty().withMessage('El apellido es requerido'),
  body('email').trim().isEmail().withMessage('Email inválido').normalizeEmail(),
  body('vehicle_type').trim().notEmpty().withMessage('El tipo de vehículo es requerido'),
  body('status').isIn(['available', 'on_delivery', 'offline']).withMessage('Estado inválido')
], async (req, res) => {
  const connection = await db.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg);
      return res.status(400).json({ success: false, message: 'Errores de validación', errors: errorMessages });
    }

    const driverId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    const { nombre, apellido, email, telefono, vehicle_type, status } = req.body;

    await connection.beginTransaction();

    // Update user data
    await connection.execute(
      "UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, telefono = ? WHERE id = ? AND tipo_usuario = 'repartidor'",
      [nombre, apellido, email, telefono || null, driverId]
    );

    // Update driver data
    await connection.execute(
      'UPDATE drivers SET restaurante_id = ?, vehicle_type = ?, status = ? WHERE user_id = ?',
      [restaurantId, vehicle_type, status, driverId]
    );

    await connection.commit();

    res.json({ success: true, message: 'Repartidor actualizado exitosamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating driver:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar repartidor' });
  } finally {
    connection.release();
  }
});

// Ruta para ver detalles de un repartidor
router.get('/driver/:id', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const driverId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    // Get driver details
    const [drivers] = await db.execute(`
      SELECT u.*, d.vehicle_type, d.status, d.request_status, d.created_at as driver_created_at
      FROM usuarios u
      JOIN drivers d ON u.id = d.user_id
      WHERE u.id = ? AND d.restaurante_id = ?
    `, [driverId, restaurantId]);

    if (drivers.length === 0) {
      return res.status(404).render('error', {
        title: 'Repartidor No Encontrado',
        message: 'El repartidor que buscas no existe o no pertenece a tu restaurante',
        error: {}
      });
    }

    const driver = drivers[0];

    // Get driver's order statistics
    const [orderStats] = await db.execute(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN estado = 'entregado' THEN 1 ELSE 0 END) as completed_orders,
        AVG(calificacion_repartidor) as avg_rating,
        COUNT(calificacion_repartidor) as total_ratings
      FROM pedidos
      WHERE repartidor_id = ? AND estado != 'cancelado'
    `, [driverId]);

    const stats = orderStats[0];

    // Get recent orders for this driver
    const [recentOrders] = await db.execute(`
      SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.repartidor_id = ? AND p.estado != 'cancelado'
      ORDER BY p.fecha_pedido DESC
      LIMIT 10
    `, [driverId]);

    res.render('dashboard/driver-detail', {
      title: `Repartidor ${driver.nombre} ${driver.apellido} - A la Mesa`,
      user: req.session.user,
      driver,
      stats,
      recentOrders,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
      isDashboardPage: true,
      activePage: 'conductores'
    });
  } catch (error) {
    console.error('Error en detalles del repartidor:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando los detalles del repartidor',
      error: {}
    });
  }
});

// Ruta para eliminar un repartidor
router.delete('/drivers/:id/delete', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const driverId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    await connection.beginTransaction();

    // Delete driver entry
    await connection.execute('DELETE FROM drivers WHERE user_id = ? AND restaurante_id = ?', [driverId, restaurantId]);

    // Delete user entry
    await connection.execute("DELETE FROM usuarios WHERE id = ? AND tipo_usuario = 'repartidor'", [driverId]);

    await connection.commit();

    res.json({ success: true, message: 'Repartidor eliminado exitosamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting driver:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al eliminar repartidor' });
  } finally {
    connection.release();
  }
});

// --- Gestión de Categorías de Productos ---
router.get('/product-categories', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    const [categories] = await db.execute(`
      SELECT * FROM categorias_productos
      WHERE restaurante_id = ? OR restaurante_id IS NULL
      ORDER BY orden_display, nombre
    `, [restaurantId]);

    res.render('dashboard/product-categories', {
      title: 'Categorías de Productos - A la Mesa',
      user: req.session.user,
      categories,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
    isDashboardPage: true,
      activePage: 'categorias'
    });
  } catch (error) {
    console.error('Error en categorías de productos:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando las categorías de productos',
      error: {}
    });
  }
});

// Añadir Categoría de Producto
router.post('/product-categories/add', requireRestaurant, requireVerifiedRestaurant, upload.none(), [
  body('nombre').trim().notEmpty().withMessage('El nombre de la categoría es requerido')
], async (req, res) => {
  const connection = await db.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg);
      return res.status(400).json({ success: false, message: 'Errores de validación', errors: errorMessages });
    }

    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    const { nombre, orden_display } = req.body;

    await connection.execute(`
      INSERT INTO categorias_productos (restaurante_id, nombre, orden_display)
      VALUES (?, ?, ?)
    `, [restaurantId, nombre, orden_display || 0]);

    res.json({ success: true, message: 'Categoría agregada exitosamente' });
  } catch (error) {
    console.error('Error agregando categoría de producto:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al agregar categoría' });
  } finally {
    connection.release();
  }
});

// Editar Categoría de Producto
router.post('/product-categories/edit/:id', requireRestaurant, requireVerifiedRestaurant, upload.none(), [
  body('nombre').trim().notEmpty().withMessage('El nombre de la categoría es requerido')
], async (req, res) => {
  const connection = await db.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg);
      return res.status(400).json({ success: false, message: 'Errores de validación', errors: errorMessages });
    }

    const categoryId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify category belongs to this restaurant or is a global category
    const [category] = await connection.execute('SELECT * FROM categorias_productos WHERE id = ? AND (restaurante_id = ? OR restaurante_id IS NULL)', [categoryId, restaurantId]);
    if (category.length === 0) {
      return res.status(404).json({ success: false, message: 'Categoría no encontrada o no pertenece a tu restaurante' });
    }

    const { nombre, orden_display } = req.body;

    await connection.execute(`
      UPDATE categorias_productos SET
        nombre = ?, orden_display = ?
      WHERE id = ?
    `, [nombre, orden_display || 0, categoryId]);

    res.json({ success: true, message: 'Categoría actualizada exitosamente' });
  } catch (error) {
    console.error('Error actualizando categoría de producto:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar categoría' });
  } finally {
    connection.release();
  }
});

// Eliminar Categoría de Producto
router.post('/product-categories/delete/:id', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const categoryId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify category belongs to this restaurant
    const [category] = await connection.execute('SELECT * FROM categorias_productos WHERE id = ? AND restaurante_id = ?', [categoryId, restaurantId]);
    if (category.length === 0) {
      return res.status(404).json({ success: false, message: 'Categoría no encontrada o no pertenece a tu restaurante' });
    }

    // Check if there are products associated with this category
    const [productsCount] = await connection.execute('SELECT COUNT(*) as count FROM productos WHERE categoria_id = ?', [categoryId]);
    if (productsCount[0].count > 0) {
      return res.status(400).json({ success: false, message: 'No se puede eliminar la categoría porque tiene productos asociados. Reasigna los productos antes de eliminar.' });
    }

    await connection.execute('DELETE FROM categorias_productos WHERE id = ?', [categoryId]);

    res.json({ success: true, message: 'Categoría eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando categoría de producto:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al eliminar categoría' });
  } finally {
    connection.release();
  }
});

router.get('/cobros-semanales', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    // Obtener el link de Mercado Pago de la tabla configuraciones
    const [configRows] = await db.execute("SELECT valor FROM configuraciones WHERE clave = 'mercadopago_url' LIMIT 1");
    const mercadopagoUrl = configRows.length > 0 ? configRows[0].valor : '';

    // Obtener cobros semanales para este restaurante
    const [cobros] = await db.execute(`
      SELECT cs.*,
             (SELECT COUNT(*) FROM comprobantes_pago WHERE cobro_semanal_id = cs.id) as comprobantes_count
      FROM cobros_semanales cs
      WHERE cs.restaurante_id = ?
      ORDER BY cs.semana_inicio DESC
    `, [restaurantId]);

    res.render('dashboard/cobros-semanales', {
      title: 'Cobros Semanales - A la Mesa',
      user: req.session.user,
      cobros,
      mercadopagoUrl, // <-- HERE IT IS
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
      isDashboardPage: true,
      activePage: 'cobros'
    });
  } catch (error) {
    console.error('Error en cobros semanales:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando los cobros semanales',
      error: {}
    });
  }
});

// Ruta para subir comprobante de pago
router.post('/cobros/upload-comprobante', requireRestaurant, requireVerifiedRestaurant, (req, res) => {
    uploadRestaurantComprobante(req, res, async function (err) {
        if (err) {
            console.error('Error subiendo comprobante:', err);
            return res.status(500).send('Error al subir el archivo.');
        }

        const { cobroId, montoPagado } = req.body;
        const comprobanteUrl = '/uploads/comprobantes_restaurantes/' + req.file.filename;

        try {
            const userId = req.session.user.id;
            const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
            if (restaurants.length === 0) {
                return res.status(403).send('No autorizado.');
            }
            const restaurantId = restaurants[0].id;

            // Verificar que el cobro pertenece al restaurante
            const [cobros] = await db.execute('SELECT * FROM cobros_semanales WHERE id = ? AND restaurante_id = ?', [cobroId, restaurantId]);
            if (cobros.length === 0) {
                return res.status(403).send('No autorizado para este cobro.');
            }

            await db.execute(
                'INSERT INTO comprobantes_pago (cobro_semanal_id, restaurante_id, archivo_comprobante, metodo_pago, monto_pagado, estado, fecha_pago_declarada) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                [cobroId, restaurantId, comprobanteUrl, 'transferencia', cobro[0].monto_comision, 'pendiente']
            );

            res.redirect('/dashboard/cobros-semanales?upload=success');
        } catch (error) {
            console.error('Error guardando comprobante:', error);
            res.status(500).send('Error al guardar el comprobante.');
        }
    });
});

// --- Gestión de Pedidos ---'''
router.get('/orders', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { status, search, date } = req.query;

    let sql = `
      SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido, u.telefono as cliente_telefono
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.restaurante_id = ? AND p.estado NOT IN ('pendiente_pago', 'pago_cancelado')
    `;
    let countSql = `
      SELECT COUNT(*) as total_count
      FROM pedidos
      WHERE restaurante_id = ? AND estado NOT IN ('pendiente_pago', 'pago_cancelado')
    `;
    const filterValues = [restaurantId];

    if (status && status !== 'todos') {
      sql += ` AND p.estado = ?`;
      countSql += ` AND p.estado = ?`;
      filterValues.push(status);
    } else {
      // Si no se especifica un estado, incluir todos los estados activos
      sql += ` AND p.estado IN ('pendiente', 'confirmado', 'preparando', 'en_camino')`;
      countSql += ` AND estado IN ('pendiente', 'confirmado', 'preparando', 'en_camino')`;
    }
    if (search) {
      sql += ` AND (u.nombre LIKE ? OR u.apellido LIKE ?)`;
      countSql += ` AND (u.nombre LIKE ? OR u.apellido LIKE ?)`;
      filterValues.push(`%${search}%`, `%${search}%`);
    }
    if (date) {
      // Convert dd/mm/aaaa to aaaa-mm-dd if necessary
      let dateSQL = date;
      if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(date)) {
        const [d, m, y] = date.split('/');
        dateSQL = `${y}-${m}-${d}`;
      }
      sql += ` AND DATE(p.fecha_pedido) = ?`;
      countSql += ` AND DATE(p.fecha_pedido) = ?`;
      filterValues.push(dateSQL);
    }

    sql += ` ORDER BY p.fecha_pedido DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

    const queryParams = [...filterValues];
    const countQueryParams = [...filterValues];

    // Validación y logs de depuración
    if (
      !restaurantId || isNaN(Number(restaurantId)) ||
      !limit || isNaN(Number(limit)) ||
      offset === undefined || isNaN(Number(offset))
    ) {
      throw new Error('Parámetros inválidos para consulta de pedidos: ' + JSON.stringify({restaurantId, limit, offset, queryParams}));
    }

    const [pedidos] = await db.execute(sql, queryParams);
    const [totalCountResult] = await db.execute(countSql, countQueryParams);
    const totalPedidos = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalPedidos / limit);

    // Obtener datos del restaurante para la vista
    const [restaurantRows] = await db.execute('SELECT * FROM restaurantes WHERE id = ?', [restaurantId]);
    const restaurant = restaurantRows[0] || {};

    

    // Paginación para historial de pedidos
    const historicalPage = parseInt(req.query.historicalPage) || 1;
    const historicalLimit = 10; // 10 pedidos por página para el historial
    const historicalOffset = (historicalPage - 1) * historicalLimit;

    let historicalSql = `
        SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido, u.telefono as cliente_telefono
        FROM pedidos p
        JOIN usuarios u ON p.cliente_id = u.id
        WHERE p.restaurante_id = ? AND p.estado IN ('entregado', 'cancelado')
    `;
    let historicalCountSql = `
        SELECT COUNT(*) as total_count
        FROM pedidos
        WHERE restaurante_id = ? AND estado IN ('entregado', 'cancelado')
    `;
    const historicalFilterValues = [restaurantId];

    historicalSql += ` ORDER BY p.fecha_pedido DESC LIMIT ${historicalLimit} OFFSET ${historicalOffset}`;

    const [historicalOrders] = await db.execute(historicalSql, historicalFilterValues);
    const [totalHistoricalCountResult] = await db.execute(historicalCountSql, historicalFilterValues);
    const totalHistoricalOrders = totalHistoricalCountResult[0].total_count;
    const totalHistoricalPages = Math.ceil(totalHistoricalOrders / historicalLimit);

    res.render('dashboard/orders', {
      title: 'Pedidos del Restaurante - A la Mesa',
      user: req.session.user,
      orders: pedidos,
      historicalOrders,
      historicalCurrentPage: historicalPage,
      totalHistoricalPages,
      historicalLimit,
      filtros: { status: status || '', search: search || '', date: date || '' },
      restaurant,
      currentPage: page,
      totalPages,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
    isDashboardPage: true,
      scripts: ['/js/dashboard-orders.js'],
      layout: 'layout',
      activePage: 'pedidos'
    });
  } catch (error) {
    console.error('Error en pedidos del restaurante:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando los pedidos del restaurante',
      error: {}
    });
  }
});

// Detalle de Pedido
router.get('/orders/:id', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    // Get order info
    const [orders] = await db.execute(`
      SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido, u.email as cliente_email, u.telefono as cliente_telefono,
        d.nombre as driver_nombre, d.apellido as driver_apellido, d.telefono as driver_telefono,
        dr.current_latitude as driver_lat, dr.current_longitude as driver_lng
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      LEFT JOIN usuarios d ON p.repartidor_id = d.id
      LEFT JOIN drivers dr ON p.repartidor_id = dr.id
      WHERE p.id = ? AND p.restaurante_id = ?
    `, [orderId, restaurantId]);

    if (orders.length === 0) {
      return res.status(404).render('error', {
        title: 'Pedido No Encontrado',
        message: 'El pedido que buscas no existe o no pertenece a tu restaurante',
        error: {}
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

    // Get available drivers (restaurant-specific and private)
    const [drivers] = await db.execute(`
      SELECT d.id, u.nombre, u.apellido, d.vehicle_type, d.status
      FROM usuarios u
      JOIN drivers d ON u.id = d.user_id
      WHERE u.tipo_usuario = 'repartidor' AND u.activo = 1
      AND (d.restaurante_id = ? OR d.restaurante_id IS NULL)
      ORDER BY u.nombre ASC
    `, [restaurantId]);

    // Get restaurant data for logo
    const [restaurantData] = await db.execute('SELECT * FROM restaurantes WHERE id = ?', [restaurantId]);
    const restaurant = restaurantData[0] || {};

    // Calcular si el chat debe estar disponible (menos de 14 horas desde el pedido)
    const orderTime = new Date(order.fecha_pedido);
    const currentTime = new Date();
    const hoursDiff = (currentTime - orderTime) / (1000 * 60 * 60); // Diferencia en horas
    const canChat = hoursDiff < 14;

    res.render('dashboard/order-detail', {
      title: `Pedido #${order.numero_pedido} - A la Mesa`,
      user: req.session.user,
      order,
      items,
      drivers,
      restaurant,
      canChat,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
    isDashboardPage: true,
      scripts: ['/js/dashboard/dashboard-orders-chat.js']
    });
  } catch (error) {
    console.error('Error en detalle de pedido:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el detalle del pedido',
      error: {}
    });
  }
});

// Obtener detalles de un pedido (para vista parcial)
router.get('/orders/:id/details', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user.id;
        const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
        if (restaurants.length === 0) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        const restaurantId = restaurants[0].id;

        const [orders] = await db.execute(`
            SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido, u.email as cliente_email, u.telefono as cliente_telefono,
                d.nombre as driver_nombre, d.apellido as driver_apellido, d.telefono as driver_telefono,
                dr.current_latitude as driver_lat, dr.current_longitude as driver_lng
            FROM pedidos p
            JOIN usuarios u ON p.cliente_id = u.id
            LEFT JOIN usuarios d ON p.repartidor_id = d.id
            LEFT JOIN drivers dr ON p.repartidor_id = dr.id
            WHERE p.id = ? AND p.restaurante_id = ?
        `, [orderId, restaurantId]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        const order = orders[0];

        const [items] = await db.execute(`
            SELECT ip.*, pr.nombre, pr.imagen
            FROM items_pedido ip
            JOIN productos pr ON ip.producto_id = pr.id
            WHERE ip.pedido_id = ?
        `, [orderId]);

        res.render('dashboard/partials/_order-detail-partial', { order, items, layout: false });

    } catch (error) {
        console.error('Error fetching order details partial:', error);
        res.status(500).send('<div class="alert alert-danger">Error al cargar los detalles del pedido.</div>');
    }
});


// Actualizar Estado de Pedido
router.post('/orders/:id/status', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const orderId = req.params.id;
    const { estado, repartidor_id } = req.body;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify order belongs to this restaurant
    const [order] = await connection.execute('SELECT * FROM pedidos WHERE id = ? AND restaurante_id = ?', [orderId, restaurantId]);
    if (order.length === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado o no pertenece a tu restaurante' });
    }

    const currentStatus = order[0].estado;
    if (estado === 'cancelado' && currentStatus !== 'pendiente') {
      return res.status(400).json({ success: false, message: 'No se puede cancelar un pedido que ya ha sido confirmado.' });
    }
    const validTransitions = {
      'pendiente': ['confirmado', 'cancelado'],
      'confirmado': ['preparando'],
      'preparando': ['en_camino', 'cancelado'],
      'en_camino': ['entregado', 'cancelado'],
      'entregado': [],
      'cancelado': []
    };

    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(estado)) {
      // Allow 'entregado' to 'entregado' to update driver
      if (currentStatus === 'entregado' && estado === 'entregado') {
        // Proceed to update driver only
      } else {
        return res.status(400).json({ success: false, message: `Transición de estado inválida de '${currentStatus}' a '${estado}'` });
      }
    }

    // Lógica de asignación de repartidor al pasar a 'en_camino'
    if (estado === 'en_camino' && !repartidor_id) {
        // Obtener todos los repartidores (propios del restaurante + independientes), sin filtrar por disponibilidad
        const [todosRepartidores] = await connection.execute(
            "SELECT d.id, u.nombre, u.apellido, d.status, CASE WHEN d.restaurante_id = ? THEN 'propio' ELSE 'independiente' END as tipo FROM usuarios u JOIN drivers d ON u.id = d.user_id WHERE (d.restaurante_id = ? OR d.restaurante_id IS NULL) AND d.status IN ('available', 'offline') ORDER BY CASE WHEN d.restaurante_id = ? THEN 1 ELSE 2 END, u.nombre",
            [restaurantId, restaurantId, restaurantId]
        );

    if (todosRepartidores.length === 1) {
        // Asignar automáticamente si solo hay uno
        req.body.repartidor_id = todosRepartidores[0].id;
    } else if (todosRepartidores.length > 1) {
        // Necesita selección manual - mostrar todos los repartidores
            return res.json({ success: true, needsDriverSelection: true, drivers: todosRepartidores });
        } else {
            // No hay repartidores
            return res.json({ success: false, message: 'No hay repartidores disponibles.' });
        }
    }

    let updateQuery, queryParams;
    if (estado === 'confirmado') {
      // Automatically transition from 'confirmado' to 'preparando'
      updateQuery = 'UPDATE pedidos SET estado = ?';
      queryParams = ['preparando'];
    } else {
      updateQuery = 'UPDATE pedidos SET estado = ?';
      queryParams = [estado];
    }

    if (repartidor_id) {
      updateQuery += ', repartidor_id = ?';
      queryParams.push(repartidor_id);
    }

    updateQuery += ' WHERE id = ? AND restaurante_id = ?';
    queryParams.push(orderId, restaurantId);

    await connection.execute(updateQuery, queryParams);

    // Si el pedido se marca como entregado y tiene un repartidor, generar comisión
    if (estado === 'entregado' && order[0].repartidor_id) {
        const comisionMonto = 200; // Monto fijo de la comisión
        await connection.execute(
            'INSERT INTO comisiones (repartidor_id, pedido_id, monto, estado) VALUES (?, ?, ?, ?)',
            [order[0].repartidor_id, orderId, comisionMonto, 'pendiente']
        );
    }

    // Send push notification to client if status changes
    if (currentStatus !== estado) {
      await sendOrderStatusNotification(order[0].cliente_id, orderId, estado);
    }

    // Se ha comentado el envío de email para optimizar el tiempo de respuesta al cambiar el estado del pedido.
    // Enviar email al cliente si tiene activas las notificaciones
    /* try {
      const [rows] = await connection.execute(`
        SELECT u.email, u.nombre, u.apellido, u.recibir_notificaciones, p.numero_pedido, p.metodo_pago,
               r.nombre AS restaurante_nombre
        FROM pedidos p
        JOIN usuarios u ON p.cliente_id = u.id
        JOIN restaurantes r ON p.restaurante_id = r.id
        WHERE p.id = ? AND p.restaurante_id = ?
      `, [orderId, restaurantId]);

      if (rows.length > 0) {
        const info = rows[0];
        const desea = Number(info.recibir_notificaciones) === 1;
        if (desea) {
          const estadoMap = {
            pendiente: 'Pendiente',
            confirmado: 'Confirmado',
            preparando: 'Preparando',
            listo: 'Listo para retirar',
            en_camino: 'En camino',
            entregado: 'Entregado',
            cancelado: 'Cancelado',
            pagado: 'Pagado',
            pendiente_pago: 'Pendiente de pago'
          };
          const estadoLegible = estadoMap[estado] || estado;
          const subject = `Actualización de pedido #${info.numero_pedido}: ${estadoLegible}`;
          await sendEmail(
            info.email,
            subject,
            'order-status-update',
            {
              numero_pedido: info.numero_pedido,
              estado: estadoLegible,
              restaurante_nombre: info.restaurante_nombre
            }
          );
        }
      }
    } catch (mailErr) {
      console.error('Error enviando email de estado de pedido:', mailErr);
    } */

    res.json({ success: true, message: 'Estado del pedido actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando estado del pedido:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar estado del pedido' });
  } finally {
    connection.release();
  }
});

// Asignar Repartidor a Pedido
router.post('/orders/:id/assign-driver', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const orderId = req.params.id;
    const { driver_id } = req.body;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify order belongs to this restaurant
    const [order] = await connection.execute('SELECT * FROM pedidos WHERE id = ? AND restaurante_id = ?', [orderId, restaurantId]);
    if (order.length === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado o no pertenece a tu restaurante' });
    }

    // Check if driver exists and is a 'repartidor'
    const [driver] = await connection.execute(`SELECT d.id FROM drivers d JOIN usuarios u ON d.user_id = u.id WHERE d.id = ? AND u.tipo_usuario = 'repartidor'`, [driver_id]);
    if (driver.length === 0) {
      return res.status(400).json({ success: false, message: 'Repartidor inválido' });
    }

    await connection.execute('UPDATE pedidos SET repartidor_id = ? WHERE id = ?', [driver_id, orderId]);

    res.json({ success: true, message: 'Repartidor asignado exitosamente' });
  } catch (error) {
    console.error('Error asignando repartidor:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al asignar repartidor' });
  } finally {
    connection.release();
  }
});

// Ruta para solicitar un repartidor privado
router.post('/orders/:id/request-private-driver', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const orderId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify order belongs to this restaurant and is in a state to be assigned
    const [order] = await connection.execute(
      "SELECT * FROM pedidos WHERE id = ? AND restaurante_id = ? AND estado = 'listo' AND repartidor_id IS NULL",
      [orderId, restaurantId]
    );
    if (order.length === 0) {
      return res.status(400).json({ success: false, message: 'Pedido no encontrado, ya asignado o no está listo para ser entregado.' });
    }

    await connection.beginTransaction();

    // Find an available private driver
    const [availableDrivers] = await connection.execute(
      "SELECT d.id, u.nombre, u.apellido FROM usuarios u JOIN drivers d ON u.id = d.user_id WHERE u.tipo_usuario = 'repartidor' AND d.restaurante_id IS NULL AND d.status = 'available' LIMIT 1"
    );

    if (availableDrivers.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'No hay repartidores privados disponibles en este momento.' });
    }

    const privateDriver = availableDrivers[0];

    // Assign the order to the private driver
    await connection.execute(
      "UPDATE pedidos SET repartidor_id = ?, estado = 'en_camino', delivery_status = 'assigned' WHERE id = ?",
      [privateDriver.id, orderId]
    );

    // Update the driver's status to on_delivery
    await connection.execute(
      "UPDATE drivers SET status = 'on_delivery' WHERE id = ?",
      [privateDriver.id]
    );

    await connection.commit();

    // Send push notification to the assigned driver (assuming a push service is available)
    // This would typically involve a separate service or a more complex Socket.IO setup
    // For now, we'll just log it.
    console.log(`Notifying private driver ${privateDriver.nombre} ${privateDriver.apellido} about order ${orderId}`);
    // Example: sendPushNotificationToDriver(privateDriver.id, orderId);

    // Send push notification to the client about the driver assignment
    await sendOrderStatusNotification(order[0].cliente_id, orderId, 'en_camino');

    res.json({ success: true, message: 'Repartidor privado asignado exitosamente.', driver: privateDriver });
  } catch (error) {
    await connection.rollback();
    console.error('Error solicitando repartidor privado:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al solicitar repartidor privado' });
  } finally {
    connection.release();
  }
});

// Chat con Cliente
router.get('/orders/:id/chat', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    // Get order info
    const [orders] = await db.execute(`
      SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido, u.email as cliente_email, u.telefono as cliente_telefono
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.id = ? AND p.restaurante_id = ?
    `, [orderId, restaurantId]);

    if (orders.length === 0) {
      return res.status(404).render('error', {
        title: 'Pedido No Encontrado',
        message: 'El pedido que buscas no existe o no pertenece a tu restaurante',
        error: {}
      });
    }
    const order = orders[0];

    // Get chat messages
    const [messages] = await db.execute(`
      SELECT mp.*, 
             CASE 
                 WHEN mp.remitente_tipo = 'cliente' THEN u.nombre
                 WHEN mp.remitente_tipo = 'restaurante' THEN r.nombre
                 WHEN mp.remitente_tipo = 'admin' THEN ua.nombre
                 ELSE 'Desconocido'
             END as sender_name
      FROM mensajes_pedido mp
      LEFT JOIN usuarios u ON mp.remitente_id = u.id AND mp.remitente_tipo = 'cliente'
      LEFT JOIN restaurantes r ON mp.remitente_id = r.usuario_id AND mp.remitente_tipo = 'restaurante'
      LEFT JOIN usuarios ua ON mp.remitente_id = ua.id AND mp.remitente_tipo = 'admin'
      WHERE pedido_id = ?
      ORDER BY fecha_envio ASC
    `, [orderId]);

    // Check if chat should be available (less than 14 hours from order)
    const orderTime = new Date(order.fecha_pedido);
    const currentTime = new Date();
    const hoursDiff = (currentTime - orderTime) / (1000 * 60 * 60); // Difference in hours
    const canChat = hoursDiff < 14;

    

    res.render('dashboard/order-chat', {
      title: `Chat Pedido #${order.numero_pedido} - A la Mesa`,
      user: req.session.user,
      order,
      messages,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
    isDashboardPage: true,
      scripts: ['/js/dashboard-orders-chat.js']
    });
    console.log('DEBUG: req.session.user en dashboard/order-chat:', req.session.user);
  } catch (error) {
    console.error('Error en chat de pedido:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el chat del pedido',
      error: {}
    });
  }
});

// Enviar Mensaje de Chat
router.post('/orders/:id/chat', requireRestaurant, requireVerifiedRestaurant, upload.none(), async (req, res) => {
  const connection = await db.getConnection();
  try {
    const orderId = req.params.id;
    const { mensaje } = req.body;
    const userId = req.session.user.id;
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Verify order belongs to this restaurant
    const [order] = await connection.execute('SELECT * FROM pedidos WHERE id = ? AND restaurante_id = ?', [orderId, restaurantId]);
    if (order.length === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado o no pertenece a tu restaurante' });
    }

    // Check if chat should be available (less than 14 hours from order)
    const orderTime = new Date(order[0].fecha_pedido);
    const currentTime = new Date();
    const hoursDiff = (currentTime - orderTime) / (1000 * 60 * 60); // Difference in hours
    const canChat = hoursDiff < 14;

    if (!canChat) {
      return res.status(400).json({ success: false, message: 'El chat para este pedido ya no está disponible.' });
    }

    if (!mensaje || mensaje.trim() === '') {
      return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío' });
    }

    await connection.execute(`
      INSERT INTO mensajes_pedido (pedido_id, remitente_id, destinatario_id, mensaje, tipo_remitente)
      VALUES (?, ?, ?, ?, ?)
    `, [orderId, userId, order[0].cliente_id, mensaje, 'restaurante']);

    // Emit message via socket.io
    if (req.app.locals.io) {
      req.app.locals.io.to(`order-${orderId}`).emit('new-message', {
        pedido_id: orderId,
        remitente_id: userId,
        mensaje: mensaje,
        fecha_envio: new Date(),
        sender_name: req.session.user.nombre,
        tipo_remitente: 'restaurante'
      });
      // Send push notification to client
      await sendOrderStatusNotification(order[0].cliente_id, orderId, 'nuevo_mensaje');
    }

    res.json({ success: true, message: 'Mensaje enviado' });
  } catch (error) {
    console.error('Error enviando mensaje de chat:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al enviar mensaje' });
  } finally {
    connection.release();
  }
});

// --- Gestión de Reseñas ---
router.get('/reviews', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { rating, search } = req.query;

    let sql = `
      SELECT c.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido, p.numero_pedido
      FROM calificaciones c
      JOIN usuarios u ON c.cliente_id = u.id
      JOIN pedidos p ON c.pedido_id = p.id
      WHERE c.restaurante_id = ? AND c.resena_dejada = TRUE
    `;
    let countSql = `
      SELECT COUNT(*) as total_count
      FROM calificaciones
      WHERE restaurante_id = ? AND resena_dejada = TRUE
    `;
    const filterValues = [restaurantId];

    if (rating) {
      sql += ` AND c.calificacion_restaurante = ?`;
      countSql += ` AND c.calificacion_restaurante = ?`;
      filterValues.push(rating);
    }
    if (search) {
      sql += ` AND (c.comentario_restaurante LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ? OR p.numero_pedido LIKE ?)`;
      countSql += ` AND (c.comentario_restaurante LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ? OR p.numero_pedido LIKE ?)`;
      filterValues.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY c.fecha_resena DESC LIMIT ? OFFSET ?`;

    const queryParams = [...filterValues, limit, offset];
    const countQueryParams = [...filterValues];

    const [reviews] = await db.execute(sql, queryParams);
    const [totalCountResult] = await db.execute(countSql, countQueryParams);
    const totalReviews = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalReviews / limit);

    res.render('dashboard/reviews', {
      title: 'Reseñas del Restaurante - A la Mesa',
      user: req.session.user,
      reviews,
      filtros: { rating: rating || '', search: search || '' },
      currentPage: page,
      totalPages,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      activePage: 'resenas'
    });
  } catch (error) {
    console.error('Error en reseñas del restaurante:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando las reseñas del restaurante',
      error: {}
    });
  }
});

// Redirección de /dashboard/pagos a /dashboard/payments
// Ruta única para estadísticas con soporte de filtros y todos los datos necesarios
router.get('/estadisticas', requireRestaurantOrAdmin, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT * FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).render('error', { title: 'Error', message: 'Restaurante no encontrado', user: req.session.user });
    }
    const restaurant = restaurants[0];
    const restaurantId = restaurant.id;

    // Procesar dias_operacion como array de números y calcular si está abierto (coherente con dashboard principal)
    if (typeof restaurant.dias_operacion === 'string') {
      try {
        restaurant.dias_operacion = JSON.parse(restaurant.dias_operacion);
      } catch (e) {
        restaurant.dias_operacion = [];
      }
    }
    if (!Array.isArray(restaurant.dias_operacion)) restaurant.dias_operacion = [];
    restaurant.dias_operacion = restaurant.dias_operacion.map(Number).filter(dia => !isNaN(dia));
    restaurant.abierto = isRestaurantOpen(restaurant);

    // Filtros
    const mes = req.query.mes; // formato YYYY-MM
    const semana = req.query.semana; // formato YYYY-WW

    // Estadísticas mensuales
    let monthlyStatsQuery = `
      SELECT DATE_FORMAT(fecha_pedido, '%Y-%m') as mes,
             COUNT(*) as total_pedidos,
             SUM(total) as ingresos_totales,
             AVG(total) as ticket_promedio
      FROM pedidos
      WHERE restaurante_id = ? AND estado != 'cancelado'
    `;
    let monthlyStatsParams = [restaurantId];
    if (mes) {
      monthlyStatsQuery += ' AND DATE_FORMAT(fecha_pedido, "%Y-%m") = ?';
      monthlyStatsParams.push(mes);
    }
    monthlyStatsQuery += ' GROUP BY mes ORDER BY mes DESC LIMIT 6';
    const [monthlyStats] = await db.execute(monthlyStatsQuery, monthlyStatsParams);

    // Estadísticas semanales
    let weeklyStatsQuery = `
      SELECT YEAR(fecha_pedido) as anio, WEEK(fecha_pedido, 1) as semana,
             COUNT(*) as total_pedidos,
             SUM(total) as ingresos_totales,
             AVG(total) as ticket_promedio
      FROM pedidos
      WHERE restaurante_id = ? AND estado != 'cancelado'
    `;
    let weeklyStatsParams = [restaurantId];
    if (semana) {
      const [year, week] = semana.split('-W');
      weeklyStatsQuery += ' AND YEAR(fecha_pedido) = ? AND WEEK(fecha_pedido, 1) = ?';
      weeklyStatsParams.push(year, week);
    }
    weeklyStatsQuery += ' GROUP BY anio, semana ORDER BY anio DESC, semana DESC LIMIT 6';
    const [weeklyStats] = await db.execute(weeklyStatsQuery, weeklyStatsParams);

    // Datos para gráficos (últimos 7 días y 6 semanas)
    const [dailyStats] = await db.execute(`
      SELECT DATE(fecha_pedido) as dia, SUM(total) as ingresos
      FROM pedidos
      WHERE restaurante_id = ? AND estado != 'cancelado' AND fecha_pedido >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY dia ORDER BY dia DESC
    `, [restaurantId]);
    const [weekChartStats] = await db.execute(`
      SELECT YEAR(fecha_pedido) as anio, WEEK(fecha_pedido, 1) as semana, SUM(total) as ingresos
      FROM pedidos
      WHERE restaurante_id = ? AND estado != 'cancelado' AND fecha_pedido >= DATE_SUB(NOW(), INTERVAL 42 DAY)
      GROUP BY anio, semana ORDER BY anio DESC, semana DESC LIMIT 6
    `, [restaurantId]);

    // Productos más vendidos (último mes o filtro)
    let topProductsQuery = `
      SELECT pr.nombre, SUM(ip.cantidad) as cantidad_vendida
      FROM items_pedido ip
      JOIN productos pr ON ip.producto_id = pr.id
      JOIN pedidos p ON ip.pedido_id = p.id
      WHERE p.restaurante_id = ? AND p.estado != 'cancelado'
    `;
    let topProductsParams = [restaurantId];
    if (mes) {
      topProductsQuery += ' AND DATE_FORMAT(p.fecha_pedido, "%Y-%m") = ?';
      topProductsParams.push(mes);
    } else {
      topProductsQuery += ' AND p.fecha_pedido >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }
    topProductsQuery += ' GROUP BY pr.nombre ORDER BY cantidad_vendida DESC LIMIT 5';
    const [topProducts] = await db.execute(topProductsQuery, topProductsParams);

    // Métricas clave
    const [[{ totalClientes }]] = await db.execute('SELECT COUNT(DISTINCT cliente_id) as totalClientes FROM pedidos WHERE restaurante_id = ? AND estado != "cancelado"', [restaurantId]);
    const [[{ totalPedidos }]] = await db.execute('SELECT COUNT(*) as totalPedidos FROM pedidos WHERE restaurante_id = ? AND estado != "cancelado"', [restaurantId]);

    res.render('dashboard/estadisticas', {
      title: 'Estadísticas del Restaurante',
      user: req.session.user,
      restaurant, // <-- Añadido
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      monthlyStats,
      weeklyStats,
      dailyStats,
      weekChartStats,
      topProducts,
      totalClientes,
      totalPedidos,
      selectedMes: mes || '',
      selectedSemana: semana || '',
      path: req.path,
      isDashboardPage: true,
      activePage: 'estadisticas'
    });
  } catch (error) {
    console.error('Error en estadísticas:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando las estadísticas',
      error: {}
    });
  }
});

// Redirección de /dashboard/pagos a /dashboard/payments
router.get('/pagos', (req, res) => {
  res.redirect('/dashboard/payments');
});

// Ruta para manejar /dashboard/pagos/:id (cobros específicos)
router.get('/pagos/:id', (req, res) => {
  res.redirect('/dashboard/payments');
});

router.get('/cobros', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurant = restaurants[0];

    // Get recent payments/charges
    const [cobrosRecientes] = await db.execute(`
      SELECT * FROM cobros_semanales
      WHERE restaurante_id = ?
      ORDER BY semana_inicio DESC
      LIMIT 10
    `, [restaurant.id]);

    // Calcular resumen de cobros
    const [resumenRows] = await db.execute(`
      SELECT 
        SUM(CASE WHEN estado = 'pendiente' THEN monto ELSE 0 END) AS total_pendiente,
        SUM(CASE WHEN estado = 'pagado' THEN monto ELSE 0 END) AS total_pagado,
        SUM(comision) AS total_comisiones
      FROM cobros_semanales
      WHERE restaurante_id = ?
    `, [restaurant.id]);
    const resumen = resumenRows[0] || { total_pendiente: 0, total_pagado: 0, total_comisiones: 0 };

    res.render('dashboard/cobros', {
      title: 'Cobros - A la Mesa',
      user: req.session.user,
      restaurant,
      cobros: cobrosRecientes,
      resumen,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
      isDashboardPage: true,
      activePage: 'cobros'
    });
  } catch (error) {
    console.error('Error en cobros del restaurante:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando la sección de cobros',
      error: {}
    });
  }
});

// --- Pagos y Cobros (Mercado Pago) ---
router.get('/payments', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id, mp_access_token, mp_user_id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurant = restaurants[0];

    // Check if Mercado Pago is configured
    const mpConfigured = restaurant.mp_access_token && restaurant.mp_user_id;

    // Get recent payments/charges with MercadoPago URLs
    const [cobrosRecientes] = await db.execute(`
      SELECT cs.*, 
             COUNT(cp.id) as comprobantes_count,
             COALESCE(SUM(CASE WHEN cp.estado = 'aprobado' THEN cp.monto_pagado ELSE 0 END), 0) as monto_pagado_aprobado
      FROM cobros_semanales cs
      LEFT JOIN comprobantes_pago cp ON cs.id = cp.cobro_semanal_id
      WHERE cs.restaurante_id = ?
      GROUP BY cs.id
      ORDER BY cs.semana_inicio DESC
      LIMIT 10
    `, [restaurant.id]);

    // Generate MercadoPago URLs for pending payments
    const cobrosConMP = cobrosRecientes.map(cobro => {
      let mercadopago_url = '#'; // Default fallback

      if (cobro.estado === 'pendiente' && mpConfigured) {
        // Generate MercadoPago payment URL
        mercadopago_url = `/dashboard/payments/mercadopago/create?cobro_id=${cobro.id}&amount=${cobro.monto_comision}`;
      }

      return {
        ...cobro,
        mercadopago_url
      };
    });

    res.render('dashboard/pagos', {
      title: 'Pagos y Cobros - A la Mesa',
      user: req.session.user,
      restaurant,
      mpConfigured,
      cobros: cobrosConMP,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
    isDashboardPage: true,
      activePage: 'pagos',
      isDashboardPage: true
    });
  } catch (error) {
    console.error('Error en pagos del restaurante:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando la sección de pagos',
      error: {}
    });
  }
});

// Ruta para subir comprobante de pago de restaurante
router.post('/cobros/:id/upload-comprobante', requireRestaurant, requireVerifiedRestaurant, uploadRestaurantComprobante, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const cobroId = req.params.id;
    const userId = req.session.user.id;

    // Verify that the cobro belongs to this restaurant
    const [restaurants] = await connection.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    const [cobro] = await connection.execute(
      'SELECT * FROM cobros_semanales WHERE id = ? AND restaurante_id = ?',
      [cobroId, restaurantId]
    );

    if (cobro.length === 0) {
      return res.status(404).json({ success: false, message: 'Cobro no encontrado o no pertenece a tu restaurante' });
    }

    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    }

    const fileName = req.file.filename;
    const comprobanteUrl = `/uploads/comprobantes_restaurantes/${fileName}`;

    // Insert into comprobantes_pago table with the comprobante URL and status
    await connection.execute(
      'INSERT INTO comprobantes_pago (cobro_semanal_id, restaurante_id, archivo_comprobante, metodo_pago, monto_pagado, estado) VALUES (?, ?, ?, ?, ?, ?)',
      [cobroId, restaurantId, comprobanteUrl, 'transferencia', cobro[0].monto_comision, 'pendiente']
    );

    res.json({
      success: true,
      message: 'Comprobante subido exitosamente. Pendiente de revisión.',
      comprobante_url: comprobanteUrl
    });

  } catch (error) {
    console.error('Error subiendo comprobante de restaurante:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al subir comprobante' });
  } finally {
    connection.release();
  }
});

// Ruta para mostrar el formulario de subida de comprobante de restaurante
router.get('/cobros/:id/upload', requireRestaurant, requireVerifiedRestaurant, getPendingOrdersCount, async (req, res) => {
  try {
    const cobroId = req.params.id;
    const userId = req.session.user.id;

    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    const restaurantId = restaurants[0].id;

    const [cobros] = await db.execute(
      'SELECT * FROM cobros_semanales WHERE id = ? AND restaurante_id = ?',
      [cobroId, restaurantId]
    );

    if (cobros.length === 0) {
      return res.status(404).render('error', {
        title: 'Cobro No Encontrado',
        message: 'El cobro que buscas no existe o no pertenece a tu restaurante',
        error: {}
      });
    }
    const cobro = cobros[0];

    res.render('dashboard/upload-comprobante', {
      title: `Subir Comprobante - Cobro #${cobro.id}`,
      user: req.session.user,
      cobro,
      pedidosNoEntregados: req.session.pedidosNoEntregados,
      path: req.path,
      isDashboardPage: true,
      activePage: 'pagos'
    });

  } catch (error) {
    console.error('Error cargando formulario de subida de comprobante:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el formulario de subida de comprobante',
      error: {}
    });
  }
});

// Mercado Pago OAuth Redirect - PARA RESTAURANTES INDIVIDUALES
router.get('/mercadopago/auth', requireRestaurant, requireVerifiedRestaurant, (req, res) => {
  const userId = req.session.user.id;

  console.log('🔗 Iniciando autenticación MercadoPago para restaurante:', userId);

  // Verificar que las variables de entorno estén configuradas
  if (!process.env.MP_APP_ID || !process.env.MP_REDIRECT_URI) {
    console.error('❌ Variables de entorno de MercadoPago no configuradas');
    return res.redirect('/dashboard/settings?error=mp_config_error&message=Configuración de MercadoPago incompleta');
  }

  // Generar URL de autorización de MercadoPago
  const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(process.env.MP_REDIRECT_URI)}&scope=offline_access%20read%20write`;

  console.log('🔗 URL de autorización generada:', authUrl);

  // Redirigir a MercadoPago para autorización
  res.redirect(authUrl);
});

// Mercado Pago OAuth Callback
router.get('/mercadopago/callback', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const userId = req.session.user.id;

  console.log('=== MERCADOPAGO OAUTH CALLBACK ===');
  console.log('Code:', code ? 'Presente' : 'Ausente');
  console.log('State:', state);
  console.log('Error:', error);
  console.log('Error Description:', error_description);

  // Handle OAuth errors
  if (error) {
    console.error('MercadoPago OAuth Error:', error, error_description);

    let errorMessage = 'Error en la conexión con MercadoPago';
    switch(error) {
      case 'access_denied':
        errorMessage = 'El usuario canceló la autorización o negó el acceso';
        break;
      case 'invalid_request':
        errorMessage = 'Solicitud inválida - verifica la configuración de la aplicación';
        break;
      case 'unauthorized_client':
        errorMessage = 'Aplicación no autorizada - contacta al administrador';
        break;
      case 'unsupported_response_type':
        errorMessage = 'Tipo de respuesta no soportado';
        break;
      case 'invalid_scope':
        errorMessage = 'Alcance de permisos inválido';
        break;
      default:
        errorMessage = `Error de MercadoPago: ${error_description || error}`;
    }

    return res.redirect(`/dashboard/settings?error=mp_oauth_error&message=${encodeURIComponent(errorMessage)}`);
  }

  if (!code) {
    console.error('No authorization code received');
    return res.redirect('/dashboard/settings?error=mp_no_code');
  }

  try {
    console.log('Exchanging authorization code for access token...');

    // Validate environment variables
    if (!process.env.MP_CLIENT_SECRET || !process.env.MP_APP_ID || !process.env.MP_REDIRECT_URI) {
      console.error('Missing MercadoPago environment variables');
      return res.redirect('/dashboard/settings?error=mp_config_error');
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.mercadopago.com/oauth/token', {
      client_secret: process.env.MP_CLIENT_SECRET,
      client_id: process.env.MP_APP_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.MP_REDIRECT_URI,
    });

    console.log('Token exchange successful');
    const { access_token, refresh_token, user_id } = tokenResponse.data;

    // Validate tokens
    if (!access_token) {
      console.error('No access token received');
      return res.redirect('/dashboard/settings?error=mp_no_token');
    }

    // Get public key using the access token
    console.log('Getting public key from MercadoPago...');
    const publicKeyResponse = await axios.get('https://api.mercadopago.com/v1/payment_methods', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    // The public key is typically the same for all users of the same application
    // For now, we'll use a standard public key or get it from environment
    const publicKey = process.env.MP_PUBLIC_KEY || 'APP_USR-ec324c58-352f-49dd-8c40-cd69820ffbbb';

    console.log('Public key obtained:', publicKey.substring(0, 10) + '...');

    // Save credentials to the restaurant associated with the user
    const [updateResult] = await db.execute(`
      UPDATE restaurantes SET
        mp_access_token = ?,
        mp_refresh_token = ?,
        mp_user_id = ?,
        mp_public_key = ?
      WHERE usuario_id = ?
    `, [access_token, refresh_token, user_id, publicKey, userId]);

    if (updateResult.affectedRows === 0) {
      console.error('No restaurant found for user:', userId);
      return res.redirect('/dashboard/settings?error=mp_user_not_found');
    }

    console.log('MercadoPago credentials saved successfully for user:', userId);
    res.redirect('/dashboard/settings?success=mp_auth_success');

  } catch (error) {
    console.error('Error in MercadoPago OAuth callback:', error);

    let errorType = 'mp_token_failed';
    let errorMessage = 'Error al obtener las credenciales de MercadoPago';

    if (error.response) {
      console.error('MercadoPago API Error:', error.response.status, error.response.data);

      switch(error.response.status) {
        case 400:
          errorType = 'mp_invalid_request';
          errorMessage = 'Solicitud inválida - verifica la configuración';
          break;
        case 401:
          errorType = 'mp_unauthorized';
          errorMessage = 'Credenciales inválidas - contacta al administrador';
          break;
        case 403:
          errorType = 'mp_forbidden';
          errorMessage = 'Acceso denegado - la aplicación no está autorizada';
          break;
        case 429:
          errorType = 'mp_rate_limit';
          errorMessage = 'Demasiadas solicitudes - intenta más tarde';
          break;
        default:
          errorMessage = `Error del servidor MercadoPago: ${error.response.status}`;
      }
    } else if (error.code === 'ECONNREFUSED') {
      errorType = 'mp_connection_error';
      errorMessage = 'No se pudo conectar a MercadoPago - verifica tu conexión';
    }

    res.redirect(`/dashboard/settings?error=${errorType}&message=${encodeURIComponent(errorMessage)}`);
  }
});

// Ruta para cancelar pedidos pendientes de pago después de 15 minutos
router.post('/orders/cancel-pending-payments', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Buscar pedidos pendientes de pago que tengan más de 15 minutos
    const [pendingOrders] = await db.execute(`
      SELECT id, numero_pedido, fecha_pedido, total
      FROM pedidos 
      WHERE restaurante_id = ? 
        AND estado = 'pendiente_pago' 
        AND fecha_pedido < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
    `, [restaurantId]);

    if (pendingOrders.length === 0) {
      return res.json({ success: true, message: 'No hay pedidos pendientes de pago para cancelar', cancelledCount: 0 });
    }

    // Cancelar los pedidos
    const orderIds = pendingOrders.map(order => order.id);
    await db.execute(`
      UPDATE pedidos 
      SET estado = 'cancelado', 
          motivo_cancelacion = 'Pago no completado dentro del tiempo límite (15 minutos)'
      WHERE id IN (${orderIds.map(() => '?').join(',')})
    `, orderIds);

    // Log de la acción
    console.log(`Pedidos cancelados por pago pendiente: ${orderIds.join(', ')}`);

    res.json({ 
      success: true, 
      message: `${pendingOrders.length} pedidos cancelados por pago pendiente`,
      cancelledCount: pendingOrders.length,
      cancelledOrders: pendingOrders
    });

  } catch (error) {
    console.error('Error cancelando pedidos pendientes de pago:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Crear pago de MercadoPago para cobro
router.get('/payments/mercadopago/create', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  try {
    const { cobro_id, amount } = req.query;
    const userId = req.session.user.id;

    console.log('--- Mercado Pago Preference Creation Request ---');
    console.log('Received cobro_id:', cobro_id);
    console.log('Received amount:', amount);
    console.log('User ID:', userId);

    if (!cobro_id || !amount) {
      console.error('Missing parameters: cobro_id or amount');
      return res.status(400).json({ success: false, message: 'Parámetros faltantes' });
    }

    // Verificar que el cobro existe y pertenece al restaurante
    const [cobros] = await db.execute(`
      SELECT cs.*, r.mp_access_token, r.mp_user_id
      FROM cobros_semanales cs
      JOIN restaurantes r ON cs.restaurante_id = r.id
      WHERE cs.id = ? AND r.usuario_id = ? AND cs.estado = 'pendiente'
    `, [cobro_id, userId]);

    if (cobros.length === 0) {
      console.error('Cobro not found or not available for this restaurant:', cobro_id, userId); // Corrected to use userId
      return res.status(404).json({ success: false, message: 'Cobro no encontrado o no disponible' });
    }

    const cobro = cobros[0];
    console.log('Cobro details:', cobro);
    console.log('Restaurant mp_access_token (first 10 chars):', cobro.mp_access_token ? cobro.mp_access_token.substring(0, 10) + '...' : 'N/A');
    console.log('Restaurant mp_user_id:', cobro.mp_user_id);


    // Obtener el link de MercadoPago configurado en admin
    const [mpConfig] = await db.execute("SELECT valor FROM configuraciones WHERE clave = 'mercadopago_url' LIMIT 1");
    const mercadopago_url = mpConfig.length > 0 ? mpConfig[0].valor : null;

    if (!cobro.mp_access_token || !cobro.mp_user_id) {
      console.log('MercadoPago not configured for this restaurant. Using admin configured URL.');
      // Si no está configurado para el restaurante, redirigir al link configurado en admin
      if (mercadopago_url) {
        return res.json({
          success: true,
          redirect: true,
          redirectUrl: mercadopago_url
        });
      } else {
        return res.status(400).json({ success: false, message: 'MercadoPago no está configurado. Contacte al administrador.' });
      }
    }

    // Crear preferencia de pago en MercadoPago usando el token del restaurante
    const mercadopago = require('mercadopago');

    // Configurar MercadoPago con el token del restaurante específico
    mercadopago.configure({
      access_token: cobro.mp_access_token
    });

    const preference = {
      items: [
        {
          title: `Comisión A la Mesa - Semana ${new Date(cobro.semana_inicio).toLocaleDateString('es-AR')}`,
          unit_price: parseFloat(amount),
          quantity: 1,
          currency_id: 'ARS'
        }
      ],
      payer: {
        email: req.session.user.email
      },
      back_urls: {
        success: `${mercadopago_url}?payment_status=success&cobro_id=${cobro_id}`,
        failure: `${mercadopago_url}?payment_status=failure&cobro_id=${cobro_id}`,
        pending: `${mercadopago_url}?payment_status=pending&cobro_id=${cobro_id}`
      },
      notification_url: `${process.env.BASE_URL || 'http://localhost:3000'}/webhooks/mercadopago`,
      external_reference: `cobro_${cobro_id}`,
      auto_return: 'approved'
    };

    console.log('Preference object sent to Mercado Pago:', preference);

    try {
      const response = await mercadopago.preferences.create(preference);
      const preferenceId = response.body.id;

      console.log('Mercado Pago API response:', response.body);
      console.log('Generated preferenceId:', preferenceId);

      // Guardar el preference_id en la base de datos para seguimiento
      await db.execute(
        'UPDATE cobros_semanales SET mp_preference_id = ? WHERE id = ?',
        [preferenceId, cobro_id]
      );

      res.json({
        success: true,
        preferenceId,
        init_point: response.body.init_point,
        sandbox_init_point: response.body.sandbox_init_point
      });
    } catch (mpError) {
      console.error('MercadoPago API Error:', mpError);
      res.status(500).json({
        success: false,
        message: 'Error al crear la preferencia de pago en MercadoPago',
        error: mpError.message
      });
    }

  } catch (error) {
    console.error('Error creating MercadoPago preference:', error);
    console.error('Full error object from Mercado Pago API:', error); // Log full error object
    res.status(500).json({ success: false, message: 'Error al crear la preferencia de pago' });
  }
});

// Ruta para guardar configuración de MercadoPago
router.post('/settings/mp-config', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { mp_public_key, mp_access_token, mp_user_id } = req.body;

    if (!mp_public_key || mp_public_key.trim() === '') {
      return res.status(400).json({ success: false, message: 'La clave pública es obligatoria' });
    }

    // Verificar que el restaurante existe
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Actualizar configuración de MercadoPago
    await db.execute(`
      UPDATE restaurantes SET
        mp_public_key = ?,
        mp_access_token = ?,
        mp_user_id = ?
      WHERE id = ?
    `, [
      mp_public_key.trim(),
      mp_access_token ? mp_access_token.trim() : null,
      mp_user_id ? mp_user_id.trim() : null,
      restaurantId
    ]);

    console.log(`MercadoPago config updated for restaurant ${restaurantId} by user ${userId}`);
    res.json({ success: true, message: 'Configuración de MercadoPago guardada exitosamente' });

  } catch (error) {
    console.error('Error saving MercadoPago config:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al guardar configuración' });
  }
});

// Ruta para desvincular cuenta de MercadoPago
router.post('/settings/mp-unlink', requireRestaurant, requireVerifiedRestaurant, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Verificar que el restaurante existe
    const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [userId]);
    if (restaurants.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }
    const restaurantId = restaurants[0].id;

    // Limpiar todas las credenciales de MercadoPago
    await db.execute(`
      UPDATE restaurantes SET
        mp_public_key = NULL,
        mp_access_token = NULL,
        mp_refresh_token = NULL,
        mp_user_id = NULL
      WHERE id = ?
    `, [restaurantId]);

    console.log(`MercadoPago credentials cleared for restaurant ${restaurantId} by user ${userId}`);
    res.json({ success: true, message: 'Cuenta de MercadoPago desvinculada exitosamente' });

  } catch (error) {
    console.error('Error unlinking MercadoPago:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al desvincular cuenta' });
  }
});

module.exports = router;
