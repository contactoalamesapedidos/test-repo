const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../config/database');
const ejs = require('ejs');

// Middleware to check if user is restaurant owner
function requireRestaurant(req, res, next) {
  if (!req.session.user || req.session.user.tipo_usuario !== 'restaurante') {
    return res.redirect('/auth/login');
  }
  next();
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    // Normalizar el nombre: quitar extensión, reemplazar espacios y caracteres no válidos por _
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\.[^/.]+$/, "");
    // Reemplazar todo lo que no sea letra, número o guion por _
    const safeName = originalName.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase();
    const extension = path.extname(file.originalname).toLowerCase();
    const newFilename = `${file.fieldname}_${safeName}_${timestamp}${extension}`;
    console.log('Generando nombre de archivo seguro:', {
      originalName: file.originalname,
      safeName,
      newFilename,
      fieldname: file.fieldname
    });
    cb(null, newFilename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    console.log('Multer procesando archivo:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

// Dashboard main page
router.get('/', requireRestaurant, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get restaurant info
    const [restaurants] = await db.execute(`
      SELECT r.*, u.nombre, u.apellido, u.email
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.usuario_id = ?
    `, [userId]);
    
    if (restaurants.length === 0) {
      return res.render('dashboard/pending', {
        title: 'Panel de Restaurante - A la Mesa',
        message: 'Tu restaurante está pendiente de aprobación'
      });
    }
    
    const restaurant = restaurants[0];
    
    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    
    const [todayStats] = await db.execute(`
      SELECT 
        COUNT(*) as pedidos_hoy,
        COALESCE(SUM(total), 0) as ventas_hoy,
        COALESCE(AVG(total), 0) as promedio_pedido
      FROM pedidos 
      WHERE restaurante_id = ? 
      AND DATE(fecha_pedido) = ?
      AND estado != 'cancelado'
    `, [restaurant.id, today]);
    
    // Get product count
    const [productStats] = await db.execute(`
      SELECT COUNT(*) as total_productos
      FROM productos 
      WHERE restaurante_id = ? AND disponible = 1
    `, [restaurant.id]);
    
    // Get recent orders
    const [recentOrders] = await db.execute(`
      SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.restaurante_id = ?
      ORDER BY p.fecha_pedido DESC
      LIMIT 5
    `, [restaurant.id]);
    
    res.render('dashboard/index', {
      title: 'Panel de Restaurante - A la Mesa',
      restaurant,
      stats: {
        ...todayStats[0],
        ...productStats[0]
      },
      recentOrders,
      scripts: ['/js/dashboard.js']
    });
    
  } catch (error) {
    console.error('Error cargando dashboard:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el panel de control',
      error: {}
    });
  }
});

