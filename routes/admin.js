const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/auth');
const { sendEmail } = require('../config/mailer');

// Middleware to check if user is admin
/*
const requireAdmin = (req, res, next) => {
  console.log('=== MIDDLEWARE REQUIRE ADMIN ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session completa:', req.session);
  console.log('Usuario en sesión:', req.session.user);
  
  if (!req.session.user) {
    console.log('No hay sesión de usuario - Redirigiendo a login');
    return res.redirect('/auth/login');
  }

  if (req.session.user.tipo_usuario !== 'admin') {
    console.log('Usuario no es admin:', {
      email: req.session.user.email,
      tipo: req.session.user.tipo_usuario
    });
    return res.redirect('/auth/login');
  }

  console.log('Acceso admin permitido para:', {
    id: req.session.user.id,
    email: req.session.user.email,
    tipo: req.session.user.tipo_usuario
  });
  console.log('=== FIN MIDDLEWARE REQUIRE ADMIN ===');
  next();
};
*/
// La función requireAdmin ya se importa desde ../middleware/auth,
// por lo que esta definición local es redundante y causa el error.


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/comprobantes/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'comprobante-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos JPG, PNG o PDF'));
    }
  }
});

// Log admin activity
async function logAdminActivity(adminId, accion, descripcion, entidadTipo = null, entidadId = null, datosAnteriores = null, datosNuevos = null, req = null) {
  try {
    await db.execute(`
      INSERT INTO actividad_admin 
      (admin_id, accion, descripcion, entidad_tipo, entidad_id, datos_anteriores, datos_nuevos, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminId, 
      accion, 
      descripcion, 
      entidadTipo, 
      entidadId, 
      datosAnteriores ? JSON.stringify(datosAnteriores) : null,
      datosNuevos ? JSON.stringify(datosNuevos) : null,
      req ? req.ip : null
    ]);
  } catch (error) {
    console.error('Error logging admin activity:', error);
  }
}

// Admin Dashboard Main
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Estadísticas generales
    const [statsRestaurantes] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN verificado = 1 THEN 1 ELSE 0 END) as verificados,
        SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as activos
      FROM restaurantes
    `);

    // Dashboard principal: solo pedidos entregados
    const [statsVentas] = await db.execute(`
      SELECT 
        COUNT(*) as total_pedidos,
        COALESCE(SUM(total), 0) as ventas_totales,
        COALESCE(SUM(total * 0.10), 0) as comisiones_totales,
        COALESCE(AVG(total), 0) as ticket_promedio
      FROM pedidos 
      WHERE estado = 'entregado' AND fecha_pedido >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // Asegurarnos de que los valores sean números
    const ventasStats = {
      total_pedidos: Number(statsVentas[0]?.total_pedidos || 0),
      ventas_totales: Number(statsVentas[0]?.ventas_totales || 0),
      comisiones_totales: Number(statsVentas[0]?.comisiones_totales || 0),
      ticket_promedio: Number(statsVentas[0]?.ticket_promedio || 0)
    };

    const [cobrosRecientes] = await db.execute(`
      SELECT 
        cs.*, r.nombre as restaurante_nombre,
        COUNT(cp.id) as comprobantes_subidos
      FROM cobros_semanales cs
      JOIN restaurantes r ON cs.restaurante_id = r.id
      LEFT JOIN comprobantes_pago cp ON cs.id = cp.cobro_semanal_id
      GROUP BY cs.id
      ORDER BY cs.fecha_creacion DESC
      LIMIT 10
    `);

    // Ventas últimos 7 días: solo entregados
    const [ventasUltimos7Dias] = await db.execute(`
      SELECT 
        DATE(fecha_pedido) as fecha,
        COUNT(*) as pedidos,
        COALESCE(SUM(total), 0) as ventas
      FROM pedidos 
      WHERE fecha_pedido >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND estado = 'entregado'
      GROUP BY DATE(fecha_pedido)
      ORDER BY fecha DESC
    `);

    // Calcular comisiones realizadas y pendientes
    const [comisionesStats] = await db.execute(`
      SELECT 
        SUM(CASE WHEN estado = 'pagado' THEN monto_comision ELSE 0 END) as comisiones_realizadas,
        SUM(CASE WHEN estado = 'pendiente' OR estado = 'vencido' THEN monto_comision ELSE 0 END) as comisiones_pendientes
      FROM cobros_semanales
    `);

    res.render('admin/dashboard', {
      title: 'Panel de Administración - A la Mesa',
      user: req.session.user,
      stats: {
        restaurantes: statsRestaurantes[0],
        ventas: ventasStats
      },
      cobrosRecientes,
      ventasUltimos7Dias,
      comisiones_realizadas: Number(comisionesStats[0]?.comisiones_realizadas || 0),
      comisiones_pendientes: Number(comisionesStats[0]?.comisiones_pendientes || 0),
      path: req.path
    });
  } catch (error) {
    console.error('Error in admin dashboard:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el panel de administración',
      error: {}
    });
  }
});

// ========== GESTIÓN DE CONFIGURACIÓN ==========
router.get('/configuracion', requireAdmin, async (req, res) => {
  try {
    // Leer el link de Mercado Pago de la tabla configuraciones
    const [rows] = await db.execute("SELECT valor FROM configuraciones WHERE clave = 'mercadopago_url' LIMIT 1");
    const mercadopago_url = rows.length > 0 ? rows[0].valor : '';
    res.render('admin/configuracion', {
      title: 'Configuración del Sistema - A la Mesa',
      user: req.session.user,
      mercadopago_url,
      path: req.path
    });
  } catch (error) {
    console.error('Error in admin configuracion:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando la configuración del sistema',
      error: {}
    });
  }
});

// Guardar configuración
router.post('/configuracion/save', requireAdmin, async (req, res) => {
  try {
    const { sitioWeb, comision, tiempoPreparacion, mercadopago_url } = req.body;
    // Guardar/actualizar el link de Mercado Pago
    await db.execute(
      `INSERT INTO configuraciones (clave, valor, tipo) VALUES ('mercadopago_url', ?, 'string')
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [mercadopago_url || '']
    );
    // Aquí puedes guardar las otras configuraciones si lo deseas
    res.json({ success: true, message: 'Configuraciones guardadas exitosamente' });
  } catch (error) {
    console.error('Error guardando configuración:', error);
    res.status(500).json({ success: false, message: 'Error guardando configuración' });
  }
});

// ========== GESTIÓN DE USUARIOS ==========
router.get('/usuarios', requireAdmin, async (req, res) => {
  try {
    const [usuarios] = await db.execute('SELECT * FROM usuarios ORDER BY fecha_registro DESC');
    res.render('admin/usuarios', {
      title: 'Gestión de Usuarios - A la Mesa',
      user: req.session.user,
      usuarios,
      path: req.path
    });
  } catch (error) {
    console.error('Error in admin usuarios:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando la gestión de usuarios',
      error: {}
    });
  }
});

// ========== GESTIÓN DE REPORTES ==========
router.get('/reportes', requireAdmin, async (req, res) => {
  try {
    // Aquí podrías cargar datos para los reportes desde la base de datos
    res.render('admin/reportes', {
      title: 'Reportes - A la Mesa',
      user: req.session.user,
      path: req.path
    });
  } catch (error) {
    console.error('Error in admin reportes:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando los reportes',
      error: {}
    });
  }
});

// ========== GESTIÓN DE RESTAURANTES ==========

