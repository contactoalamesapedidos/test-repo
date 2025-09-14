const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/auth');
const { sendEmail } = require('../config/mailer');

// ========== GESTIÓN DE COMISIONES DE REPARTIDORES ========== 

router.get('/comisiones', requireAdmin, async (req, res) => {
    try {
        const [comisiones] = await db.execute(`
            SELECT c.*, u.nombre as repartidor_nombre, u.apellido as repartidor_apellido, p.numero_pedido
            FROM comisiones c
            JOIN usuarios u ON c.repartidor_id = u.id
            JOIN pedidos p ON c.pedido_id = p.id
            ORDER BY c.fecha_creacion DESC
        `);

        res.render('admin/comisiones', {
            title: 'Comisiones de Repartidores - Admin',
            user: req.session.user,
            comisiones,
            path: req.path
        });
    } catch (error) {
        console.error('Error cargando comisiones:', error);
        res.render('error', { message: 'Error cargando la página de comisiones.' });
    }
});

// Marcar comisión como pagada
router.post('/comisiones/:id/pagar', requireAdmin, async (req, res) => {
    try {
        await db.execute("UPDATE comisiones SET estado = 'pagada', fecha_pago = NOW() WHERE id = ?", [req.params.id]);
        res.redirect('/admin/comisiones?success=1');
    } catch (error) {
        console.error('Error al marcar comisión como pagada:', error);
        res.redirect('/admin/comisiones?error=1');
    }
});

// Eliminar comisión
router.delete('/comisiones/:id/delete', requireAdmin, async (req, res) => {
    try {
        const comisionId = req.params.id;

        // Verificar que la comisión existe
        const [comision] = await db.execute('SELECT * FROM comisiones WHERE id = ?', [comisionId]);
        if (comision.length === 0) {
            return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
        }

        // Eliminar la comisión
        await db.execute('DELETE FROM comisiones WHERE id = ?', [comisionId]);

        // Log de actividad administrativa
        await logAdminActivity(
            req.session.user.id,
            'eliminar_comision',
            `Comisión eliminada: ID ${comisionId}`,
            'comision',
            comisionId,
            comision[0],
            null,
            req
        );

        res.json({ success: true, message: 'Comisión eliminada exitosamente' });
    } catch (error) {
        console.error('Error eliminando comisión:', error);
        res.status(500).json({ success: false, message: 'Error eliminando comisión' });
    }
});