// Products management
router.get('/products', requireRestaurant, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get restaurant
    const [restaurants] = await db.execute(`
      SELECT id FROM restaurantes WHERE usuario_id = ?
    `, [userId]);
    
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    
    const restaurantId = restaurants[0].id;
    
    // Get categories
    let [categories] = await db.execute(`
      SELECT * FROM categorias_productos
      WHERE restaurante_id = ? AND activa = 1
      ORDER BY orden_display, nombre
    `, [restaurantId]);

    // Si no hay categorías, crear las básicas según el tipo de restaurante
    if (categories.length === 0) {
      // Primero obtener el tipo de restaurante
      const [restaurantInfo] = await db.execute(`
        SELECT r.*, GROUP_CONCAT(cr.nombre) as categorias_restaurante
        FROM restaurantes r
        LEFT JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
        LEFT JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
        WHERE r.id = ?
        GROUP BY r.id
      `, [restaurantId]);

      const restaurantType = restaurantInfo[0]?.categorias_restaurante?.toLowerCase() || '';

      // Definir categorías según el tipo de restaurante
      let defaultCategories = [];
      
      if (restaurantType.includes('pizza')) {
        defaultCategories = [
          ['Pizzas Clásicas', 'Nuestras pizzas tradicionales', 1],
          ['Pizzas Gourmet', 'Pizzas especiales y premium', 2],
          ['Empanadas', 'Empanadas caseras', 3],
          ['Bebidas', 'Bebidas y refrescos', 4],
          ['Postres', 'Dulces y postres', 5]
        ];
      } else if (restaurantType.includes('parrilla')) {
        defaultCategories = [
          ['Parrilladas', 'Nuestras parrilladas', 1],
          ['Carnes', 'Cortes de carne', 2],
          ['Guarniciones', 'Acompañamientos', 3],
          ['Ensaladas', 'Ensaladas frescas', 4],
          ['Bebidas', 'Bebidas y refrescos', 5],
          ['Postres', 'Dulces y postres', 6]
        ];
      } else if (restaurantType.includes('asiática')) {
        defaultCategories = [
          ['Sushi & Rolls', 'Piezas frescas de sushi', 1],
          ['Wok', 'Platos salteados', 2],
          ['Sopas', 'Sopas tradicionales', 3],
          ['Entradas', 'Entradas asiáticas', 4],
          ['Bebidas', 'Bebidas y refrescos', 5],
          ['Postres', 'Postres asiáticos', 6]
        ];
      } else if (restaurantType.includes('comida rápida')) {
        defaultCategories = [
          ['Hamburguesas', 'Nuestras hamburguesas', 1],
          ['Sandwiches', 'Sandwiches y wraps', 2],
          ['Papas y Acompañamientos', 'Papas fritas y más', 3],
          ['Bebidas', 'Bebidas y refrescos', 4],
          ['Postres', 'Dulces y postres', 5]
        ];
      } else {
        // Categorías genéricas para otros tipos de restaurantes
        defaultCategories = [
          ['Entradas', 'Platos para comenzar', 1],
          ['Platos Principales', 'Nuestros platos más destacados', 2],
          ['Acompañamientos', 'Guarniciones y extras', 3],
          ['Bebidas', 'Bebidas y refrescos', 4],
          ['Postres', 'Dulces y postres', 5]
        ];
      }

      // Insertar las categorías
      for (const [nombre, descripcion, orden] of defaultCategories) {
        await db.execute(`
          INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
          VALUES (?, ?, ?, ?, 1)
        `, [restaurantId, nombre, descripcion, orden]);
      }

      // Recargar categorías
      [categories] = await db.execute(`
        SELECT * FROM categorias_productos
        WHERE restaurante_id = ? AND activa = 1
        ORDER BY orden_display, nombre
      `, [restaurantId]);
    }
    
    // Get products with categories
    const [products] = await db.execute(`
      SELECT p.*, cp.nombre as categoria_nombre,
             CAST(p.precio AS DECIMAL(10,2)) as precio
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.restaurante_id = ?
      ORDER BY cp.orden_display, p.nombre
    `, [restaurantId]);
    
    res.render('dashboard/products', {
      title: 'Gestionar Productos - A la Mesa',
      products,
      categories,
      restaurantId,
      scripts: ['/js/dashboard-products.js']
    });
    
  } catch (error) {
    console.error('Error cargando productos:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando los productos',
      error: {}
    });
  }
});