// Listar todos los restaurantes
router.get('/restaurantes', requireAdmin, async (req, res) => {
  try {
    const { search, estado, categoria, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = `
      SELECT 
        r.id,
        r.nombre,
        r.descripcion,
        r.imagen_logo,
        r.imagen_banner,
        r.direccion,
        r.ciudad,
        r.telefono,
        r.email_contacto,
        r.horario_apertura,
        r.horario_cierre,
        r.tiempo_entrega_min,
        r.tiempo_entrega_max,
        r.costo_delivery,
        r.calificacion_promedio,
        r.total_calificaciones,
        r.activo,
        r.verificado,
        GROUP_CONCAT(DISTINCT cr.nombre) as categorias,
        COUNT(DISTINCT p.id) as total_productos,
        COUNT(DISTINCT o.id) as total_pedidos
      FROM restaurantes r
      LEFT JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
      LEFT JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
      LEFT JOIN productos p ON r.id = p.restaurante_id
      LEFT JOIN pedidos o ON r.id = o.restaurante_id
      WHERE 1=1
    `;
    
    let countSql = `
      SELECT COUNT(DISTINCT r.id) as total_count
      FROM restaurantes r
      LEFT JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
      LEFT JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
      LEFT JOIN productos p ON r.id = p.restaurante_id
      LEFT JOIN pedidos o ON r.id = o.restaurante_id
      WHERE 1=1
    `;

    const params = [];
    const countParams = [];
    
    if (search) {
      sql += ` AND (r.nombre LIKE ? OR r.email_contacto LIKE ?)`;
      countSql += ` AND (r.nombre LIKE ? OR r.email_contacto LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (estado) {
      switch(estado) {
        case 'activos':
          sql += ` AND r.activo = 1`;
          countSql += ` AND r.activo = 1`;
          break;
        case 'inactivos':
          sql += ` AND r.activo = 0`;
          countSql += ` AND r.activo = 0`;
          break;
        case 'verificados':
          sql += ` AND r.verificado = 1`;
          countSql += ` AND r.verificado = 1`;
          break;
        case 'no_verificados':
          sql += ` AND r.verificado = 0`;
          countSql += ` AND r.verificado = 0`;
          break;
      }
    }
    
    if (categoria) {
      sql += ` AND EXISTS (
        SELECT 1 FROM restaurante_categorias rc2 
        JOIN categorias_restaurantes cr2 ON rc2.categoria_id = cr2.id 
        WHERE rc2.restaurante_id = r.id AND cr2.id = ?
      )`;
      countSql += ` AND EXISTS (
        SELECT 1 FROM restaurante_categorias rc2 
        JOIN categorias_restaurantes cr2 ON rc2.categoria_id = cr2.id 
        WHERE rc2.restaurante_id = r.id AND cr2.id = ?
      )`;
      params.push(categoria);
      countParams.push(categoria);
    }
    
    sql += ` GROUP BY 
        r.id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner,
        r.direccion, r.ciudad, r.telefono, r.email_contacto,
        r.horario_apertura, r.horario_cierre, r.tiempo_entrega_min,
        r.tiempo_entrega_max, r.costo_delivery, r.calificacion_promedio,
        r.total_calificaciones, r.activo, r.verificado
      ORDER BY r.nombre ASC
      LIMIT ? OFFSET ?`;

    params.push(parseInt(limit), offset);

    const [restaurants] = await db.execute(sql, params);
    const [totalCountResult] = await db.execute(countSql, countParams);
    const totalRestaurants = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalRestaurants / parseInt(limit));
    
    // Get categories for filter
    const [categorias] = await db.execute(`
      SELECT * FROM categorias_restaurantes WHERE activa = 1 ORDER BY nombre
    `);

    res.render('admin/restaurantes', {
      title: 'Administrar Restaurantes',
      user: req.session.user,
      restaurants,
      categorias,
      filtros: { search: search || '', estado: estado || '', categoria: categoria || '' },
      currentPage: parseInt(page),
      totalPages,
      path: req.path
    });
  } catch (error) {
    console.error('Error loading restaurants:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando restaurantes',
      error: {}
    });
  }
});

// Ver detalle de restaurante
router.get('/restaurantes/:id', requireAdmin, async (req, res) => {
  try {
    const restaurantId = req.params.id;
    
    // Get restaurant info
    const [restaurantes] = await db.execute(`
      SELECT r.*, u.nombre as usuario_nombre, u.apellido as usuario_apellido, u.email as usuario_email, u.telefono as usuario_telefono
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ?
    `, [restaurantId]);
    
    if (restaurantes.length === 0) {
      return res.status(404).render('error', {
        title: 'Restaurante No Encontrado',
        message: 'El restaurante que buscas no existe',
        error: {}
      });
    }
    
    const restaurante = restaurantes[0];
    
    // Get products
    const [productos] = await db.execute(`
      SELECT p.*, cp.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.restaurante_id = ?
      ORDER BY cp.orden_display, p.destacado DESC, p.nombre
    `, [restaurantId]);
    
    // Get recent orders
    const [pedidos] = await db.execute(`
      SELECT p.*, u.nombre as cliente_nombre, u.email as cliente_email
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.restaurante_id = ?
      ORDER BY p.fecha_pedido DESC
      LIMIT 20
    `, [restaurantId]);

    // Estadísticas de pedidos
    const [statsPedidos] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) as cancelados,
        SUM(CASE WHEN estado = 'entregado' THEN 1 ELSE 0 END) as entregados,
        SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes
      FROM pedidos
      WHERE restaurante_id = ?
    `, [restaurantId]);
    const totalPedidos = statsPedidos[0]?.total || 0;
    const cancelados = statsPedidos[0]?.cancelados || 0;
    const entregados = statsPedidos[0]?.entregados || 0;
    // pendientes = total - cancelados - entregados
    const pendientes = totalPedidos - cancelados - entregados;
    const porcentajeEntregados = totalPedidos > 0 ? Math.round((entregados / totalPedidos) * 100) : 0;
    
    // Get weekly charges
    const [cobros] = await db.execute(`
      SELECT * FROM cobros_semanales
      WHERE restaurante_id = ?
      ORDER BY semana_inicio DESC
      LIMIT 10
    `, [restaurantId]);

    res.render('admin/restaurante-detalle', {
      title: `${restaurante.nombre} - Admin`,
      user: req.session.user,
      restaurante,
      productos,
      pedidos,
      cobros,
      path: req.path,
      totalPedidos,
      cancelados,
      entregados,
      pendientes,
      porcentajeEntregados
    });
  } catch (error) {
    console.error('Error getting restaurant detail:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando detalle del restaurante',
      error: {}
    });
  }
});

// Crear nuevo restaurante
router.get('/restaurantes/crear/nuevo', requireAdmin, async (req, res) => {
  try {
    const [categorias] = await db.execute(`
      SELECT * FROM categorias_restaurantes WHERE activa = 1 ORDER BY nombre
    `);

    res.render('admin/restaurante-crear', {
      title: 'Crear Nuevo Restaurante - Admin',
      user: req.session.user,
      categorias,
      path: req.path
    });
  } catch (error) {
    console.error('Error loading create restaurant page:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando página de creación',
      error: {}
    });
  }
});