// Middleware to check if user is admin
/*
const requireAdmin = (req, res, next) => {
  // Log removed for security - admin middleware access check
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  if (req.session.user.tipo_usuario !== 'admin') {
    return res.redirect('/auth/login');
  }
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
        SUM(CASE WHEN verificado = 0 THEN 1 ELSE 0 END) as no_verificados,
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

    // Contar repartidores independientes pendientes
    const [[{ independent_drivers_pending }]] = await db.execute(`
        SELECT COUNT(*) as independent_drivers_pending
        FROM drivers
        WHERE restaurante_id IS NULL AND request_status = 'pending'
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
      independentDriversPending: independent_drivers_pending,
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

const axios = require('axios');
require('dotenv').config();

// ========== GESTIÓN DE REPARTIDORES INDEPENDIENTES ========== 

// Listar repartidores independientes pendientes
router.get('/repartidores/pendientes', requireAdmin, async (req, res) => {
    try {
        const [repartidores] = await db.execute(`
            SELECT u.id, u.nombre, u.apellido, u.email, u.telefono, u.fecha_registro
            FROM usuarios u
            JOIN drivers d ON u.id = d.user_id
            WHERE d.restaurante_id IS NULL AND d.request_status = 'pending'
            ORDER BY u.fecha_registro DESC
        `);

        res.render('admin/repartidores-pendientes', {
            title: 'Repartidores Independientes Pendientes - Admin',
            user: req.session.user,
            repartidores,
            path: req.path
        });
    } catch (error) {
        console.error('Error cargando repartidores pendientes:', error);
        res.render('error', { message: 'Error cargando repartidores pendientes' });
    }
});

// Aprobar repartidor independiente
router.post('/repartidores/:id/aprobar', requireAdmin, async (req, res) => {
    try {
        const repartidorId = req.params.id;
        await db.execute(
            "UPDATE drivers SET request_status = 'accepted', status = 'offline' WHERE user_id = ? AND restaurante_id IS NULL",
            [repartidorId]
        );
        // Opcional: Enviar email de notificación
        res.redirect('/admin/repartidores/pendientes');
    } catch (error) {
        console.error('Error aprobando repartidor:', error);
        res.redirect('/admin/repartidores/pendientes?error=1');
    }
});

// Rechazar repartidor independiente
router.post('/repartidores/:id/rechazar', requireAdmin, async (req, res) => {
    try {
        const repartidorId = req.params.id;
        await db.execute(
            "UPDATE drivers SET request_status = 'rejected' WHERE user_id = ? AND restaurante_id IS NULL",
            [repartidorId]
        );
        // Opcional: Enviar email de notificación
        res.redirect('/admin/repartidores/pendientes');
    } catch (error) {
        console.error('Error rechazando repartidor:', error);
        res.redirect('/admin/repartidores/pendientes?error=1');
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

// ========== INTEGRACIÓN MERCADO PAGO OAUTH ========== 

// Redirigir para autorización
router.get('/mercadopago/auth', requireAdmin, (req, res) => {
  const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&state=${req.session.user.id}&redirect_uri=${process.env.MP_REDIRECT_URI}`;
  res.redirect(authUrl);
});

// Callback de Mercado Pago
router.get('/mercadopago/callback', requireAdmin, async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect('/admin/configuracion?error=mp_auth_failed');
  }

  try {
    // Intercambiar código por credenciales
    const response = await axios.post('https://api.mercadopago.com/oauth/token', {
      client_secret: process.env.MP_CLIENT_SECRET,
      client_id: process.env.MP_APP_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.MP_REDIRECT_URI,
    });

    const { access_token, refresh_token, user_id } = response.data;

    // Guardar credenciales en la base de datos para el admin
    await db.execute(
      `UPDATE usuarios SET mp_access_token = ?, mp_refresh_token = ?, mp_user_id = ? WHERE id = ?`,
      [access_token, refresh_token, user_id, req.session.user.id]
    );

    res.redirect('/admin/configuracion?success=mp_auth_success');
  } catch (error) {
    console.error('Error en callback de Mercado Pago:', error);
    res.redirect('/admin/configuracion?error=mp_token_failed');
  }
});

// ========== GESTIÓN DE USUARIOS ========== 
router.get('/usuarios', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { search, tipo, activo } = req.query;

    let baseSql = `FROM usuarios WHERE 1=1`;
    const filters = [];

    if (search) {
      baseSql += ` AND (nombre LIKE ? OR apellido LIKE ? OR email LIKE ? OR telefono LIKE ?)`;
      const s = `%${search}%`;
      filters.push(s, s, s, s);
    }
    if (tipo) {
      baseSql += ` AND tipo_usuario = ?`;
      filters.push(tipo);
    }
    if (activo !== undefined && activo !== '') {
      baseSql += ` AND activo = ?`;
      filters.push(activo === '1' ? 1 : 0);
    }

    const sql = `SELECT * ${baseSql} ORDER BY fecha_registro DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
    const countSql = `SELECT COUNT(*) as total_count ${baseSql}`;

    const queryParams = [...filters];
    const countParams = [...filters];

    const [usuarios] = await db.execute(sql, queryParams);
    const [totalCountResult] = await db.execute(countSql, countParams);
    const totalUsuarios = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalUsuarios / limit) || 1;

    res.render('admin/usuarios', {
      title: 'Gestión de Usuarios - A la Mesa',
      user: req.session.user,
      usuarios,
      currentPage: page,
      totalPages,
      path: req.path,
      limit,
      filtros: { search: search || '', tipo: tipo || '', activo: (activo !== undefined ? String(activo) : '') }
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

// Exportar usuarios CSV (respetando filtros actuales)
router.get('/usuarios/export', requireAdmin, async (req, res) => {
  try {
    const { search, tipo, activo } = req.query;

    let baseSql = `FROM usuarios WHERE 1=1`;
    const filters = [];

    if (search) {
      baseSql += ` AND (nombre LIKE ? OR apellido LIKE ? OR email LIKE ? OR telefono LIKE ?)`;
      const s = `%${search}%`;
      filters.push(s, s, s, s);
    }
    if (tipo) {
      baseSql += ` AND tipo_usuario = ?`;
      filters.push(tipo);
    }
    if (activo !== undefined && activo !== '') {
      baseSql += ` AND activo = ?`;
      filters.push(activo === '1' ? 1 : 0);
    }

    const sql = `SELECT id, nombre, apellido, email, telefono, ciudad, tipo_usuario, activo, fecha_registro ${baseSql} ORDER BY fecha_registro DESC`;
    const [rows] = await db.execute(sql, filters);

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (/[",\n]/.test(str)) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const header = ['id','nombre','apellido','email','telefono','ciudad','tipo_usuario','activo','fecha_registro'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        escapeCsv(r.id),
        escapeCsv(r.nombre),
        escapeCsv(r.apellido),
        escapeCsv(r.email),
        escapeCsv(r.telefono),
        escapeCsv(r.ciudad),
        escapeCsv(r.tipo_usuario),
        escapeCsv(r.activo ? 1 : 0),
        escapeCsv(r.fecha_registro)
      ].join(','));
    }

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="usuarios.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting usuarios CSV:', error);
    res.status(500).json({ success: false, message: 'Error exportando usuarios' });
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { search, estado, categoria } = req.query;
    
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

    const filterValues = [];
    
    if (search) {
      sql += ` AND (r.nombre LIKE ? OR r.email_contacto LIKE ?)`;
      countSql += ` AND (r.nombre LIKE ? OR r.email_contacto LIKE ?)`;
      filterValues.push(`%${search}%`, `%${search}%`);
    }
    
    if (estado) {
      switch(estado) {
        case 'activos':
          sql += ` AND r.activo = ?`;
          countSql += ` AND r.activo = ?`;
          filterValues.push(1);
          break;
        case 'inactivos':
          sql += ` AND r.activo = ?`;
          countSql += ` AND r.activo = ?`;
          filterValues.push(0);
          break;
        case 'verificados':
          sql += ` AND r.verificado = ?`;
          countSql += ` AND r.verificado = ?`;
          filterValues.push(1);
          break;
        case 'no_verificados':
          sql += ` AND r.verificado = ?`;
          countSql += ` AND r.verificado = ?`;
          filterValues.push(0);
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
      filterValues.push(categoria);
    }
    
    sql += ` GROUP BY 
        r.id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner,
        r.direccion, r.ciudad, r.telefono, r.email_contacto,
        r.horario_apertura, r.horario_cierre, r.tiempo_entrega_min,
        r.tiempo_entrega_max, r.costo_delivery, r.calificacion_promedio,
        r.total_calificaciones, r.activo, r.verificado
      ORDER BY r.nombre ASC
      LIMIT ${limit} OFFSET ${offset}`;

    const queryParams = [...filterValues];
    const countQueryParams = [...filterValues];


    const [restaurants] = await db.execute(sql, queryParams);
    const [totalCountResult] = await db.execute(countSql, countQueryParams);
    const totalRestaurants = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalRestaurants / limit);
    
    // Get categories for filter (remove duplicates)
    const [categorias] = await db.execute(`
      SELECT DISTINCT id, nombre, imagen FROM categorias_restaurantes WHERE activa = 1 ORDER BY nombre
    `);

    // Import CategoryIcons utility
    const CategoryIcons = require('../utils/categoryIcons');

    res.render('admin/restaurantes', {
      title: 'Administrar Restaurantes',
      user: req.session.user,
      restaurants,
      categorias,
      filtros: { search: search || '', estado: estado || '', categoria: categoria || '' },
      currentPage: parseInt(page),
      totalPages,
      limit,
      path: req.path,
      CategoryIcons: CategoryIcons
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
        usuario_id, nombre, descripcion, direccion, telefono, email_contacto,
        horario_apertura, horario_cierre, activo, verificado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        req.body.restaurante_nombre,
        req.body.restaurante_descripcion,
        req.body.restaurante_direccion,
        req.body.restaurante_telefono || null,
        req.body.email_contacto || null,
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
            // Error procesando dias_operacion, usar valor por defecto
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
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('restaurante_nombre').notEmpty().withMessage('El nombre del restaurante es requerido'),
  body('restaurante_descripcion').isLength({ min: 20 }).withMessage('La descripción debe tener al menos 20 caracteres'),
  body('restaurante_direccion').notEmpty().withMessage('La dirección es requerida')
], async (req, res) => {
  
  const connection = await db.getConnection();
  
  try {
    const restaurantId = req.params.id;
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.redirect(`/admin/restaurantes/${restaurantId}/editar?error=validation`);
    }

    const {
      nombre, apellido, email, telefono,
      restaurante_nombre, restaurante_descripcion, restaurante_direccion,
      restaurante_telefono, categoria_id, horario_apertura, horario_cierre,
      activo, verificado, dias_operacion
    } = req.body;

    // Procesar días de operación
    let diasOperacionJSON = null;
    if (dias_operacion && Array.isArray(dias_operacion) && dias_operacion.length > 0) {
        diasOperacionJSON = JSON.stringify(dias_operacion.map(dia => parseInt(dia)));
    }
    
    // Get current data for logging
    const [currentData] = await connection.execute(`
      SELECT r.*, u.nombre as usuario_nombre, u.apellido as usuario_apellido, u.email as usuario_email, u.telefono as usuario_telefono
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ?
    `, [restaurantId]);

    if (currentData.length === 0) {
      return res.status(404).redirect('/admin/restaurantes?error=not_found');
    }

    await connection.beginTransaction();

    // Update user
    await connection.execute(
      `UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, telefono = ?
       WHERE id = ?`,
      [nombre, apellido, email, telefono || null, currentData[0].usuario_id]
    );

    // Update restaurant
    await connection.execute(
      `UPDATE restaurantes SET
        nombre = ?, descripcion = ?, direccion = ?, telefono = ?, email_contacto = ?,
        horario_apertura = ?, horario_cierre = ?, dias_operacion = ?, activo = ?, verificado = ?
       WHERE id = ?`,
      [
        restaurante_nombre, restaurante_descripcion, restaurante_direccion,
        restaurante_telefono || null, req.body.email_contacto || null,
        horario_apertura || '09:00:00', horario_cierre || '22:00:00',
        diasOperacionJSON, activo ? 1 : 0, verificado ? 1 : 0,
        restaurantId
      ]
    );
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
    }

    await connection.commit();

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

    res.redirect(`/admin/restaurantes/${restaurantId}?success=updated`);

  } catch (error) {
    await connection.rollback();
    console.error('Error updating restaurant:', error);
    res.redirect(`/admin/restaurantes/${req.params.id}/editar?error=server`);
  } finally {
    connection.release();
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { restaurante, search, categoria, disponible } = req.query;
    
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
    
    const filterValues = [];
    
    if (restaurante) {
      sql += ` AND p.restaurante_id = ?`;
      countSql += ` AND p.restaurante_id = ?`;
      filterValues.push(restaurante);
    }
    
    if (search) {
      sql += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ?)`;
      countSql += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ?)`;
      filterValues.push(`%${search}%`, `%${search}%`);
    }
    
    if (categoria) {
      sql += ` AND cp.nombre = ?`;
      countSql += ` AND cp.nombre = ?`;
      filterValues.push(categoria);
    }
    
    if (disponible !== undefined && disponible !== '') {
      sql += ` AND p.disponible = ?`;
      countSql += ` AND p.disponible = ?`;
      filterValues.push(disponible === 'true' ? 1 : 0);
    }
    
    // Primero obtener el total de registros
    const [totalCountResult] = await db.execute(countSql, filterValues.length > 0 ? filterValues : []);
    const totalProductos = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalProductos / limit);
    
    // Luego obtener los productos con paginación
    sql += ` ORDER BY r.nombre, p.destacado DESC, p.nombre
      LIMIT ${limit} OFFSET ${offset}`;
    
    const [productos] = await db.execute(sql, filterValues);
    
    // Get restaurants and categories for filters
    const [restaurantes] = await db.execute(`
      SELECT id, nombre FROM restaurantes ORDER BY nombre
    `);
    
    // Obtener categorías globales para el filtro y el formulario
    const [categorias] = await db.execute(`
      SELECT id, nombre, orden_display FROM categorias_productos WHERE restaurante_id IS NULL AND activa = 1 ORDER BY orden_display, nombre
    `);

    res.render('admin/productos', {
      title: 'Gestión de Productos - Admin',
      user: req.session.user,
      productos,
      restaurantes,
      categorias,
      currentPage: page,
      limit: limit,
      totalPages: totalPages,
      totalProductos: totalProductos,
      filtros: { 
        restaurante: restaurante || '', 
        search: search || '', 
        categoria: categoria || '', 
        disponible: disponible || '' 
      },
      currentPage: page,
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
      
      let csv = 'ID,Restaurante,Período Inicio,Período Fin,Ventas Brutas,Comisión,Estado,Vencimiento,Comprobantes,Monto Pagado\n';
      
      cobros.forEach(c => {
        csv += `${c.id},"${c.restaurante_nombre}",${c.semana_inicio},${c.semana_fin},${c.ventas_brutas},${c.monto_comision},${c.estado},${c.fecha_vencimiento},${c.comprobantes_count},${c.monto_pagado_total || 0}\n`;
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

// Listado de cobros (GET)
router.get('/cobros', requireAdmin, async (req, res) => {
  try {
    const { restaurante = '', estado = '', semana = '' } = req.query;

    // Construcción de filtros
    let whereSql = 'WHERE 1=1';
    const params = [];

    if (restaurante) {
      whereSql += ' AND r.nombre LIKE ?';
      params.push(`%${restaurante}%`);
    }
    if (estado) {
      whereSql += ' AND cs.estado = ?';
      params.push(estado);
    }
    // Filtro por semana (input type week: YYYY-Www)
    let semanaInicio = null;
    let semanaFin = null;
    if (semana) {
      // Parsear semana ISO: YYYY-Www
      const match = semana.match(/^(\d{4})-W(\d{2})$/);
      if (match) {
        const year = parseInt(match[1], 10);
        const week = parseInt(match[2], 10);

        // Obtener lunes de la semana ISO
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        const dow = simple.getDay();
        const ISOweekStart = new Date(simple);
        const diff = (dow <= 4 ? 1 - dow : 8 - dow); // Lunes como inicio
        ISOweekStart.setDate(simple.getDate() + diff);
        const ISOweekEnd = new Date(ISOweekStart);
        ISOweekEnd.setDate(ISOweekStart.getDate() + 6);

        const toDateStr = (d) => d.toISOString().slice(0, 10);
        semanaInicio = toDateStr(ISOweekStart);
        semanaFin = toDateStr(ISOweekEnd);

        whereSql += ' AND cs.semana_inicio >= ? AND cs.semana_fin <= ?';
        params.push(semanaInicio, semanaFin);
      }
    }

    // Listado de cobros con monto_pagado calculado
    const [cobros] = await db.execute(
      `SELECT cs.*, r.nombre AS restaurante_nombre,
              COALESCE(SUM(CASE WHEN cp.estado = 'aprobado' THEN cp.monto_pagado ELSE 0 END), 0) AS monto_pagado
       FROM cobros_semanales cs
       JOIN restaurantes r ON cs.restaurante_id = r.id
       LEFT JOIN comprobantes_pago cp ON cp.cobro_semanal_id = cs.id
       ${whereSql}
       GROUP BY cs.id
       ORDER BY cs.semana_inicio DESC`,
      params
    );

    // Resumen con los mismos filtros
    const [resumenRows] = await db.execute(
      `SELECT 
          COALESCE(SUM(CASE WHEN cs.estado IN ('pendiente','vencido') THEN cs.monto_comision ELSE 0 END), 0) AS total_pendiente,
          COALESCE(SUM(CASE WHEN cs.estado = 'pagado' THEN cs.monto_comision ELSE 0 END), 0) AS total_pagado,
          COALESCE(SUM(cs.monto_comision), 0) AS total_comisiones
       FROM cobros_semanales cs
       JOIN restaurantes r ON cs.restaurante_id = r.id
       ${whereSql.replace('WHERE 1=1', 'WHERE 1=1')}`,
      params
    );

    const resumen = resumenRows[0] || { total_pendiente: 0, total_pagado: 0, total_comisiones: 0 };

    // Obtener lista de restaurantes para el selector de cobro específico
    const [restaurantes] = await db.execute(`
      SELECT id, nombre FROM restaurantes
      WHERE activo = 1 AND verificado = 1
      ORDER BY nombre
    `);

    res.render('admin/cobros', {
      title: 'Gestión de Cobros - Admin',
      user: req.session.user,
      resumen,
      filtros: { restaurante, estado, semana },
      cobros,
      restaurantes,
      path: req.path
    });
  } catch (error) {
    console.error('Error cargando cobros:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando cobros',
      error: {}
    });
  }
});

// Tabla semanal de pagos por restaurante (GET)
router.get('/pagos-semanales', requireAdmin, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), restaurante = '' } = req.query;
    const currentYear = parseInt(year);

    // Construcción de filtros
    let whereSql = 'WHERE YEAR(cs.semana_inicio) = ?';
    const params = [currentYear];

    if (restaurante) {
      whereSql += ' AND r.id = ?';
      params.push(restaurante);
    }

    // Obtener todas las semanas del año con datos de pagos
    const [semanasData] = await db.execute(`
      SELECT 
        cs.*,
        r.nombre as restaurante_nombre,
        r.id as restaurante_id,
        COALESCE(SUM(CASE WHEN cp.estado = 'aprobado' THEN cp.monto_pagado ELSE 0 END), 0) AS monto_pagado_aprobado,
        COUNT(cp.id) as comprobantes_count,
        CASE 
          WHEN cs.estado = 'pagado' THEN 'Pagado'
          WHEN cs.estado = 'pendiente' AND cs.fecha_vencimiento < CURDATE() THEN 'Vencido'
          WHEN cs.estado = 'pendiente' THEN 'Pendiente'
          WHEN cs.estado = 'exonerado' THEN 'Exonerado'
          ELSE cs.estado
        END as estado_display
      FROM cobros_semanales cs
      JOIN restaurantes r ON cs.restaurante_id = r.id
      LEFT JOIN comprobantes_pago cp ON cs.id = cp.cobro_semanal_id
      ${whereSql}
      GROUP BY cs.id
      ORDER BY cs.semana_inicio ASC, r.nombre ASC
    `, params);

    // Generar estructura de semanas del año
    const semanasAnio = [];
    const inicioAnio = new Date(currentYear, 0, 1);
    const finAnio = new Date(currentYear, 11, 31);
    
    // Encontrar el primer lunes del año
    let primerLunes = new Date(inicioAnio);
    while (primerLunes.getDay() !== 1) {
      primerLunes.setDate(primerLunes.getDate() + 1);
    }

    // Generar todas las semanas del año
    let semanaActual = new Date(primerLunes);
    let numeroSemana = 1;
    
    while (semanaActual <= finAnio) {
      const semanaFin = new Date(semanaActual);
      semanaFin.setDate(semanaActual.getDate() + 6);
      
      semanasAnio.push({
        numero: numeroSemana,
        inicio: new Date(semanaActual),
        fin: semanaFin,
        fecha_inicio: semanaActual.toISOString().split('T')[0],
        fecha_fin: semanaFin.toISOString().split('T')[0]
      });
      
      semanaActual.setDate(semanaActual.getDate() + 7);
      numeroSemana++;
    }

    // Obtener lista de restaurantes para filtros
    const [restaurantes] = await db.execute(`
      SELECT DISTINCT r.id, r.nombre 
      FROM restaurantes r 
      JOIN cobros_semanales cs ON r.id = cs.restaurante_id 
      WHERE YEAR(cs.semana_inicio) = ?
      ORDER BY r.nombre
    `, [currentYear]);

    // Calcular resumen anual
    const [resumenAnual] = await db.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN cs.estado = 'pagado' THEN cs.monto_comision ELSE 0 END), 0) AS total_pagado,
        COALESCE(SUM(CASE WHEN cs.estado IN ('pendiente', 'vencido') THEN cs.monto_comision ELSE 0 END), 0) AS total_pendiente,
        COALESCE(SUM(CASE WHEN cs.estado = 'exonerado' THEN cs.monto_comision ELSE 0 END), 0) AS total_exonerado,
        COALESCE(SUM(cs.monto_comision), 0) AS total_comisiones,
        COUNT(DISTINCT cs.restaurante_id) as total_restaurantes
      FROM cobros_semanales cs
      ${whereSql}
    `, params);

    const resumen = resumenAnual[0] || { 
      total_pagado: 0, 
      total_pendiente: 0, 
      total_exonerado: 0, 
      total_comisiones: 0, 
      total_restaurantes: 0 
    };

    // Preparar los datos para el gráfico
    const datosGrafico = semanasData.map(c => ({
      semana: Math.ceil((new Date(c.semana_inicio).getTime() - new Date(currentYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7)),
      comision: c.monto_comision,
      pagado: c.monto_pagado_aprobado || 0,
      pendiente: c.monto_comision - (c.monto_pagado_aprobado || 0)
    }));

    // Filtrar semanas que tienen datos o están en un rango razonable
    const semanasConDatos = semanasAnio.filter(semanaAnio => {
      // Verificar si esta semana tiene algún cobro
      const tieneCobro = semanasData.some(cs =>
        new Date(cs.semana_inicio).toISOString().slice(0, 10) === semanaAnio.fecha_inicio
      );

      // Incluir semanas que tienen cobros O que están dentro de las últimas 12 semanas y próximas 4 semanas
      const fechaSemana = new Date(semanaAnio.fecha_inicio);
      const hoy = new Date();
      const semanasAtras = Math.floor((hoy - fechaSemana) / (1000 * 60 * 60 * 24 * 7));
      const semanasAdelante = Math.floor((fechaSemana - hoy) / (1000 * 60 * 60 * 24 * 7));

      return tieneCobro || (semanasAtras >= -4 && semanasAtras <= 12);
    });

    // Mapear semanasData a una estructura por restaurante y semana
    const pagosPorRestaurantePorSemana = restaurantes.map(rest => {
      const semanasDelRestaurante = semanasConDatos.map(semanaAnio => {
        const cobroSemana = semanasData.find(cs =>
          cs.restaurante_id === rest.id &&
          new Date(cs.semana_inicio).toISOString().slice(0, 10) === semanaAnio.fecha_inicio
        );

        let estadoPago = 'no_data'; // Por defecto si no hay datos
        if (cobroSemana) {
          if (cobroSemana.estado === 'pagado') {
            estadoPago = 'pagado';
          } else if (cobroSemana.estado === 'exonerado') {
            estadoPago = 'exonerado';
          } else if (cobroSemana.estado === 'pendiente' && new Date(cobroSemana.fecha_vencimiento) < new Date()) {
            estadoPago = 'vencido';
          } else if (cobroSemana.estado === 'pendiente') {
            estadoPago = 'pendiente';
          }
        }

        return {
          numero: semanaAnio.numero,
          fecha_inicio: semanaAnio.fecha_inicio,
          fecha_fin: semanaAnio.fecha_fin,
          estado_pago: estadoPago,
          monto_comision: cobroSemana ? cobroSemana.monto_comision : 0,
          monto_pagado_aprobado: cobroSemana ? cobroSemana.monto_pagado_aprobado : 0,
          cobro_id: cobroSemana ? cobroSemana.id : null
        };
      });

      return {
        id: rest.id,
        nombre: rest.nombre,
        semanas: semanasDelRestaurante
      };
    });

    // Preparar los datos para la plantilla
    const templateData = {
      title: 'Tabla Semanal de Pagos - Admin',
      user: req.session.user,
      year: currentYear,
      semanasAnio: semanasConDatos, // Usar semanas filtradas
      restaurantes, // Se mantiene para el filtro
      pagosPorRestaurantePorSemana, // Nuevo dato para la tabla principal
      resumen,
      filtros: { year: currentYear, restaurante },
      activePage: 'pagos-semanales',
      path: req.path,
      // Pasar los datos del gráfico como JSON
      datosGrafico: JSON.stringify(datosGrafico)
    };
    
    
    res.render('admin/pagos-semanales', templateData);

  } catch (error) {
    console.error('Error cargando tabla semanal de pagos:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando tabla semanal de pagos',
      error: {}
    });
  }
});

// Exportar tabla semanal de pagos
router.get('/pagos-semanales/export', requireAdmin, async (req, res) => {
  try {
    const { year = new Date().getFullYear(), restaurante = '', format = 'csv' } = req.query;
    const currentYear = parseInt(year);

    // Construcción de filtros
    let whereSql = 'WHERE YEAR(cs.semana_inicio) = ?';
    const params = [currentYear];

    if (restaurante) {
      whereSql += ' AND r.id = ?';
      params.push(restaurante);
    }

    // Obtener datos para exportar
    const [semanasData] = await db.execute(`
      SELECT 
        cs.*,
        r.nombre as restaurante_nombre,
        COALESCE(SUM(CASE WHEN cp.estado = 'aprobado' THEN cp.monto_pagado ELSE 0 END), 0) AS monto_pagado_aprobado,
        COUNT(cp.id) as comprobantes_count
      FROM cobros_semanales cs
      JOIN restaurantes r ON cs.restaurante_id = r.id
      LEFT JOIN comprobantes_pago cp ON cs.id = cp.cobro_semanal_id
      ${whereSql}
      GROUP BY cs.id
      ORDER BY cs.semana_inicio ASC, r.nombre ASC
    `, params);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=pagos-semanales-${currentYear}.csv`);
      
      let csv = 'Semana,Restaurante,Período Inicio,Período Fin,Ventas Brutas,Comisión (10%),Estado,Monto Pagado,Comprobantes,Vencimiento\n';
      
      semanasData.forEach(cobro => {
        const semana = Math.ceil((new Date(cobro.semana_inicio).getTime() - new Date(currentYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7));
        const estado = cobro.estado === 'pendiente' && new Date(cobro.fecha_vencimiento) < new Date() ? 'vencido' : cobro.estado;
        
        csv += `"Semana ${semana}","${cobro.restaurante_nombre}","${cobro.semana_inicio}","${cobro.semana_fin}",${cobro.ventas_brutas},${cobro.monto_comision},"${estado}",${cobro.monto_pagado_aprobado},${cobro.comprobantes_count},"${cobro.fecha_vencimiento}"\n`;
      });
      
      res.send(csv);
    } else {
      res.json({
        year: currentYear,
        total_records: semanasData.length,
        data: semanasData
      });
    }

  } catch (error) {
    console.error('Error exportando tabla semanal de pagos:', error);
    res.status(500).json({ success: false, message: 'Error exportando datos' });
  }
});

// Contar restaurantes activos y verificados
router.get('/restaurantes/count-active', requireAdmin, async (req, res) => {
  try {
    const [result] = await db.execute(`
      SELECT COUNT(*) as count
      FROM restaurantes 
      WHERE activo = 1 AND verificado = 1
    `);
    
    res.json({ 
      success: true, 
      count: result[0].count 
    });
  } catch (error) {
    console.error('Error contando restaurantes activos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error contando restaurantes activos'
    });
  }
});



// Generar cobros (GET)
router.get('/cobros/generar', requireAdmin, async (req, res) => {
  try {
    // Restaurantes activos y verificados para listar en el formulario
    const [restaurantes] = await db.execute(`
      SELECT id, nombre FROM restaurantes WHERE activo = 1 AND verificado = 1 ORDER BY nombre
    `);

    // Último cobro por restaurante para mostrar referencia
    const [ultimos] = await db.execute(`
      SELECT restaurante_id, MAX(semana_fin) AS ultimo
      FROM cobros_semanales
      GROUP BY restaurante_id
    `);

    const ultimosCobros = {};
    ultimos.forEach(u => { if (u.restaurante_id) ultimosCobros[u.restaurante_id] = u.ultimo; });

    res.render('admin/cobros-generar', {
      title: 'Generar Cobros - Admin',
      user: req.session.user,
      restaurantes,
      ultimosCobros,
      path: req.path
    });
  } catch (error) {
    console.error('Error cargando datos para generar cobros:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando datos para generar cobros',
      error: {}
    });
  }
});

// Ver detalle de un cobro
router.get('/cobros/:id', requireAdmin, async (req, res) => {
  try {
    const cobroId = req.params.id;

    const [cobros] = await db.execute(
      'SELECT cs.*, r.nombre as restaurante_nombre FROM cobros_semanales cs JOIN restaurantes r ON cs.restaurante_id = r.id WHERE cs.id = ?',
      [cobroId]
    );

    if (cobros.length === 0) {
      return res.status(404).render('error', {
        title: 'Cobro No Encontrado',
        message: 'El cobro que buscas no existe',
        error: {}
      });
    }

    const [comprobantes] = await db.execute(
      'SELECT * FROM comprobantes_pago WHERE cobro_semanal_id = ? ORDER BY fecha_subida DESC',
      [cobroId]
    );

    res.render('admin/cobro-detalle', {
      title: `Detalle de Cobro #${cobroId}`,
      user: req.session.user,
      cobro: cobros[0],
      comprobantes,
      path: req.path
    });
  } catch (error) {
    console.error('Error loading charge detail:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando detalle del cobro',
      error: {}
    });
  }
});

// Eliminar cobro
router.delete('/cobros/:id', requireAdmin, async (req, res) => {
  try {
    const cobroId = req.params.id;

    // Verificar que el cobro existe
    const [cobros] = await db.execute('SELECT * FROM cobros_semanales WHERE id = ?', [cobroId]);
    if (cobros.length === 0) {
      return res.status(404).json({ success: false, message: 'Cobro no encontrado' });
    }

    const cobro = cobros[0];

    // Eliminar comprobantes asociados primero
    await db.execute('DELETE FROM comprobantes_pago WHERE cobro_semanal_id = ?', [cobroId]);

    // Eliminar el cobro
    await db.execute('DELETE FROM cobros_semanales WHERE id = ?', [cobroId]);

    // Log de actividad administrativa
    await logAdminActivity(
      req.session.user.id,
      'eliminar_cobro',
      `Cobro eliminado: ID ${cobroId}`,
      'cobro',
      cobroId,
      cobro,
      null,
      req
    );

    res.json({ success: true, message: 'Cobro eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando cobro:', error);
    res.status(500).json({ success: false, message: 'Error eliminando cobro' });
  }
});

// Aprobar comprobante
router.post('/comprobantes/:id/aprobar', requireAdmin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const comprobanteId = req.params.id;

    await connection.beginTransaction();

    // Actualizar el estado del comprobante
    await connection.execute(
      'UPDATE comprobantes_pago SET estado = ?, fecha_revision = NOW(), admin_revisor_id = ? WHERE id = ?',
      ['aprobado', req.session.user.id, comprobanteId]
    );

    // Obtener el cobro_semanal_id del comprobante
    const [comprobante] = await connection.execute('SELECT cobro_semanal_id FROM comprobantes_pago WHERE id = ?', [comprobanteId]);
    const cobroId = comprobante[0].cobro_semanal_id;

    // Actualizar el estado del cobro a pagado
    await connection.execute('UPDATE cobros_semanales SET estado = ?, fecha_pago = NOW() WHERE id = ?', ['pagado', cobroId]);

    await connection.commit();

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'aprobar_pago',
      `Comprobante aprobado: ${comprobanteId}`,
      'comprobante',
      comprobanteId,
      null,
      { estado: 'aprobado' },
      req
    );

    res.redirect('back');
  } catch (error) {
    await connection.rollback();
    console.error('Error approving receipt:', error);
    res.redirect('back');
  } finally {
    connection.release();
  }
});

// Rechazar comprobante
router.post('/comprobantes/:id/rechazar', requireAdmin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const comprobanteId = req.params.id;

    await connection.beginTransaction();

    // Actualizar el estado del comprobante
    await connection.execute(
      'UPDATE comprobantes_pago SET estado = ?, fecha_revision = NOW(), admin_revisor_id = ? WHERE id = ?',
      ['rechazado', req.session.user.id, comprobanteId]
    );

    await connection.commit();

    // Log admin activity
    await logAdminActivity(
      req.session.user.id,
      'rechazar_pago',
      `Comprobante rechazado: ${comprobanteId}`,
      'comprobante',
      comprobanteId,
      null,
      { estado: 'rechazado' },
      req
    );

    res.redirect('back');
  } catch (error) {
    await connection.rollback();
    console.error('Error rejecting receipt:', error);
    res.redirect('back');
  } finally {
    connection.release();
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
      
      let csv = 'ID,Restaurante,Producto,Categoría,Precio,Destacado,Disponible,Fecha Creación\n';
      
      productos.forEach(p => {
        csv += `${p.id},"${p.restaurante_nombre}","${p.nombre}","${p.categoria_nombre || 'Sin categoría'}",${p.precio},${p.destacado ? 'Sí' : 'No'},${p.disponible ? 'Sí' : 'No'},${p.fecha_creacion}\n`;
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
      
      let csv = 'ID,Restaurante,Período,Método Pago,Monto,Estado,Fecha Subida,Fecha Revisión\n';
      
      comprobantes.forEach(c => {
        csv += `${c.id},"${c.restaurante_nombre}","${c.semana_inicio} - ${c.semana_fin}","${c.metodo_pago}",${c.monto_pagado},${c.estado},${c.fecha_subida},${c.fecha_revision || 'N/A'}\n`;
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
      
      let csv = 'ID,Nombre Restaurante,Propietario,Email,Telefono,Direccion,Activo,Verificado,Total Productos,Total Pedidos,Ventas Totales,Fecha Registro\n';
      
      restaurantes.forEach(r => {
        csv += `${r.id},"${r.nombre}","${r.propietario_nombre} ${r.propietario_apellido}",${r.email},${r.telefono || ''},"${r.direccion}",${r.activo ? 'Sí' : 'No'},${r.verificado ? 'Sí' : 'No'},${r.total_productos},${r.total_pedidos},${r.ventas_totales},${r.fecha_registro}\n`;
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

// Ver detalle de un pedido específico
router.get('/pedidos/:id', requireAdmin, async (req, res) => {
  try {
    const pedidoId = req.params.id;

    const [pedidos] = await db.execute(`
      SELECT p.*, r.nombre as restaurante_nombre, r.imagen_logo as restaurante_logo,
             u.nombre as cliente_nombre, u.apellido as cliente_apellido, u.email as cliente_email, u.telefono as cliente_telefono
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.id = ?
    `, [pedidoId]);

    if (pedidos.length === 0) {
      return res.status(404).render('error', {
        title: 'Pedido No Encontrado',
        message: 'El pedido que buscas no existe',
        error: {}
      });
    }

    const pedido = pedidos[0];

    // Obtener items del pedido
    const [itemsPedido] = await db.execute(`
      SELECT ip.*, p.nombre as producto_nombre, p.imagen as producto_imagen,
             GROUP_CONCAT(vo.nombre SEPARATOR ', ') as opciones_seleccionadas
      FROM items_pedido ip
      JOIN productos p ON ip.producto_id = p.id
      LEFT JOIN item_opciones_seleccionadas ios ON ip.id = ios.item_pedido_id
      LEFT JOIN valores_opciones vo ON ios.valor_opcion_id = vo.id
      WHERE ip.pedido_id = ?
      GROUP BY ip.id
    `, [pedidoId]);

    res.render('admin/pedido-detalle', {
      title: `Pedido #${pedido.numero_pedido} - Admin`,
      user: req.session.user,
      pedido,
      itemsPedido,
      path: req.path
    });
  } catch (error) {
    console.error('Error getting order detail:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando detalle del pedido',
      error: {}
    });
  }
});

// Listar todos los pedidos
router.get('/pedidos', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { restaurante, estado, search } = req.query;

    let sql = `
      SELECT p.*, r.nombre as restaurante_nombre, u.nombre as cliente_nombre, u.apellido as cliente_apellido
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE 1=1
    `;
    let countSql = `
      SELECT COUNT(p.id) as total_count
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE 1=1
    `;

    const filterValues = [];

    if (restaurante) {
      sql += ` AND r.nombre LIKE ?`;
      countSql += ` AND r.nombre LIKE ?`;
      filterValues.push(`%${restaurante}%`);
    }

    if (estado) {
      sql += ` AND p.estado = ?`;
      countSql += ` AND p.estado = ?`;
      filterValues.push(estado);
    }

    if (search) {
      sql += ` AND (p.id LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ?)`;
      countSql += ` AND (p.id LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ?)`;
      filterValues.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY p.fecha_pedido DESC LIMIT ${limit} OFFSET ${offset}`;

    const [pedidos] = await db.execute(sql, filterValues);
    const [totalCountResult] = await db.execute(countSql, filterValues);
    const totalPedidos = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalPedidos / limit);

    res.render('admin/pedidos', {
      title: 'Gestión de Pedidos - Admin',
      user: req.session.user,
      pedidos,
      filtros: { restaurante: restaurante || '', estado: estado || '', search: search || '' },
      currentPage: page,
      totalPages,
      path: req.path
    });
  } catch (error) {
    console.error('Error loading orders:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando pedidos',
      error: {}
    });
  }
});

router.get('/dashboard', requireAdmin, (req, res) => {
  res.redirect('/admin');
});

// Ver chat de un pedido
router.get('/pedidos/:id/chat', requireAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;

    // Obtener detalles del pedido
    const [orders] = await db.execute(`
      SELECT p.id, p.numero_pedido, p.estado, p.metodo_pago, p.total,
             r.nombre as restaurante_nombre, r.imagen_logo as restaurante_logo,
             u.nombre as cliente_nombre, u.apellido as cliente_apellido
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.id = ?
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).render('error', {
        title: 'Pedido No Encontrado',
        message: 'El pedido que buscas no existe.',
        error: {}
      });
    }
    const order = orders[0];

    // Obtener mensajes del chat
    const [messages] = await db.execute(`
      SELECT mp.*, 
             CASE 
                WHEN mp.remitente_tipo = 'cliente' THEN u.nombre
                WHEN mp.remitente_tipo = 'restaurante' THEN r.nombre
                ELSE 'Desconocido'
             END as remitente_nombre
      FROM mensajes_pedido mp
      LEFT JOIN usuarios u ON mp.remitente_id = u.id AND mp.remitente_tipo = 'cliente'
      LEFT JOIN restaurantes r ON mp.remitente_id = r.usuario_id AND mp.remitente_tipo = 'restaurante'
      WHERE mp.pedido_id = ?
      ORDER BY mp.fecha_envio ASC
    `, [orderId]);

    res.render('admin/order-chat', {
      title: `Chat Pedido #${order.numero_pedido} - Admin`,
      user: req.session.user,
      order,
      messages,
      path: req.path,
      scripts: ['/js/dashboard-orders-chat.js'] // Reutilizar el script de chat
    });

  } catch (error) {
    console.error('Error loading order chat:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el chat del pedido',
      error: {}
    });
  }
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { estado, restaurante, fecha_desde, fecha_hasta } = req.query;
    let sql = `
      SELECT cp.*, r.nombre as restaurante_nombre, r.id as restaurante_id, cs.semana_inicio, cs.semana_fin, cs.ventas_brutas, cs.monto_comision
      FROM comprobantes_pago cp
      JOIN cobros_semanales cs ON cp.cobro_semanal_id = cs.id
      JOIN restaurantes r ON cs.restaurante_id = r.id
      WHERE 1=1
    `;
    let countSql = `
      SELECT COUNT(*) as total_count
      FROM comprobantes_pago cp
      JOIN cobros_semanales cs ON cp.cobro_semanal_id = cs.id
      JOIN restaurantes r ON cs.restaurante_id = r.id
      WHERE 1=1
    `;
    const filterValues = [];
    if (estado) {
      sql += ' AND cp.estado = ?';
      countSql += ' AND cp.estado = ?';
      filterValues.push(estado);
    }
    if (restaurante) {
      sql += ' AND r.id = ?';
      countSql += ' AND r.id = ?';
      filterValues.push(restaurante);
    }
    if (fecha_desde) {
      sql += ' AND cp.fecha_subida >= ?';
      countSql += ' AND cp.fecha_subida >= ?';
      filterValues.push(fecha_desde + ' 00:00:00');
    }
    if (fecha_hasta) {
      sql += ' AND cp.fecha_subida <= ?';
      countSql += ' AND cp.fecha_subida <= ?';
      filterValues.push(fecha_hasta + ' 23:59:59');
    }
    sql += ` ORDER BY cp.fecha_subida DESC LIMIT ${limit} OFFSET ${offset}`;
    const queryParams = [...filterValues];
    const countQueryParams = [...filterValues];
    const [comprobantes] = await db.execute(sql, queryParams);
    const [totalCountResult] = await db.execute(countSql, countQueryParams);
    const totalComprobantes = totalCountResult[0].total_count;
    const totalPages = Math.ceil(totalComprobantes / limit);
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
      currentPage: page,
      totalPages,
      path: req.path,
      activePage: 'comprobantes'
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

// Generar cobros semanales
router.post('/cobros/generar', requireAdmin, async (req, res) => {
  const { fecha_inicio, fecha_fin, restaurante_ids } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Validación básica
    if (!fecha_inicio || !fecha_fin) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Fechas inválidas' });
    }

    // Obtener restaurantes destino: seleccionados o todos activos/verificados
    let restaurantesQuery = `
      SELECT r.id, r.nombre, u.email
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.activo = 1 AND r.verificado = 1`;
    const params = [];
    if (Array.isArray(restaurante_ids) && restaurante_ids.length > 0) {
      const placeholders = restaurante_ids.map(() => '?').join(',');
      restaurantesQuery += ` AND r.id IN (${placeholders})`;
      params.push(...restaurante_ids);
    }

    const [restaurantes] = await connection.execute(restaurantesQuery, params);

    for (const restaurante of restaurantes) {
      // Calcular ventas brutas en el período - incluir todos los estados relevantes
      const [ventas] = await connection.execute(
        `SELECT 
           COALESCE(SUM(CASE WHEN estado IN ('entregado', 'en_camino', 'listo') THEN total ELSE 0 END), 0) as ventas_confirmadas,
           COALESCE(SUM(CASE WHEN estado IN ('pendiente', 'confirmado', 'preparando') THEN total ELSE 0 END), 0) as ventas_pendientes,
           COALESCE(SUM(CASE WHEN estado IN ('entregado', 'en_camino', 'listo', 'pendiente', 'confirmado', 'preparando') THEN total ELSE 0 END), 0) as ventas_brutas,
           COUNT(CASE WHEN estado IN ('entregado', 'en_camino', 'listo', 'pendiente', 'confirmado', 'preparando') THEN 1 END) as total_pedidos
         FROM pedidos
         WHERE restaurante_id = ? AND fecha_pedido BETWEEN ? AND ?`,
        [restaurante.id, fecha_inicio, fecha_fin]
      );
      
      const ventas_brutas = Number(ventas[0].ventas_brutas || 0);
      const ventas_confirmadas = Number(ventas[0].ventas_confirmadas || 0);
      const ventas_pendientes = Number(ventas[0].ventas_pendientes || 0);
      const total_pedidos = Number(ventas[0].total_pedidos || 0);

      if (ventas_brutas > 0) {
        const monto_comision = ventas_brutas * 0.10; // 10% comisión
        const fecha_vencimiento = new Date();
        fecha_vencimiento.setDate(fecha_vencimiento.getDate() + 7);

        // Insertar cobro semanal con información detallada
        await connection.execute(
          `INSERT INTO cobros_semanales (
            restaurante_id, semana_inicio, semana_fin, ventas_brutas, 
            monto_comision, fecha_vencimiento, notas
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            restaurante.id, 
            fecha_inicio, 
            fecha_fin, 
            ventas_brutas, 
            monto_comision, 
            fecha_vencimiento,
            `Pedidos: ${total_pedidos} | Confirmados: $${ventas_confirmadas.toLocaleString()} | Pendientes: $${ventas_pendientes.toLocaleString()}`
          ]
        );

        // Enviar email con información detallada
        await sendEmail(
          restaurante.email,
          `Nuevo cobro semanal generado para ${restaurante.nombre}`,
          'restaurant-charge',
          {
            nombreRestaurante: restaurante.nombre,
            semana_inicio: fecha_inicio,
            semana_fin: fecha_fin,
            ventas_brutas,
            ventas_confirmadas,
            ventas_pendientes,
            total_pedidos,
            monto_comision,
            fecha_vencimiento: fecha_vencimiento.toISOString().split('T')[0]
          }
        );
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Cobros generados exitosamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Error generando cobros:', error);
    res.status(500).json({ success: false, message: 'Error generando cobros' });
  } finally {
    connection.release();
  }
});

// Generar cobros para un restaurante específico
router.post('/cobros/generar-especifico', requireAdmin, async (req, res) => {
  const { restaurante_id, fecha_inicio, fecha_fin } = req.body;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Validar parámetros
    if (!restaurante_id || !fecha_inicio || !fecha_fin) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Parámetros incompletos' });
    }

    // Verificar que el restaurante existe y está activo/verificado
    const [restaurantes] = await connection.execute(
      'SELECT r.id, r.nombre, u.email FROM restaurantes r JOIN usuarios u ON r.usuario_id = u.id WHERE r.id = ? AND r.activo = 1 AND r.verificado = 1',
      [restaurante_id]
    );

    if (restaurantes.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Restaurante no encontrado o no está activo/verificado' });
    }

    const restaurante = restaurantes[0];

    // Verificar que no exista ya un cobro para este restaurante en este período
    const [cobrosExistentes] = await connection.execute(
      'SELECT id FROM cobros_semanales WHERE restaurante_id = ? AND semana_inicio = ? AND semana_fin = ?',
      [restaurante_id, fecha_inicio, fecha_fin]
    );

    if (cobrosExistentes.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Ya existe un cobro para este restaurante en el período ${fecha_inicio} - ${fecha_fin}`
      });
    }

    // Calcular ventas brutas en el período - MISMA LÓGICA QUE LA GENERACIÓN AUTOMÁTICA
    const [ventas] = await connection.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN estado IN ('entregado', 'en_camino', 'listo') THEN total ELSE 0 END), 0) as ventas_confirmadas,
         COALESCE(SUM(CASE WHEN estado IN ('pendiente', 'confirmado', 'preparando') THEN total ELSE 0 END), 0) as ventas_pendientes,
         COALESCE(SUM(CASE WHEN estado IN ('entregado', 'en_camino', 'listo', 'pendiente', 'confirmado', 'preparando') THEN total ELSE 0 END), 0) as ventas_brutas,
         COUNT(CASE WHEN estado IN ('entregado', 'en_camino', 'listo', 'pendiente', 'confirmado', 'preparando') THEN 1 END) as total_pedidos
       FROM pedidos
       WHERE restaurante_id = ? AND fecha_pedido BETWEEN ? AND ?`,
      [restaurante_id, fecha_inicio, fecha_fin]
    );

    const ventas_brutas = Number(ventas[0].ventas_brutas || 0);
    const ventas_confirmadas = Number(ventas[0].ventas_confirmadas || 0);
    const ventas_pendientes = Number(ventas[0].ventas_pendientes || 0);
    const total_pedidos = Number(ventas[0].total_pedidos || 0);

    // Solo generar cobro si hay ventas
    if (ventas_brutas <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'No hay pedidos en el período seleccionado para este restaurante'
      });
    }

    const monto_comision = ventas_brutas * 0.10; // 10% comisión
    const fecha_vencimiento = new Date();
    fecha_vencimiento.setDate(fecha_vencimiento.getDate() + 7);

    // Insertar cobro semanal con información detallada - MISMO FORMATO QUE LA GENERACIÓN AUTOMÁTICA
    await connection.execute(
      `INSERT INTO cobros_semanales (
        restaurante_id, semana_inicio, semana_fin, ventas_brutas,
        monto_comision, fecha_vencimiento, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        restaurante_id,
        fecha_inicio,
        fecha_fin,
        ventas_brutas,
        monto_comision,
        fecha_vencimiento,
        `Pedidos: ${total_pedidos} | Confirmados: $${ventas_confirmadas.toLocaleString()} | Pendientes: $${ventas_pendientes.toLocaleString()}`
      ]
    );

    await connection.commit();

    // Log de actividad administrativa
    await logAdminActivity(
      req.session.user.id,
      'generar_cobro_especifico',
      `Cobro específico generado para restaurante ${restaurante.nombre}`,
      'cobro',
      null,
      null,
      {
        restaurante_id,
        restaurante_nombre: restaurante.nombre,
        fecha_inicio,
        fecha_fin,
        ventas_brutas,
        monto_comision
      }
    );

    // Enviar email al restaurante - MISMO FORMATO QUE LA GENERACIÓN AUTOMÁTICA
    try {
      await sendEmail(
        restaurante.email,
        `Nuevo cobro semanal generado para ${restaurante.nombre}`,
        'restaurant-charge',
        {
          nombreRestaurante: restaurante.nombre,
          semana_inicio: fecha_inicio,
          semana_fin: fecha_fin,
          ventas_brutas,
          ventas_confirmadas,
          ventas_pendientes,
          total_pedidos,
          monto_comision,
          fecha_vencimiento: fecha_vencimiento.toISOString().split('T')[0]
        }
      );
    } catch (emailError) {
      console.error('Error enviando email de cobro específico:', emailError);
      // No fallar la operación por error de email
    }

    res.json({
      success: true,
      message: 'Cobro generado exitosamente',
      data: {
        restaurante_nombre: restaurante.nombre,
        fecha_inicio,
        fecha_fin,
        ventas_brutas,
        ventas_confirmadas,
        ventas_pendientes,
        total_pedidos,
        monto_comision,
        fecha_vencimiento: fecha_vencimiento.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error generando cobro específico:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    connection.release();
  }
});

// Generar cobros automáticamente para el período seleccionado
router.post('/cobros/generar-automatico', requireAdmin, async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.body;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Validar parámetros
    if (!fecha_inicio || !fecha_fin) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Fechas de inicio y fin son requeridas' });
    }

    // Validar que fecha_inicio sea anterior a fecha_fin
    if (new Date(fecha_inicio) >= new Date(fecha_fin)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'La fecha de inicio debe ser anterior a la fecha de fin' });
    }

    // Verificar si ya existen cobros para esta semana
    const [cobrosExistentes] = await connection.execute(
      `SELECT COUNT(*) as total FROM cobros_semanales 
       WHERE semana_inicio = ? AND semana_fin = ?`,
      [fecha_inicio, fecha_fin]
    );

    if (cobrosExistentes[0].total > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Ya existen cobros para la semana del ${fecha_inicio} al ${fecha_fin}` 
      });
    }

    // Obtener todos los restaurantes activos y verificados
    const [restaurantes] = await connection.execute(`
      SELECT r.id, r.nombre, u.email
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.activo = 1 AND r.verificado = 1
      ORDER BY r.nombre
    `);

    let cobrosGenerados = 0;
    let totalComisiones = 0;

    for (const restaurante of restaurantes) {
      // Calcular ventas brutas en el período - incluir todos los estados relevantes
      const [ventas] = await connection.execute(
        `SELECT 
           COALESCE(SUM(CASE WHEN estado IN ('entregado', 'en_camino', 'listo') THEN total ELSE 0 END), 0) as ventas_confirmadas,
           COALESCE(SUM(CASE WHEN estado IN ('pendiente', 'confirmado', 'preparando') THEN total ELSE 0 END), 0) as ventas_pendientes,
           COALESCE(SUM(CASE WHEN estado IN ('entregado', 'en_camino', 'listo', 'pendiente', 'confirmado', 'preparando') THEN total ELSE 0 END), 0) as ventas_brutas,
           COUNT(CASE WHEN estado IN ('entregado', 'en_camino', 'listo', 'pendiente', 'confirmado', 'preparando') THEN 1 END) as total_pedidos
         FROM pedidos
         WHERE restaurante_id = ? AND fecha_pedido BETWEEN ? AND ?`,
        [restaurante.id, fecha_inicio, fecha_fin]
      );
      
      const ventas_brutas = Number(ventas[0].ventas_brutas || 0);
      const ventas_confirmadas = Number(ventas[0].ventas_confirmadas || 0);
      const ventas_pendientes = Number(ventas[0].ventas_pendientes || 0);
      const total_pedidos = Number(ventas[0].total_pedidos || 0);

      if (ventas_brutas > 0) {
        const monto_comision = ventas_brutas * 0.10; // 10% comisión
        const fecha_vencimiento = new Date();
        fecha_vencimiento.setDate(fecha_vencimiento.getDate() + 7);

        // Insertar cobro semanal con información detallada
        await connection.execute(
          `INSERT INTO cobros_semanales (
            restaurante_id, semana_inicio, semana_fin, ventas_brutas, 
            monto_comision, fecha_vencimiento, notas
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            restaurante.id, 
            fecha_inicio, 
            fecha_fin, 
            ventas_brutas, 
            monto_comision, 
            fecha_vencimiento,
            `Pedidos: ${total_pedidos} | Confirmados: $${ventas_confirmadas.toLocaleString()} | Pendientes: $${ventas_pendientes.toLocaleString()}`
          ]
        );

        cobrosGenerados++;
        totalComisiones += monto_comision;

        // Enviar email con información detallada
        await sendEmail(
          restaurante.email,
          `Nuevo cobro semanal generado para ${restaurante.nombre}`,
          'restaurant-charge',
          {
            nombreRestaurante: restaurante.nombre,
            semana_inicio: fecha_inicio,
            semana_fin: fecha_fin,
            ventas_brutas,
            ventas_confirmadas,
            ventas_pendientes,
            total_pedidos,
            monto_comision,
            fecha_vencimiento: fecha_vencimiento.toISOString().split('T')[0]
          }
        );
      }
    }

    await connection.commit();
    
    // Log de actividad administrativa
    await logAdminActivity(
      req.session.user.id,
      'generar_cobro',
      `Generación automática de cobros semanales para ${cobrosGenerados} restaurantes. Total comisiones: $${totalComisiones.toLocaleString()}`,
      'cobro',
      null,
      null,
      { fecha_inicio, fecha_fin, cobrosGenerados, totalComisiones }
    );

    res.json({ 
      success: true, 
      message: `Cobros generados exitosamente para ${cobrosGenerados} restaurantes`,
      data: {
        fecha_inicio,
        fecha_fin,
        cobrosGenerados,
        totalComisiones,
        restaurantes: restaurantes.length
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error generando cobros automáticos:', error);
    res.status(500).json({ success: false, message: 'Error generando cobros automáticos' });
  } finally {
    connection.release();
  }
});