// Add/Edit product
router.post('/products/save', requireRestaurant, upload.single('imagen'), [
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('descripcion').notEmpty().withMessage('La descripción es requerida'),
  body('precio').isFloat({ min: 0 }).withMessage('El precio debe ser válido'),
  body('categoria_id').isInt().withMessage('Selecciona una categoría válida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({
        success: false,
        message: 'Por favor verifica los datos ingresados'
      });
    }
    
    const userId = req.session.user.id;
    const { product_id, nombre, descripcion, precio, categoria_id, disponible, ingredientes } = req.body;
    
    // Get restaurant
    const [restaurants] = await db.execute(`
      SELECT id FROM restaurantes WHERE usuario_id = ?
    `, [userId]);
    
    if (restaurants.length === 0) {
      return res.json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }
    
    const restaurantId = restaurants[0].id;
    let imagePath = null;
    
    if (req.file) {
      imagePath = req.file.filename;
    }
    
    if (product_id) {
      // Update existing product
      let sql = `
        UPDATE productos 
        SET nombre = ?, descripcion = ?, precio = ?, categoria_id = ?, 
            disponible = ?, ingredientes = ?
      `;
      let params = [nombre, descripcion, precio, categoria_id, disponible === 'on' ? 1 : 0, ingredientes || null];
      
      if (imagePath) {
        sql += ', imagen = ?';
        params.push(imagePath);
      }
      
      sql += ' WHERE id = ? AND restaurante_id = ?';
      params.push(product_id, restaurantId);
      
      await db.execute(sql, params);
      
      res.json({
        success: true,
        message: 'Producto actualizado exitosamente'
      });
    } else {
      // Create new product
      await db.execute(`
        INSERT INTO productos (
          restaurante_id, categoria_id, nombre, descripcion, precio, 
          imagen, ingredientes, disponible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        restaurantId, categoria_id, nombre, descripcion, precio,
        imagePath, ingredientes || null, disponible === 'on' ? 1 : 0
      ]);
      
      res.json({
        success: true,
        message: 'Producto creado exitosamente'
      });
    }
    
  } catch (error) {
    console.error('Error guardando producto:', error);
    res.json({
      success: false,
      message: 'Error guardando el producto'
    });
  }
});

// Cambiar disponibilidad de producto
router.put('/products/:id/availability', requireRestaurant, async (req, res) => {
    try {
        const productId = req.params.id;
        const { disponible } = req.body;
        const userId = req.session.user.id;
        
        // Get restaurant
        const [restaurants] = await db.execute(`
            SELECT id FROM restaurantes WHERE usuario_id = ?
        `, [userId]);
        
        if (restaurants.length === 0) {
            return res.json({
                success: false,
                message: 'Restaurante no encontrado'
            });
        }
        
        const restaurantId = restaurants[0].id;
        
        // Update product availability
        await db.execute(`
            UPDATE productos 
            SET disponible = ?
            WHERE id = ? AND restaurante_id = ?
        `, [disponible ? 1 : 0, productId, restaurantId]);
        
        res.json({
            success: true,
            message: 'Disponibilidad actualizada exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando disponibilidad:', error);
        res.json({
            success: false,
            message: 'Error actualizando la disponibilidad'
        });
    }
});

// Delete product
router.delete('/products/:id', requireRestaurant, async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user.id;
    
    // Get restaurant
    const [restaurants] = await db.execute(`
      SELECT id FROM restaurantes WHERE usuario_id = ?
    `, [userId]);
    
    if (restaurants.length === 0) {
      return res.json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }
    
    const restaurantId = restaurants[0].id;
    
    // Delete product
    await db.execute(`
      DELETE FROM productos 
      WHERE id = ? AND restaurante_id = ?
    `, [productId, restaurantId]);
    
    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });
    
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.json({
      success: false,
      message: 'Error eliminando el producto'
    });
  }
});

// Orders management
router.get('/orders', requireRestaurant, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get restaurant
    const [restaurants] = await db.execute(`
      SELECT id FROM restaurantes WHERE usuario_id = ?
    `, [userId]);
    
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    
    const restaurantId = restaurants[0].id;
    
    // Get orders with customer info
    const [orders] = await db.execute(`
      SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido,
             u.telefono as cliente_telefono,
             COUNT(ip.id) as total_items
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      LEFT JOIN items_pedido ip ON p.id = ip.pedido_id
      WHERE p.restaurante_id = ?
      GROUP BY p.id
      ORDER BY p.fecha_pedido DESC
    `, [restaurantId]);
    
    res.render('dashboard/orders', {
      title: 'Gestionar Pedidos - A la Mesa',
      orders,
      scripts: ['/js/dashboard-orders.js']
    });
    
  } catch (error) {
    console.error('Error cargando pedidos:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando los pedidos',
      error: {}
    });
  }
});

// Get order details for restaurant
router.get('/orders/:id/details', requireRestaurant, async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user.id;
        
        // Get restaurant
        const [restaurants] = await db.execute(`
            SELECT id FROM restaurantes WHERE usuario_id = ?
        `, [userId]);
        
        if (restaurants.length === 0) {
            return res.json({
                success: false,
                message: 'Restaurante no encontrado'
            });
        }
        
        const restaurantId = restaurants[0].id;
        
        // Get order info
        const [orders] = await db.execute(`
            SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido,
                   u.telefono as cliente_telefono, u.email as cliente_email
            FROM pedidos p
            JOIN usuarios u ON p.cliente_id = u.id
            WHERE p.id = ? AND p.restaurante_id = ?
        `, [orderId, restaurantId]);
        
        if (orders.length === 0) {
            return res.json({
                success: false,
                message: 'Pedido no encontrado'
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
        
        // Render the order details partial
        const html = await ejs.renderFile('views/partials/order-details-restaurant.ejs', {
            order,
            items
        });
        
        res.json({
            success: true,
            html
        });
        
    } catch (error) {
        console.error('Error cargando detalles del pedido:', error);
        res.json({
            success: false,
            message: 'Error cargando los detalles del pedido'
        });
    }
});

// Update order status
router.post('/orders/:id/status', requireRestaurant, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;
    const userId = req.session.user.id;
    
    // Get restaurant
    const [restaurants] = await db.execute(`
      SELECT id FROM restaurantes WHERE usuario_id = ?
    `, [userId]);
    
    if (restaurants.length === 0) {
      return res.json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }
    
    const restaurantId = restaurants[0].id;
    
    // Update order status
    const updateFields = { estado: status };
    let sql = 'UPDATE pedidos SET estado = ?';
    let params = [status];
    
    // Add timestamp for specific statuses
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    switch (status) {
      case 'confirmado':
        sql += ', fecha_confirmacion = ?';
        params.push(now);
        break;
      case 'listo':
        sql += ', fecha_listo = ?';
        params.push(now);
        break;
      case 'entregado':
        sql += ', fecha_entrega = ?';
        params.push(now);
        break;
    }
    
    sql += ' WHERE id = ? AND restaurante_id = ?';
    params.push(orderId, restaurantId);
    
    await db.execute(sql, params);
    
    // Get customer ID for socket notification
    const [orders] = await db.execute(`
      SELECT cliente_id FROM pedidos WHERE id = ?
    `, [orderId]);
    
    if (orders.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${orders[0].cliente_id}`).emit('order-status-changed', {
          orderId: orderId,
          status: status,
          userId: orders[0].cliente_id
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Estado del pedido actualizado'
    });
    
  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.json({
      success: false,
      message: 'Error actualizando el estado del pedido'
    });
  }
});