// Procesar creación de restaurante
router.post('/restaurantes/crear', requireAdmin, [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
  body('apellido').trim().notEmpty().withMessage('El apellido es requerido'),
  body('email').trim().isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('restaurante_nombre').trim().notEmpty().withMessage('El nombre del restaurante es requerido'),
  body('restaurante_descripcion').trim().isLength({ min: 20 })
    .withMessage('La descripción debe tener al menos 20 caracteres'),
  body('restaurante_direccion').trim().notEmpty().withMessage('La dirección es requerida'),
  body('categoria_id').isInt().withMessage('Selecciona una categoría válida')
], async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    await connection.beginTransaction();

    // Check if email already exists
    const [existingUser] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [req.body.email]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Create user
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const [userResult] = await connection.execute(
      `INSERT INTO usuarios (nombre, apellido, email, password, tipo_usuario, telefono)
       VALUES (?, ?, ?, ?, 'restaurante', ?)`,
      [
        req.body.nombre,
        req.body.apellido,
        req.body.email,
        hashedPassword,
        req.body.telefono || null
      ]
    );

    const userId = userResult.insertId;

    // Create restaurant
    const [restaurantResult] = await connection.execute(
      `INSERT INTO restaurantes (
        usuario_id, nombre, descripcion, direccion, telefono,
        horario_apertura, horario_cierre, activo, verificado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        req.body.restaurante_nombre,
        req.body.restaurante_descripcion,
        req.body.restaurante_direccion,
        req.body.restaurante_telefono || null,
        req.body.horario_apertura || '09:00:00',
        req.body.horario_cierre || '22:00:00',
        req.body.activo ? 1 : 0,
        req.body.verificado ? 1 : 0
      ]
    );

    const restaurantId = restaurantResult.insertId;

    // Add category
    await connection.execute(
      'INSERT INTO restaurante_categorias (restaurante_id, categoria_id) VALUES (?, ?)',
      [restaurantId, req.body.categoria_id]
    );

    await connection.commit();

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'crear_restaurante',
      `Restaurante creado: ${req.body.restaurante_nombre}`,
      'restaurante',
      restaurantId,
      null,
      { 
        nombre: req.body.restaurante_nombre,
        email: req.body.email,
        activo: req.body.activo ? 1 : 0
      },
      req
    );

    res.json({
      success: true,
      message: 'Restaurante creado exitosamente',
      restaurant_id: restaurantId
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error creating restaurant:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando restaurante'
    });
  } finally {
    connection.release();
  }
});

// Editar restaurante
router.get('/restaurantes/:id/editar', requireAdmin, async (req, res) => {
  try {
    const restaurantId = req.params.id;
    
    const [restaurantes] = await db.execute(`
      SELECT r.*, u.nombre as usuario_nombre, u.apellido as usuario_apellido, u.email as usuario_email, u.telefono as usuario_telefono
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ?
    `, [restaurantId]);
    
    if (restaurantes.length === 0) {
      return res.status(404).render('error', {
        title: 'Restaurante No Encontrado',
        message: 'El restaurante que buscas no existe',
        error: {}
      });
    }
    
    const [categorias] = await db.execute(`
      SELECT * FROM categorias_restaurantes WHERE activa = 1 ORDER BY nombre
    `);
    
    const [restauranteCategoria] = await db.execute(`
      SELECT categoria_id FROM restaurante_categorias WHERE restaurante_id = ?
    `, [restaurantId]);

    res.render('admin/restaurante-editar', {
      title: `Editar ${restaurantes[0].nombre} - Admin`,
      user: req.session.user,
      restaurante: {
        ...restaurantes[0],
        dias_operacion: (() => {
          // Aplicar la misma lógica que en el dashboard del restaurante
          let diasOperacionParsed = null;
          try {
            if (restaurantes[0].dias_operacion) {
              if (Array.isArray(restaurantes[0].dias_operacion)) {
                diasOperacionParsed = restaurantes[0].dias_operacion;
              } else if (typeof restaurantes[0].dias_operacion === 'string') {
                const diasOperacionClean = restaurantes[0].dias_operacion.trim();
                if (diasOperacionClean) {
                  diasOperacionParsed = JSON.parse(diasOperacionClean);
                }
              }
            }
          } catch (e) {
            console.error('Error al procesar dias_operacion en admin:', e);
          }

          // Si no hay días de operación o hubo error, usar valor por defecto
          if (!diasOperacionParsed || !Array.isArray(diasOperacionParsed)) {
            diasOperacionParsed = [1,2,3,4,5,6,7];
          }

          // Asegurarnos de que todos los valores sean números
          diasOperacionParsed = diasOperacionParsed.map(dia => parseInt(dia)).filter(dia => !isNaN(dia));
          
          return JSON.stringify(diasOperacionParsed);
        })()
      },
      categorias,
      categoriaActual: restauranteCategoria[0]?.categoria_id || null,
      path: req.path
    });
  } catch (error) {
    console.error('Error loading edit restaurant page:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando página de edición',
      error: {}
    });
  }
});

// Procesar edición de restaurante
router.post('/restaurantes/:id/editar', requireAdmin, upload.none(), [
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('apellido').notEmpty().withMessage('El apellido es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('restaurante_nombre').notEmpty().withMessage('El nombre del restaurante es requerido'),
  body('restaurante_descripcion').isLength({ min: 20 }).withMessage('La descripción debe tener al menos 20 caracteres'),
  body('restaurante_direccion').notEmpty().withMessage('La dirección es requerida')
], async (req, res) => {
  console.log('=== INICIO EDICIÓN RESTAURANTE ===');
  console.log('URL:', req.url);
  console.log('Método:', req.method);
  console.log('Body completo:', req.body);
  console.log('Parámetros:', req.params);
  
  const connection = await db.getConnection();
  
  try {
    const restaurantId = req.params.id;
    const errors = validationResult(req);
    
    console.log('Errores de validación:', errors.array());
    
    if (!errors.isEmpty()) {
      console.log('Validación falló, redirigiendo con error');
      return res.redirect(`/admin/restaurantes/${restaurantId}/editar?error=validation`);
    }

    console.log('Validación pasó, continuando...');

    const {
      nombre, apellido, email, telefono,
      restaurante_nombre, restaurante_descripcion, restaurante_direccion,
      restaurante_telefono, categoria_id, horario_apertura, horario_cierre,
      activo, verificado, dias_operacion
    } = req.body;

    // LOGS PARA DEPURAR
    console.log('--- EDICIÓN DE RESTAURANTE ---');
    console.log('Body recibido:', req.body);
    console.log('Valor recibido de verificado:', verificado);
    console.log('Valor recibido de activo:', activo);
    console.log('Días de operación recibidos:', dias_operacion);
    
    // Procesar días de operación
    let diasOperacionJSON = null;
    if (dias_operacion && Array.isArray(dias_operacion) && dias_operacion.length > 0) {
        diasOperacionJSON = JSON.stringify(dias_operacion.map(dia => parseInt(dia)));
    }
    console.log('Días de operación procesados:', diasOperacionJSON);
    
    // Get current data for logging
    const [currentData] = await connection.execute(`
      SELECT r.*, u.nombre as usuario_nombre, u.apellido as usuario_apellido, u.email as usuario_email, u.telefono as usuario_telefono
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ?
    `, [restaurantId]);

    console.log('Datos actuales del restaurante:', currentData[0]);

    if (currentData.length === 0) {
      console.log('Restaurante no encontrado');
      return res.status(404).redirect('/admin/restaurantes?error=not_found');
    }

    await connection.beginTransaction();
    console.log('Transacción iniciada');

    // Update user
    console.log('Actualizando usuario con datos:', { nombre, apellido, email, telefono });
    await connection.execute(
      `UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, telefono = ?
       WHERE id = ?`,
      [nombre, apellido, email, telefono || null, currentData[0].usuario_id]
    );
    console.log('Usuario actualizado');

    // Update restaurant
    console.log('Guardando verificado como:', verificado ? 1 : 0);
    console.log('Guardando activo como:', activo ? 1 : 0);
    await connection.execute(
      `UPDATE restaurantes SET 
        nombre = ?, descripcion = ?, direccion = ?, telefono = ?,
        horario_apertura = ?, horario_cierre = ?, dias_operacion = ?, activo = ?, verificado = ?
       WHERE id = ?`,
      [
        restaurante_nombre, restaurante_descripcion, restaurante_direccion,
        restaurante_telefono || null, horario_apertura || '09:00:00', 
        horario_cierre || '22:00:00', diasOperacionJSON, activo ? 1 : 0, verificado ? 1 : 0,
        restaurantId
      ]
    );
    console.log('Restaurante actualizado');

    // Update category if provided
    if (categoria_id) {
      await connection.execute(
        'DELETE FROM restaurante_categorias WHERE restaurante_id = ?',
        [restaurantId]
      );
      await connection.execute(
        'INSERT INTO restaurante_categorias (restaurante_id, categoria_id) VALUES (?, ?)',
        [restaurantId, categoria_id]
      );
      console.log('Categoría actualizada');
    }

    await connection.commit();
    console.log('Transacción confirmada');

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'editar_restaurante',
      `Restaurante editado: ${restaurante_nombre}`,
      'restaurante',
      restaurantId,
      currentData[0],
      { nombre: restaurante_nombre, email, activo: activo ? 1 : 0 },
      req
    );

    console.log('Redirigiendo a éxito');
    res.redirect(`/admin/restaurantes/${restaurantId}?success=updated`);

  } catch (error) {
    await connection.rollback();
    console.error('Error updating restaurant:', error);
    console.log('Redirigiendo a error del servidor');
    res.redirect(`/admin/restaurantes/${req.params.id}/editar?error=server`);
  } finally {
    connection.release();
    console.log('=== FIN EDICIÓN RESTAURANTE ===');
  }
});

// Toggle restaurant status
router.post('/restaurantes/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const restaurantId = req.params.id;
    const { accion } = req.body;
    
    const nuevoEstado = accion === 'activar' ? 1 : 0;
    
    await db.execute(
      'UPDATE restaurantes SET activo = ? WHERE id = ?',
      [nuevoEstado, restaurantId]
    );

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      accion === 'activar' ? 'activar_restaurante' : 'desactivar_restaurante',
      `Restaurante ${accion}do`,
      'restaurante',
      restaurantId,
      null,
      { activo: nuevoEstado },
      req
    );

    res.json({ success: true, message: `Restaurante ${accion}do exitosamente` });
  } catch (error) {
    console.error('Error toggling restaurant status:', error);
    res.status(500).json({ success: false, message: 'Error cambiando estado del restaurante' });
  }
});

// Delete restaurant
router.delete('/restaurantes/:id/eliminar', requireAdmin, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const restaurantId = req.params.id;
    
    // Get restaurant data for logging
    const [restaurantData] = await connection.execute(`
      SELECT r.*, u.nombre as usuario_nombre, u.apellido as usuario_apellido, u.email as usuario_email, u.telefono as usuario_telefono
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ?
    `, [restaurantId]);

    if (restaurantData.length === 0) {
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado' });
    }

    await connection.beginTransaction();

    // Delete in order due to foreign keys
    await connection.execute('DELETE FROM items_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE restaurante_id = ?)', [restaurantId]);
    await connection.execute('DELETE FROM pedidos WHERE restaurante_id = ?', [restaurantId]);
    await connection.execute('DELETE FROM productos WHERE restaurante_id = ?', [restaurantId]);
    await connection.execute('DELETE FROM categorias_productos WHERE restaurante_id = ?', [restaurantId]);
    await connection.execute('DELETE FROM restaurante_categorias WHERE restaurante_id = ?', [restaurantId]);
    await connection.execute('DELETE FROM cobros_semanales WHERE restaurante_id = ?', [restaurantId]);
    await connection.execute('DELETE FROM ventas_diarias WHERE restaurante_id = ?', [restaurantId]);
    await connection.execute('DELETE FROM restaurantes WHERE id = ?', [restaurantId]);
    await connection.execute('DELETE FROM usuarios WHERE id = ?', [restaurantData[0].usuario_id]);

    await connection.commit();

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'eliminar_restaurante',
      `Restaurante eliminado: ${restaurantData[0].nombre}`,
      'restaurante',
      restaurantId,
      restaurantData[0],
      null,
      req
    );

    res.json({ success: true, message: 'Restaurante eliminado exitosamente' });

  } catch (error) {
    await connection.rollback();
    console.error('Error deleting restaurant:', error);
    res.status(500).json({ success: false, message: 'Error eliminando restaurante' });
  } finally {
    connection.release();
  }
});

// ========== GESTIÓN DE PRODUCTOS ==========

// Listar productos
router.get('/productos', requireAdmin, async (req, res) => {
  try {
    const { restaurante, search, categoria, disponible, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = `
      SELECT p.*, r.nombre as restaurante_nombre, cp.nombre as categoria_nombre
      FROM productos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE 1=1
    `;
    
    let countSql = `
      SELECT COUNT(*) as total_count
      FROM productos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE 1=1
    `;
    
    const params = [];
    const countParams = [];
    
    if (restaurante) {
      sql += ` AND p.restaurante_id = ?`;
      countSql += ` AND p.restaurante_id = ?`;
      params.push(restaurante);
      countParams.push(restaurante);
    }
    
    if (search) {
      sql += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ?)`;
      countSql += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (categoria) {
      sql += ` AND cp.nombre = ?`;
      countSql += ` AND cp.nombre = ?`;
      params.push(categoria);
      countParams.push(categoria);
    }
    
    if (disponible !== undefined && disponible !== '') {
      sql += ` AND p.disponible = ?`;
      countSql += ` AND p.disponible = ?`;
      params.push(disponible === 'true' ? 1 : 0);
      countParams.push(disponible === 'true' ? 1 : 0);
    }
    
    sql += ` ORDER BY r.nombre, p.destacado DESC, p.nombre
      LIMIT ? OFFSET ?`;

    params.push(parseInt(limit), offset);
    
    const [productos] = await db.execute(sql, params);
    const [totalCountResult] = await db.execute(countSql, countParams);
    const totalProductos = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalProductos / parseInt(limit));
    
    // Get restaurants and categories for filters
    const [restaurantes] = await db.execute(`
      SELECT id, nombre FROM restaurantes ORDER BY nombre
    `);
    
    // Obtener categorías globales para el filtro y el formulario
    const [categorias] = await db.execute(`
      SELECT id, nombre FROM categorias_productos WHERE restaurante_id IS NULL AND activa = 1 ORDER BY orden_display, nombre
    `);

    res.render('admin/productos', {
      title: 'Gestión de Productos - Admin',
      user: req.session.user,
      productos,
      restaurantes,
      categorias, // <-- ahora sí se envía 'categorias'
      filtros: { restaurante: restaurante || '', search: search || '', categoria: categoria || '', disponible: disponible || '' },
      currentPage: parseInt(page),
      totalPages,
      path: req.path
    });
  } catch (error) {
    console.error('Error loading products:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando productos',
      error: {}
    });
  }
});