// ========== SISTEMA DE COBROS PARA RESTAURANTES ==========

// Configure multer for payment receipts
const receiptStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/comprobantes/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'comprobante-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadReceipt = multer({ 
  storage: receiptStorage,
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

// Ver cobros del restaurante
router.get('/cobros', requireRestaurant, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get restaurant
    const [restaurants] = await db.execute(`
      SELECT id, nombre FROM restaurantes WHERE usuario_id = ?
    `, [userId]);
    
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    
    const restaurantId = restaurants[0].id;
    const restaurantName = restaurants[0].nombre;
    
    // Get weekly charges
    const [cobros] = await db.execute(`
      SELECT cs.*, 
             COUNT(cp.id) as comprobantes_count,
             SUM(CASE WHEN cp.estado = 'aprobado' THEN cp.monto_pagado ELSE 0 END) as monto_pagado_aprobado
      FROM cobros_semanales cs
      LEFT JOIN comprobantes_pago cp ON cs.id = cp.cobro_semanal_id
      WHERE cs.restaurante_id = ?
      GROUP BY cs.id
      ORDER BY cs.semana_inicio DESC
      LIMIT 20
    `, [restaurantId]);
    
    // Get recent payment receipts
    const [comprobantes] = await db.execute(`
      SELECT cp.*, cs.semana_inicio, cs.semana_fin, cs.monto_comision
      FROM comprobantes_pago cp
      JOIN cobros_semanales cs ON cp.cobro_semanal_id = cs.id
      WHERE cp.restaurante_id = ?
      ORDER BY cp.fecha_subida DESC
      LIMIT 10
    `, [restaurantId]);
    
    res.render('dashboard/cobros', {
      title: 'Mis Cobros - A la Mesa',
      user: req.session.user,
      restaurant: { id: restaurantId, nombre: restaurantName },
      cobros,
      comprobantes
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

// Subir comprobante de pago
router.post('/cobros/:cobroId/comprobante', requireRestaurant, uploadReceipt.single('comprobante'), [
  body('metodo_pago').notEmpty().withMessage('Selecciona un método de pago'),
  body('monto_pagado').isFloat({ min: 0 }).withMessage('El monto debe ser válido'),
  body('fecha_pago_declarada').isDate().withMessage('La fecha debe ser válida')
], async (req, res) => {
  try {
    const cobroId = req.params.cobroId;
    const userId = req.session.user.id;
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.json({
        success: false,
        message: 'Por favor, verifica todos los campos',
        errors: errors.array()
      });
    }
    
    if (!req.file) {
      return res.json({
        success: false,
        message: 'Debes subir un archivo de comprobante'
      });
    }
    
    // Get restaurant
    const [restaurants] = await db.execute(`
      SELECT id FROM restaurantes WHERE usuario_id = ?
    `, [userId]);
    
    if (restaurants.length === 0) {
      return res.json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }
    
    const restaurantId = restaurants[0].id;
    
    // Verify the charge belongs to this restaurant
    const [cobros] = await db.execute(`
      SELECT id, monto_comision FROM cobros_semanales 
      WHERE id = ? AND restaurante_id = ?
    `, [cobroId, restaurantId]);
    
    if (cobros.length === 0) {
      return res.json({
        success: false,
        message: 'Cobro no encontrado'
      });
    }
    
    const { metodo_pago, referencia_pago, monto_pagado, fecha_pago_declarada, comentarios_restaurante } = req.body;
    
    // Insert payment receipt
    await db.execute(`
      INSERT INTO comprobantes_pago 
      (cobro_semanal_id, restaurante_id, archivo_comprobante, metodo_pago, 
       referencia_pago, monto_pagado, fecha_pago_declarada, comentarios_restaurante)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cobroId, 
      restaurantId, 
      req.file.filename, 
      metodo_pago, 
      referencia_pago || null, 
      monto_pagado, 
      fecha_pago_declarada, 
      comentarios_restaurante || null
    ]);
    
    res.json({
      success: true,
      message: 'Comprobante subido exitosamente. Será revisado por el administrador.'
    });
    
  } catch (error) {
    console.error('Error uploading receipt:', error);
    res.json({
      success: false,
      message: 'Error subiendo el comprobante'
    });
  }
});

// Ver detalle de un cobro específico
router.get('/cobros/:cobroId', requireRestaurant, async (req, res) => {
  try {
    const cobroId = req.params.cobroId;
    const userId = req.session.user.id;
    
    // Get restaurant
    const [restaurants] = await db.execute(`
      SELECT id, nombre FROM restaurantes WHERE usuario_id = ?
    `, [userId]);
    
    if (restaurants.length === 0) {
      return res.redirect('/dashboard');
    }
    
    const restaurantId = restaurants[0].id;
    
    // Get charge details
    const [cobros] = await db.execute(`
      SELECT * FROM cobros_semanales 
      WHERE id = ? AND restaurante_id = ?
    `, [cobroId, restaurantId]);
    
    if (cobros.length === 0) {
      return res.status(404).render('error', {
        title: 'Cobro No Encontrado',
        message: 'El cobro que buscas no existe',
        error: {}
      });
    }
    
    const cobro = cobros[0];
    
    // Get payment receipts for this charge
    const [comprobantes] = await db.execute(`
      SELECT * FROM comprobantes_pago 
      WHERE cobro_semanal_id = ?
      ORDER BY fecha_subida DESC
    `, [cobroId]);
    
    // Get related orders for this period
    const [pedidos] = await db.execute(`
      SELECT p.*, u.nombre as cliente_nombre, u.apellido as cliente_apellido
      FROM pedidos p
      JOIN usuarios u ON p.cliente_id = u.id
      WHERE p.restaurante_id = ? 
        AND p.fecha_pedido >= ? 
        AND p.fecha_pedido <= ?
        AND p.estado NOT IN ('cancelled', 'rejected')
      ORDER BY p.fecha_pedido DESC
    `, [restaurantId, cobro.semana_inicio, cobro.semana_fin]);
    
    res.render('dashboard/cobro-detalle', {
      title: `Cobro del ${new Date(cobro.semana_inicio).toLocaleDateString('es-AR')} - A la Mesa`,
      user: req.session.user,
      restaurant: restaurants[0],
      cobro,
      comprobantes,
      pedidos
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

// Get product details
router.get('/products/:id', requireRestaurant, async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.session.user.id;
        
        // Get restaurant
        const [restaurants] = await db.execute(`
            SELECT id FROM restaurantes WHERE usuario_id = ?
        `, [userId]);
        
        if (restaurants.length === 0) {
            return res.json({
                success: false,
                message: 'Restaurante no encontrado'
            });
        }
        
        const restaurantId = restaurants[0].id;
        
        // Get product details
        const [products] = await db.execute(`
            SELECT p.*, CAST(p.precio AS DECIMAL(10,2)) as precio
            FROM productos p
            WHERE p.id = ? AND p.restaurante_id = ?
        `, [productId, restaurantId]);
        
        if (products.length === 0) {
            return res.json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        res.json({
            success: true,
            product: products[0]
        });
        
    } catch (error) {
        console.error('Error obteniendo detalles del producto:', error);
        res.json({
            success: false,
            message: 'Error obteniendo los detalles del producto'
        });
    }
});

// Settings page
router.get('/settings', requireRestaurant, async (req, res) => {
    try {
        console.log('Iniciando carga de configuración...');
        const userId = req.session.user.id;
        console.log('Usuario ID:', userId);
        
        // Get restaurant info
        console.log('Consultando información del restaurante...');
        const [restaurants] = await db.execute(`
            SELECT r.*, 
                   u.nombre as propietario_nombre, 
                   u.apellido as propietario_apellido, 
                   u.email as propietario_email,
                   GROUP_CONCAT(cr.nombre) as categorias_restaurante,
                   r.dias_operacion
            FROM restaurantes r
            JOIN usuarios u ON r.usuario_id = u.id
            LEFT JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
            LEFT JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
            WHERE r.usuario_id = ?
            GROUP BY r.id, r.nombre, r.descripcion, r.direccion, r.telefono, 
                     r.horario_apertura, r.horario_cierre, r.delivery, 
                     r.reservas, r.pedidos_online, r.imagen_logo,
                     r.dias_operacion, r.activo, r.verificado,
                     u.nombre, u.apellido, u.email
        `, [userId]);
        
        console.log('Resultado de la consulta:', {
            encontrados: restaurants.length,
            primerRestaurante: restaurants[0] ? {
                id: restaurants[0].id,
                nombre: restaurants[0].nombre,
                dias_operacion: restaurants[0].dias_operacion
            } : null
        });
        
        if (restaurants.length === 0) {
            console.log('No se encontró el restaurante para el usuario:', userId);
            return res.redirect('/dashboard');
        }
        
        const restaurant = restaurants[0];
        
        // Log para verificar los datos del restaurante
        console.log('Datos del restaurante cargados (raw):', {
            id: restaurant.id,
            nombre: restaurant.nombre,
            dias_operacion: restaurant.dias_operacion,
            dias_operacion_type: typeof restaurant.dias_operacion
        });

        // Asegurarnos de que dias_operacion sea un array
        let diasOperacionParsed = null;
        try {
            if (restaurant.dias_operacion) {
                if (Array.isArray(restaurant.dias_operacion)) {
                    // Si ya es un array, usarlo directamente
                    diasOperacionParsed = restaurant.dias_operacion;
                } else if (typeof restaurant.dias_operacion === 'string') {
                    // Si es un string, intentar parsearlo como JSON
                    const diasOperacionClean = restaurant.dias_operacion.trim();
                    if (diasOperacionClean) {
                        diasOperacionParsed = JSON.parse(diasOperacionClean);
                    }
                }
            }
        } catch (e) {
            console.error('Error al procesar dias_operacion:', {
                error: e.message,
                dias_operacion: restaurant.dias_operacion,
                type: typeof restaurant.dias_operacion
            });
        }

        // Si no hay días de operación o hubo error, usar los días que vienen de la base de datos
        if (!diasOperacionParsed || !Array.isArray(diasOperacionParsed)) {
            diasOperacionParsed = Array.isArray(restaurant.dias_operacion) ? 
                restaurant.dias_operacion : 
                [1,2,3,4,5,6,7];
        }

        // Asegurarnos de que todos los valores sean números
        diasOperacionParsed = diasOperacionParsed.map(dia => parseInt(dia)).filter(dia => !isNaN(dia));
        
        // Actualizar el objeto restaurant con los días parseados
        restaurant.dias_operacion = JSON.stringify(diasOperacionParsed);
        
        console.log('Datos del restaurante procesados:', {
            id: restaurant.id,
            nombre: restaurant.nombre,
            dias_operacion: restaurant.dias_operacion,
            dias_operacion_parsed: diasOperacionParsed,
            dias_operacion_type: typeof restaurant.dias_operacion,
            categorias_restaurante: restaurant.categorias_restaurante
        });
        
        // Get all restaurant categories for the form
        console.log('Consultando categorías de restaurantes...');
        const [categories] = await db.execute(`
            SELECT * FROM categorias_restaurantes
            ORDER BY nombre
        `);
        
        console.log('Categorías encontradas:', categories.length);
        
        // Get restaurant's current categories
        console.log('Consultando categorías del restaurante...');
        const [restaurantCategories] = await db.execute(`
            SELECT categoria_id 
            FROM restaurante_categorias 
            WHERE restaurante_id = ?
        `, [restaurant.id]);
     
        const selectedCategories = restaurantCategories.map(rc => rc.categoria_id);
        console.log('Categorías seleccionadas:', selectedCategories);
        
        console.log('Renderizando vista de configuración...');
        res.render('dashboard/settings', {
            title: 'Configuración - A la Mesa',
            restaurant,
            categories,
            selectedCategories
        });
        
    } catch (error) {
        console.error('Error detallado cargando configuración:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.render('error', {
            title: 'Error',
            message: 'Error cargando la configuración',
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
});

// Update restaurant settings
router.post('/settings', upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
]), async (req, res) => {
    console.log('POST /settings recibido:', {
        body: req.body,
        files: req.files,
        session: req.session?.user?.id ? 'Usuario autenticado' : 'No autenticado',
        dias_operacion_raw: req.body.dias_operacion,
        dias_operacion_type: typeof req.body.dias_operacion
    });

    // Verificar autenticación
    if (!req.session.user?.id) {
        console.log('Error: Usuario no autenticado');
        return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    try {
        console.log('Buscando restaurante para usuario:', req.session.user.id);
        // Obtener restaurante
        const [restaurante] = await db.execute(
            'SELECT id FROM restaurantes WHERE usuario_id = ?',
            [req.session.user.id]
        );

        if (!restaurante || restaurante.length === 0) {
            console.log('Error: Restaurante no encontrado');
            return res.status(404).json({ success: false, error: 'Restaurante no encontrado' });
        }

        console.log('Restaurante encontrado:', restaurante);
        const restauranteId = restaurante[0].id;

        // Procesar días de operación
        let diasOperacion = [];
        if (req.body.dias_operacion) {
            try {
                console.log('Procesando días de operación (raw):', req.body.dias_operacion);
                
                // Si es un array (viene del FormData), procesarlo directamente
                if (Array.isArray(req.body.dias_operacion)) {
                    diasOperacion = req.body.dias_operacion
                        .map(dia => parseInt(dia))
                        .filter(dia => !isNaN(dia) && dia >= 1 && dia <= 7);
                } else {
                    // Intentar parsear como JSON
                    try {
                        const diasOperacionParsed = JSON.parse(req.body.dias_operacion);
                        if (!Array.isArray(diasOperacionParsed)) {
                            throw new Error('Los días de operación deben ser un array');
                        }
                        diasOperacion = diasOperacionParsed
                            .map(dia => parseInt(dia))
                            .filter(dia => !isNaN(dia) && dia >= 1 && dia <= 7);
                    } catch (parseError) {
                        console.error('Error parseando JSON de días de operación:', parseError);
                        throw new Error('Formato inválido de días de operación');
                    }
                }

                console.log('Días de operación procesados y validados:', diasOperacion);

                if (diasOperacion.length === 0) {
                    throw new Error('Debe seleccionar al menos un día de operación');
                }
            } catch (error) {
                console.error('Error procesando días de operación:', error);
                return res.status(400).json({ 
                    success: false, 
                    error: error.message || 'Formato inválido de días de operación' 
                });
            }
        } else {
            console.log('No se recibieron días de operación');
            return res.status(400).json({ 
                success: false, 
                error: 'Debe seleccionar al menos un día de operación' 
            });
        }

        try {
            // Log de los valores antes de la consulta
            const updateValues = [
                req.body.nombre,
                req.body.descripcion,
                req.body.direccion,
                req.body.telefono,
                req.body.horario_apertura,
                req.body.horario_cierre,
                JSON.stringify(diasOperacion),
                req.body.delivery === 'on' ? 1 : 0,
                req.body.pedidos_online === 'on' ? 1 : 0,
                parseFloat(req.body.costo_delivery) || 0,
                restauranteId,
                req.session.user.id
            ];

            console.log('Valores a actualizar:', {
                nombre: updateValues[0],
                descripcion: updateValues[1],
                direccion: updateValues[2],
                telefono: updateValues[3],
                horario_apertura: updateValues[4],
                horario_cierre: updateValues[5],
                dias_operacion: updateValues[6],
                delivery: updateValues[7],
                pedidos_online: updateValues[8],
                costo_delivery: updateValues[9],
                restaurante_id: updateValues[10],
                usuario_id: updateValues[11]
            });

            // Verificar si hay valores undefined
            const undefinedIndexes = updateValues.map((val, idx) => val === undefined ? idx : -1).filter(idx => idx !== -1);
            if (undefinedIndexes.length > 0) {
                console.error('Valores undefined encontrados en índices:', undefinedIndexes);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Hay campos requeridos sin valor' 
                });
            }

            // Actualizar restaurante con una consulta simple
            await db.execute(`
                UPDATE restaurantes 
                SET nombre = ?,
                    descripcion = ?,
                    direccion = ?,
                    telefono = ?,
                    horario_apertura = ?,
                    horario_cierre = ?,
                    dias_operacion = ?,
                    delivery = ?,
                    pedidos_online = ?,
                    costo_delivery = ?
                WHERE id = ? AND usuario_id = ?
            `, updateValues);

            console.log('Restaurante actualizado exitosamente');

            // Actualizar categorías si se enviaron
            if (req.body.categorias && Array.isArray(req.body.categorias)) {
                // Primero eliminar categorías existentes
                await db.execute(
                    'DELETE FROM restaurante_categorias WHERE restaurante_id = ?',
                    [restauranteId]
                );

                // Insertar nuevas categorías
                if (req.body.categorias.length > 0) {
                    const categoriaValues = req.body.categorias.map(catId => [restauranteId, catId]);
                    await db.query(
                        'INSERT INTO restaurante_categorias (restaurante_id, categoria_id) VALUES ?',
                        [categoriaValues]
                    );
                }
            }

            // Redirigir a la página de configuración con un mensaje de éxito
            req.session.flashMessage = {
                type: 'success',
                message: 'Configuración actualizada correctamente'
            };
            return res.redirect('/dashboard/settings');

        } catch (error) {
            console.error('Error al actualizar configuración:', error);
            // En caso de error, también redirigimos pero con mensaje de error
            req.session.flashMessage = {
                type: 'error',
                message: 'Error al actualizar la configuración'
            };
            return res.redirect('/dashboard/settings');
        }

    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Error al actualizar la configuración' 
        });
    }
});

// Toggle restaurant status
router.post('/toggle-status', requireRestaurant, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { accion } = req.body;
        
        // Get restaurant
        const [restaurants] = await db.execute(`
            SELECT id FROM restaurantes WHERE usuario_id = ?
        `, [userId]);
        
        if (restaurants.length === 0) {
            return res.json({
                success: false,
                message: 'Restaurante no encontrado'
            });
        }
        
        const restaurantId = restaurants[0].id;
        const nuevoEstado = accion === 'activar' ? 1 : 0;
        
        // Update restaurant status
        await db.execute(
            'UPDATE restaurantes SET activo = ? WHERE id = ? AND usuario_id = ?',
            [nuevoEstado, restaurantId, userId]
        );
        
        res.json({
            success: true,
            message: `Restaurante ${accion === 'activar' ? 'activado' : 'desactivado'} exitosamente`
        });
        
    } catch (error) {
        console.error('Error cambiando estado del restaurante:', error);
        res.json({
            success: false,
            message: 'Error al cambiar el estado del restaurante'
        });
    }
});

module.exports = router;