// Crear producto
router.post('/productos/crear', requireAdmin, [ 
  body('restaurante_id').isInt().withMessage('ID de restaurante inválido'),
  body('nombre').trim().notEmpty().withMessage('El nombre del producto es requerido'),
  body('descripcion').trim().notEmpty().withMessage('La descripción es requerida'),
  body('precio').isFloat({ gt: 0 }).withMessage('El precio debe ser un número positivo'),
  body('categoria_id').isInt().withMessage('ID de categoría inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { restaurante_id, nombre, descripcion, precio, categoria_id, imagen_url, destacado, activo } = req.body;

    const [result] = await db.execute(
      `INSERT INTO productos (
        restaurante_id, nombre, descripcion, precio, categoria_id, imagen_url, destacado, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        restaurante_id,
        nombre,
        descripcion,
        precio,
        categoria_id,
        imagen_url || null,
        destacado ? 1 : 0,
        activo ? 1 : 0,
      ]
    );

    await logAdminActivity(
      req.session.user.id,
      'crear_producto',
      `Producto creado: ${nombre} (ID: ${result.insertId})`,
      'producto',
      result.insertId,
      null,
      req.body,
      req
    );

    res.json({ success: true, message: 'Producto creado exitosamente', producto_id: result.insertId });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Error creando producto' });
  }
});

// Actualizar producto
router.put('/productos/:id/editar', requireAdmin, [
  body('restaurante_id').isInt().withMessage('ID de restaurante inválido'),
  body('nombre').trim().notEmpty().withMessage('El nombre del producto es requerido'),
  body('descripcion').trim().notEmpty().withMessage('La descripción es requerida'),
  body('precio').isFloat({ gt: 0 }).withMessage('El precio debe ser un número positivo'),
  body('categoria_id').isInt().withMessage('ID de categoría inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const productId = req.params.id;
    const { restaurante_id, nombre, descripcion, precio, categoria_id, imagen_url, destacado, activo } = req.body;

    const [currentData] = await db.execute('SELECT * FROM productos WHERE id = ?', [productId]);
    if (currentData.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    await db.execute(
      `UPDATE productos SET
        restaurante_id = ?, nombre = ?, descripcion = ?, precio = ?, categoria_id = ?, imagen_url = ?, destacado = ?, activo = ?
       WHERE id = ?`,
      [
        restaurante_id,
        nombre,
        descripcion,
        precio,
        categoria_id,
        imagen_url || null,
        destacado ? 1 : 0,
        activo ? 1 : 0,
        productId,
      ]
    );

    await logAdminActivity(
      req.session.user.id,
      'editar_producto',
      `Producto editado: ${nombre} (ID: ${productId})`,
      'producto',
      productId,
      currentData[0],
      req.body,
      req
    );

    res.json({ success: true, message: 'Producto actualizado exitosamente' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Error actualizando producto' });
  }
});

// Eliminar producto
router.delete('/productos/:id/eliminar', requireAdmin, async (req, res) => {
  try {
    const productId = req.params.id;

    const [currentData] = await db.execute('SELECT * FROM productos WHERE id = ?', [productId]);
    if (currentData.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    await db.execute('DELETE FROM productos WHERE id = ?', [productId]);

    await logAdminActivity(
      req.session.user.id,
      'eliminar_producto',
      `Producto eliminado: ${currentData[0].nombre} (ID: ${productId})`,
      'producto',
      productId,
      currentData[0],
      null,
      req
    );

    res.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Error eliminando producto' });
  }
});

// Toggle disponibilidad de producto
router.post('/productos/:id/toggle-disponibilidad', requireAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    const { activo } = req.body;

    const [currentData] = await db.execute('SELECT * FROM productos WHERE id = ?', [productId]);
    if (currentData.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    const nuevoEstado = activo ? 1 : 0;

    await db.execute('UPDATE productos SET activo = ? WHERE id = ?', [nuevoEstado, productId]);

    await logAdminActivity(
      req.session.user.id,
      'toggle_disponibilidad_producto',
      `Disponibilidad de producto ${currentData[0].nombre} (ID: ${productId}) cambiada a ${nuevoEstado ? 'activo' : 'inactivo'}`,
      'producto',
      productId,
      { activo: currentData[0].activo },
      { activo: nuevoEstado },
      req
    );

    res.json({ success: true, message: 'Disponibilidad de producto actualizada exitosamente' });
  } catch (error) {
    console.error('Error toggling product availability:', error);
    res.status(500).json({ success: false, message: 'Error actualizando disponibilidad del producto' });
  }
});

// Listar cobros semanales
router.get('/cobros', requireAdmin, async (req, res) => {
  try {
    const { restaurante, estado, periodo } = req.query;
    
    let sql = `
      SELECT cs.*, r.nombre as restaurante_nombre,
             COUNT(cp.id) as comprobantes_count,
             SUM(CASE WHEN cp.estado = 'aprobado' THEN cp.monto_pagado ELSE 0 END) as monto_pagado_total
      FROM cobros_semanales cs
      JOIN restaurantes r ON cs.restaurante_id = r.id
      LEFT JOIN comprobantes_pago cp ON cs.id = cp.cobro_semanal_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (restaurante) {
      sql += ` AND cs.restaurante_id = ?`;
      params.push(restaurante);
    }
    
    if (estado) {
      sql += ` AND cs.estado = ?`;
      params.push(estado);
    }
    
    if (periodo) {
      sql += ` AND cs.semana_inicio >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
      const dias = periodo === '30' ? 30 : periodo === '90' ? 90 : 7;
      params.push(dias);
    }
    
    sql += ` GROUP BY cs.id ORDER BY cs.semana_inicio DESC`;
    
    const [cobros] = await db.execute(sql, params);
    
    // Get restaurants for filter
    const [restaurantes] = await db.execute(`
      SELECT id, nombre FROM restaurantes ORDER BY nombre
    `);

    res.render('admin/cobros', {
      title: 'Gestión de Cobros - Admin',
      user: req.session.user,
      cobros,
      restaurantes,
      filtros: { restaurante: restaurante || '', estado: estado || '', periodo: periodo || '' },
      path: req.path
    });
  } catch (error) {
    console.error('Error loading charges:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando cobros',
      error: {}
    });
  }
});

// Generar cobros semanales - Página
router.get('/cobros/generar', requireAdmin, async (req, res) => {
  try {
    // Obtener restaurantes activos
    const [restaurantes] = await db.execute(`
      SELECT id, nombre 
      FROM restaurantes 
      WHERE activo = 1 
      ORDER BY nombre
    `);

    // Obtener el último cobro generado para cada restaurante
    const [ultimosCobros] = await db.execute(`
      SELECT 
        restaurante_id,
        MAX(semana_fin) as ultima_semana
      FROM cobros_semanales
      GROUP BY restaurante_id
    `);

    // Crear un mapa de últimos cobros por restaurante
    const ultimosCobrosMap = ultimosCobros.reduce((map, cobro) => {
      map[cobro.restaurante_id] = cobro.ultima_semana;
      return map;
    }, {});

    res.render('admin/cobros-generar', {
      title: 'Generar Cobros - Admin',
      user: req.session.user,
      restaurantes,
      ultimosCobros: ultimosCobrosMap,
      path: req.path
    });
  } catch (error) {
    console.error('Error loading generate charges page:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando página de generación de cobros',
      error: {}
    });
  }
});

// Generar cobros semanales
router.post('/cobros/generar', requireAdmin, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { fecha_inicio, fecha_fin, restaurante_ids } = req.body;
    
    // If no specific restaurants, get all active ones
    let restaurantesToProcess;
    if (restaurante_ids && restaurante_ids.length > 0) {
      const placeholders = restaurante_ids.map(() => '?').join(',');
      const [restaurants] = await connection.execute(
        `SELECT id FROM restaurantes WHERE id IN (${placeholders}) AND activo = 1`,
        restaurante_ids
      );
      restaurantesToProcess = restaurants;
    } else {
      const [restaurants] = await connection.execute(
        'SELECT id FROM restaurantes WHERE activo = 1'
      );
      restaurantesToProcess = restaurants;
    }

    await connection.beginTransaction();

    let cobrosGenerados = 0;

    for (const restaurant of restaurantesToProcess) {
      // Check if charge already exists for this period
      const [existingCharge] = await connection.execute(
        'SELECT id FROM cobros_semanales WHERE restaurante_id = ? AND semana_inicio = ?',
        [restaurant.id, fecha_inicio]
      );

      if (existingCharge.length > 0) {
        continue; // Skip if already exists
      }

      // Calculate sales for the period
      const [salesData] = await connection.execute(`
        SELECT 
          COALESCE(SUM(total), 0) as ventas_brutas,
          COUNT(*) as total_pedidos
        FROM pedidos 
        WHERE restaurante_id = ? 
          AND fecha_pedido >= ? 
          AND fecha_pedido <= ? 
          AND estado = 'entregado'
      `, [restaurant.id, fecha_inicio, fecha_fin]);

      const ventasBrutas = salesData[0].ventas_brutas || 0;
      const montoComision = ventasBrutas * 0.10; // 10%

      // Insert charge
      await connection.execute(`
        INSERT INTO cobros_semanales 
        (restaurante_id, semana_inicio, semana_fin, ventas_brutas, monto_comision, fecha_vencimiento)
        VALUES (?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL 7 DAY))
      `, [restaurant.id, fecha_inicio, fecha_fin, ventasBrutas, montoComision, fecha_fin]);

      // Obtener datos del restaurante para el email
      const [restData] = await connection.execute(
        'SELECT nombre, email_contacto FROM restaurantes WHERE id = ?',
        [restaurant.id]
      );
      if (restData.length > 0 && restData[0].email_contacto) {
        // Obtener el cobro recién creado
        const [cobroRows] = await connection.execute(
          'SELECT * FROM cobros_semanales WHERE restaurante_id = ? AND semana_inicio = ? LIMIT 1',
          [restaurant.id, fecha_inicio]
        );
        const cobro = cobroRows[0];
        await sendEmail(
          restData[0].email_contacto,
          'Nuevo cobro generado - A la Mesa',
          'restaurant-charge',
          {
            nombreRestaurante: restData[0].nombre,
            semana_inicio: cobro.semana_inicio,
            semana_fin: cobro.semana_fin,
            ventas_brutas: cobro.ventas_brutas,
            monto_comision: cobro.monto_comision,
            fecha_vencimiento: cobro.fecha_vencimiento
          }
        );
      }
      cobrosGenerados++;
    }

    await connection.commit();

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'generar_cobro',
      `Generados ${cobrosGenerados} cobros para período ${fecha_inicio} - ${fecha_fin}`,
      'cobro',
      null,
      null,
      { cobros_generados: cobrosGenerados, periodo: `${fecha_inicio}_${fecha_fin}` },
      req
    );

    res.json({ 
      success: true, 
      message: `Se generaron ${cobrosGenerados} cobros exitosamente`,
      cobros_generados: cobrosGenerados
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error generating charges:', error);
    res.status(500).json({ success: false, message: 'Error generando cobros' });
  } finally {
    connection.release();
  }
});

// ========== GESTIÓN DE PRODUCTOS ==========

// Listar productos
router.get('/productos', requireAdmin, async (req, res) => {
  try {
    const { restaurante, search, categoria, disponible, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = `
      SELECT p.*, r.nombre as restaurante_nombre, cp.nombre as categoria_nombre
      FROM productos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE 1=1
    `;
    
    let countSql = `
      SELECT COUNT(*) as total_count
      FROM productos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE 1=1
    `;
    
    const params = [];
    const countParams = [];
    
    if (restaurante) {
      sql += ` AND p.restaurante_id = ?`;
      countSql += ` AND p.restaurante_id = ?`;
      params.push(restaurante);
      countParams.push(restaurante);
    }
    
    if (search) {
      sql += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ?)`;
      countSql += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (categoria) {
      sql += ` AND cp.nombre = ?`;
      countSql += ` AND cp.nombre = ?`;
      params.push(categoria);
      countParams.push(categoria);
    }
    
    if (disponible !== undefined && disponible !== '') {
      sql += ` AND p.disponible = ?`;
      countSql += ` AND p.disponible = ?`;
      params.push(disponible === 'true' ? 1 : 0);
      countParams.push(disponible === 'true' ? 1 : 0);
    }
    
    sql += ` ORDER BY r.nombre, p.destacado DESC, p.nombre
      LIMIT ? OFFSET ?`;

    params.push(parseInt(limit), offset);
    
    const [productos] = await db.execute(sql, params);
    const [totalCountResult] = await db.execute(countSql, countParams);
    const totalProductos = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalProductos / parseInt(limit));
    
    // Get restaurants and categories for filters
    const [restaurantes] = await db.execute(`
      SELECT id, nombre FROM restaurantes ORDER BY nombre
    `);
    
    // Obtener categorías globales para el filtro y el formulario
    const [categorias] = await db.execute(`
      SELECT id, nombre FROM categorias_productos WHERE restaurante_id IS NULL AND activa = 1 ORDER BY orden_display, nombre
    `);

    res.render('admin/productos', {
      title: 'Gestión de Productos - Admin',
      user: req.session.user,
      productos,
      restaurantes,
      categorias, // <-- ahora sí se envía 'categorias'
      filtros: { restaurante: restaurante || '', search: search || '', categoria: categoria || '', disponible: disponible || '' },
      currentPage: parseInt(page),
      totalPages,
      path: req.path
    });
  } catch (error) {
    console.error('Error loading products:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando productos',
      error: {}
    });
  }
});

// Crear producto
router.post('/productos/crear', requireAdmin, [
  body('restaurante_id').isInt().withMessage('Selecciona un restaurante válido'),
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('descripcion').isLength({ min: 10 }).withMessage('La descripción debe tener al menos 10 caracteres'),
  body('precio').isFloat({ min: 0 }).withMessage('El precio debe ser válido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { restaurante_id, nombre, descripcion, precio, categoria_id, destacado, disponible } = req.body;

    const [result] = await db.execute(`
      INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, destacado, disponible)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [restaurante_id, categoria_id || null, nombre, descripcion, precio, destacado ? 1 : 0, disponible ? 1 : 0]);

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'crear_producto',
      `Producto creado: ${nombre}`,
      'producto',
      result.insertId,
      null,
      { nombre, precio, restaurante_id },
      req
    );

    res.json({ success: true, message: 'Producto creado exitosamente', producto_id: result.insertId });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Error creando producto' });
  }
});

// Eliminar producto
router.delete('/productos/:id/eliminar', requireAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Get product data for logging
    const [productData] = await db.execute(
      'SELECT * FROM productos WHERE id = ?',
      [productId]
    );

    if (productData.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    await db.execute('DELETE FROM productos WHERE id = ?', [productId]);

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'eliminar_producto',
      `Producto eliminado: ${productData[0].nombre}`,
      'producto',
      productId,
      productData[0],
      null,
      req
    );

    res.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Error eliminando producto' });
  }
});

// Toggle disponibilidad de producto
router.post('/productos/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    const { disponible } = req.body;
    
    await db.execute(
      'UPDATE productos SET disponible = ? WHERE id = ?',
      [disponible ? 1 : 0, productId]
    );

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'editar_producto',
      `Producto ${disponible ? 'activado' : 'desactivado'}`,
      'producto',
      productId,
      null,
      { disponible: disponible ? 1 : 0 },
      req
    );

    res.json({ success: true, message: `Producto marcado como ${disponible ? 'disponible' : 'no disponible'}` });
  } catch (error) {
    console.error('Error toggling product availability:', error);
    res.status(500).json({ success: false, message: 'Error cambiando disponibilidad del producto' });
  }
});

// Mark charge as paid manually
router.post('/cobros/:id/marcar-pagado', requireAdmin, async (req, res) => {
  try {
    const cobroId = req.params.id;
    
    await db.execute(
      'UPDATE cobros_semanales SET estado = ?, fecha_pago = NOW() WHERE id = ?',
      ['pagado', cobroId]
    );

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'aprobar_pago',
      `Cobro marcado como pagado manualmente`,
      'cobro',
      cobroId,
      null,
      { estado: 'pagado', pago_manual: true },
      req
    );

    res.json({ success: true, message: 'Cobro marcado como pagado exitosamente' });
  } catch (error) {
    console.error('Error marking charge as paid:', error);
    res.status(500).json({ success: false, message: 'Error marcando cobro como pagado' });
  }
});

// Approve all pending receipts
router.post('/comprobantes/aprobar-pendientes', requireAdmin, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // Get all pending receipts
    const [pendientes] = await connection.execute(`
      SELECT cp.*, cs.id as cobro_id
      FROM comprobantes_pago cp
      JOIN cobros_semanales cs ON cp.cobro_semanal_id = cs.id
      WHERE cp.estado = 'pendiente'
    `);

    if (pendientes.length === 0) {
      await connection.rollback();
      return res.json({ success: false, message: 'No hay comprobantes pendientes' });
    }

    // Approve all pending receipts
    await connection.execute(`
      UPDATE comprobantes_pago 
      SET estado = 'aprobado', fecha_revision = NOW(), admin_revisor_id = ?, comentarios_admin = ?
      WHERE estado = 'pendiente'
    `, [req.session.user.id, 'Aprobado automáticamente por administrador']);

    // Update corresponding charges to paid
    const cobroIds = [...new Set(pendientes.map(p => p.cobro_id))];
    const placeholders = cobroIds.map(() => '?').join(',');
    
    await connection.execute(`
      UPDATE cobros_semanales 
      SET estado = 'pagado', fecha_pago = NOW()
      WHERE id IN (${placeholders})
    `, cobroIds);

    await connection.commit();

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'aprobar_pago',
      `Aprobados ${pendientes.length} comprobantes masivamente`,
      'comprobante',
      null,
      null,
      { comprobantes_aprobados: pendientes.length },
      req
    );

    res.json({ 
      success: true, 
      message: `${pendientes.length} comprobantes aprobados exitosamente`,
      aprobados: pendientes.length
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error approving pending receipts:', error);
    res.status(500).json({ success: false, message: 'Error aprobando comprobantes pendientes' });
  } finally {
    connection.release();
  }
});

// Export charges
router.get('/cobros/export', requireAdmin, async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const [cobros] = await db.execute(`
      SELECT cs.*, r.nombre as restaurante_nombre,
             COUNT(cp.id) as comprobantes_count,
             SUM(CASE WHEN cp.estado = 'aprobado' THEN cp.monto_pagado ELSE 0 END) as monto_pagado_total
      FROM cobros_semanales cs
      JOIN restaurantes r ON cs.restaurante_id = r.id
      LEFT JOIN comprobantes_pago cp ON cs.id = cp.cobro_semanal_id
      GROUP BY cs.id
      ORDER BY cs.semana_inicio DESC
    `);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=cobros.csv');
      
      let csv = 'ID,Restaurante,Período Inicio,Período Fin,Ventas Brutas,Comisión,Estado,Vencimiento,Comprobantes,Monto Pagado\\n';
      
      cobros.forEach(c => {
        csv += `${c.id},"${c.restaurante_nombre}",${c.semana_inicio},${c.semana_fin},${c.ventas_brutas},${c.monto_comision},${c.estado},${c.fecha_vencimiento},${c.comprobantes_count},${c.monto_pagado_total || 0}\\n`;
      });
      
      res.send(csv);
    } else {
      res.json(cobros);
    }

  } catch (error) {
    console.error('Error exporting charges:', error);
    res.status(500).json({ success: false, message: 'Error exportando cobros' });
  }
});

// Export products
router.get('/productos/export', requireAdmin, async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const [productos] = await db.execute(`
      SELECT p.*, r.nombre as restaurante_nombre, cp.nombre as categoria_nombre
      FROM productos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      ORDER BY r.nombre, p.nombre
    `);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=productos.csv');
      
      let csv = 'ID,Restaurante,Producto,Categoría,Precio,Destacado,Disponible,Fecha Creación\\n';
      
      productos.forEach(p => {
        csv += `${p.id},"${p.restaurante_nombre}","${p.nombre}","${p.categoria_nombre || 'Sin categoría'}",${p.precio},${p.destacado ? 'Sí' : 'No'},${p.disponible ? 'Sí' : 'No'},${p.fecha_creacion}\\n`;
      });
      
      res.send(csv);
    } else {
      res.json(productos);
    }

  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({ success: false, message: 'Error exportando productos' });
  }
});

// Export receipts
router.get('/comprobantes/export', requireAdmin, async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const [comprobantes] = await db.execute(`
      SELECT cp.*, cs.semana_inicio, cs.semana_fin, cs.monto_comision,
             r.nombre as restaurante_nombre
      FROM comprobantes_pago cp
      JOIN cobros_semanales cs ON cp.cobro_semanal_id = cs.id
      JOIN restaurantes r ON cp.restaurante_id = r.id
      ORDER BY cp.fecha_subida DESC
    `);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=comprobantes.csv');
      
      let csv = 'ID,Restaurante,Período,Método Pago,Monto,Estado,Fecha Subida,Fecha Revisión\\n';
      
      comprobantes.forEach(c => {
        csv += `${c.id},"${c.restaurante_nombre}","${c.semana_inicio} - ${c.semana_fin}","${c.metodo_pago}",${c.monto_pagado},${c.estado},${c.fecha_subida},${c.fecha_revision || 'N/A'}\\n`;
      });
      
      res.send(csv);
    } else {
      res.json(comprobantes);
    }

  } catch (error) {
    console.error('Error exporting receipts:', error);
    res.status(500).json({ success: false, message: 'Error exportando comprobantes' });
  }
});

// Export restaurants
router.get('/restaurantes/export', requireAdmin, async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const [restaurantes] = await db.execute(`
      SELECT r.*, u.nombre as propietario_nombre, u.apellido as propietario_apellido, 
             u.email, u.telefono,
             COUNT(DISTINCT p.id) as total_productos,
             COUNT(DISTINCT pd.id) as total_pedidos,
             COALESCE(SUM(pd.total), 0) as ventas_totales
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      LEFT JOIN productos p ON r.id = p.restaurante_id
      LEFT JOIN pedidos pd ON r.id = pd.restaurante_id AND pd.estado != 'cancelled'
      GROUP BY r.id
      ORDER BY r.fecha_registro DESC
    `);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=restaurantes.csv');
      
      let csv = 'ID,Nombre Restaurante,Propietario,Email,Telefono,Direccion,Activo,Verificado,Total Productos,Total Pedidos,Ventas Totales,Fecha Registro\\n';
      
      restaurantes.forEach(r => {
        csv += `${r.id},"${r.nombre}\",\"${r.propietario_nombre} ${r.propietario_apellido}\",${r.email},${r.telefono || ''},\"${r.direccion}\",${r.activo ? 'Sí' : 'No'},${r.verificado ? 'Sí' : 'No'},${r.total_productos},${r.total_pedidos},${r.ventas_totales},${r.fecha_registro}\\n`;
      });
      
      res.send(csv);
    } else {
      res.json(restaurantes);
    }

  } catch (error) {
    console.error('Error exporting restaurants:', error);
    res.status(500).json({ success: false, message: 'Error exportando datos' });
  }
});

// Generar reporte de actividad
router.get('/reportes', requireAdmin, async (req, res) => {
  try {
    // Get recent admin activity
    const [actividad] = await db.execute(`
      SELECT aa.*, u.nombre, u.apellido
      FROM actividad_admin aa
      JOIN usuarios u ON aa.admin_id = u.id
      ORDER BY aa.fecha_accion DESC
      LIMIT 50
    `);

    // Get summary stats
    const [statsHoy] = await db.execute(`
      SELECT 
        COUNT(DISTINCT CASE WHEN DATE(fecha_pedido) = CURDATE() THEN id END) as pedidos_hoy,
        COALESCE(SUM(CASE WHEN DATE(fecha_pedido) = CURDATE() THEN total ELSE 0 END), 0) as ventas_hoy,
        COUNT(DISTINCT CASE WHEN DATE(fecha_pedido) = CURDATE() - INTERVAL 1 DAY THEN id END) as pedidos_ayer,
        COALESCE(SUM(CASE WHEN DATE(fecha_pedido) = CURDATE() - INTERVAL 1 DAY THEN total ELSE 0 END), 0) as ventas_ayer
      FROM pedidos 
      WHERE estado != 'cancelled'
    `);

    res.render('admin/reportes', {
      title: 'Reportes y Actividad - Admin',
      user: req.session.user,
      actividad,
      stats: statsHoy[0] || { pedidos_hoy: 0, ventas_hoy: 0, pedidos_ayer: 0, ventas_ayer: 0 },
      path: req.path
    });
  } catch (error) {
    console.error('Error loading reports:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando reportes',
      error: {}
    });
  }
});

router.get('/dashboard', requireAdmin, (req, res) => {
  res.redirect('/admin');
});

// Eliminar usuario
router.delete('/usuarios/:id/eliminar', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const [result] = await db.execute('DELETE FROM usuarios WHERE id = ?', [userId]);
    if (result.affectedRows > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Usuario no encontrado' });
    }
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.json({ success: false, message: 'Error eliminando usuario' });
  }
});

// ========== GESTIÓN DE COMPROBANTES ==========
router.get('/comprobantes', requireAdmin, async (req, res) => {
  try {
    const { estado, restaurante, fecha_desde, fecha_hasta } = req.query;
    let sql = `
      SELECT cp.*, r.nombre as restaurante_nombre, r.id as restaurante_id, cs.semana_inicio, cs.semana_fin, cs.ventas_brutas, cs.monto_comision
      FROM comprobantes_pago cp
      JOIN cobros_semanales cs ON cp.cobro_semanal_id = cs.id
      JOIN restaurantes r ON cs.restaurante_id = r.id
      WHERE 1=1
    `;
    const params = [];
    if (estado) {
      sql += ' AND cp.estado = ?';
      params.push(estado);
    }
    if (restaurante) {
      sql += ' AND r.id = ?';
      params.push(restaurante);
    }
    if (fecha_desde) {
      sql += ' AND cp.fecha_subida >= ?';
      params.push(fecha_desde + ' 00:00:00');
    }
    if (fecha_hasta) {
      sql += ' AND cp.fecha_subida <= ?';
      params.push(fecha_hasta + ' 23:59:59');
    }
    sql += ' ORDER BY cp.fecha_subida DESC';
    const [comprobantes] = await db.execute(sql, params);
    const [restaurantes] = await db.execute('SELECT id, nombre FROM restaurantes ORDER BY nombre');
    res.render('admin/comprobantes', {
      title: 'Gestión de Comprobantes - Admin',
      user: req.session.user,
      comprobantes,
      restaurantes,
      filtros: {
        estado: estado || '',
        restaurante: restaurante || '',
        fecha_desde: fecha_desde || '',
        fecha_hasta: fecha_hasta || ''
      },
      path: req.path
    });
  } catch (error) {
    console.error('Error cargando comprobantes:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando comprobantes',
      error: {}
    });
  }
});

// POST /admin/restaurantes/aprobar/:id
router.post('/restaurantes/aprobar/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Actualizar el estado del restaurante a 'verificado'
        await db.execute('UPDATE restaurantes SET verificado = ? WHERE id = ?', [true, id]);

        // 2. Obtener datos del restaurante y del usuario dueño
        const [rows] = await db.execute(`
            SELECT r.nombre AS nombreRestaurante, u.email, u.id AS usuarioId
            FROM restaurantes r
            JOIN usuarios u ON r.usuario_id = u.id
            WHERE r.id = ?
        `, [id]);

        if (rows.length > 0) {
            const { nombreRestaurante, email, usuarioId } = rows[0];

            // 3. Actualizar el rol del usuario
            await db.execute('UPDATE usuarios SET rol = ? WHERE id = ?', ['restaurante', usuarioId]);

            // 4. Enviar correo de aprobación
            await sendEmail(
                email,
                `¡Tu restaurante "${nombreRestaurante}" ha sido aprobado!`,
                'restaurant-approved',
                { nombreRestaurante: nombreRestaurante }
            );
        }

        res.redirect('/admin/restaurantes');
    } catch (error) {
        console.error("Error al aprobar el restaurante:", error);
        res.status(500).send('Error al aprobar el restaurante.');
    }
});

router.get('/test-cobro-email', requireAdmin, async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.send('Falta el parámetro ?email=...');
  }
  try {
    await sendEmail(
      email,
      'Prueba de cobro generado - A la Mesa',
      'restaurant-charge',
      {
        nombreRestaurante: 'Restaurante de Prueba',
        semana_inicio: '2024-07-01',
        semana_fin: '2024-07-07',
        ventas_brutas: 123456.78,
        monto_comision: 12345.67,
        fecha_vencimiento: '2024-07-14'
      }
    );
    res.send('Correo de prueba enviado a ' + email);
  } catch (error) {
    res.status(500).send('Error enviando correo: ' + error.message);
  }
});

// Revisar comprobante individual (GET)
router.get('/comprobantes/:id/revisar', requireAdmin, async (req, res) => {
  try {
    const comprobanteId = req.params.id;
    const [comprobantes] = await db.execute(`
      SELECT cp.*, r.nombre as restaurante_nombre, cs.semana_inicio, cs.semana_fin, cs.monto_comision
      FROM comprobantes_pago cp
      JOIN cobros_semanales cs ON cp.cobro_semanal_id = cs.id
      JOIN restaurantes r ON cp.restaurante_id = r.id
      WHERE cp.id = ?
    `, [comprobanteId]);
    if (comprobantes.length === 0) {
      return res.status(404).render('error', { message: 'Comprobante no encontrado' });
    }
    res.render('admin/comprobante-revisar', {
      title: 'Revisar Comprobante',
      comprobante: comprobantes[0],
      user: req.session.user
    });
  } catch (error) {
    console.error('Error cargando comprobante:', error);
    res.status(500).render('error', { message: 'Error cargando comprobante', error });
  }
});

// Aprobar o rechazar comprobante (POST)
router.post('/comprobantes/:id/revisar', requireAdmin, async (req, res) => {
  try {
    const comprobanteId = req.params.id;
    const { accion, comentarios_admin } = req.body;
    let nuevoEstado = null;
    if (accion === 'aprobar') nuevoEstado = 'aprobado';
    if (accion === 'rechazar') nuevoEstado = 'rechazado';
    if (!nuevoEstado) {
      return res.status(400).json({ success: false, message: 'Acción inválida' });
    }
    await db.execute(`
      UPDATE comprobantes_pago SET estado = ?, comentarios_admin = ?, admin_revisor_id = ?, fecha_revision = NOW()
      WHERE id = ?
    `, [nuevoEstado, comentarios_admin || null, req.session.user.id, comprobanteId]);
    res.json({ success: true, message: `Comprobante ${nuevoEstado}` });
  } catch (error) {
    console.error('Error revisando comprobante:', error);
    res.status(500).json({ success: false, message: 'Error revisando comprobante' });
  }
});

module.exports = router;
