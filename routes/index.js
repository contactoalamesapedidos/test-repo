const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { processRestaurantList } = require('../utils/restaurantUtils');
const CategoryIcons = require('../utils/categoryIcons');

// Beneficios para Restaurantes
router.get('/beneficios-restaurantes', (req, res) => {
  res.render('beneficios-restaurantes', {
    title: 'Beneficios para Restaurantes - A la Mesa',
    user: req.session.user
  });
});

// Beneficios para Clientes
router.get('/beneficios-clientes', (req, res) => {
  res.render('beneficios-clientes', {
    title: 'Beneficios para Clientes - A la Mesa',
    user: req.session.user
  });
});

// Home page
router.get('/', async (req, res) => {
  try {
    // Check if user is logged in as restaurant owner
    let userRestaurant = null;
    if (req.session.user && req.session.user.tipo_usuario === 'restaurante') {
      const [userRestaurants] = await db.execute(`
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
          r.dias_operacion,
          GROUP_CONCAT(DISTINCT cr.nombre) as categorias,
          COUNT(DISTINCT p.id) as total_productos
        FROM restaurantes r
        LEFT JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
        LEFT JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
        LEFT JOIN productos p ON r.id = p.restaurante_id AND p.disponible = 1
        WHERE r.usuario_id = ? AND r.activo = 1
        GROUP BY
          r.id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner,
          r.direccion, r.ciudad, r.telefono, r.email_contacto,
          r.horario_apertura, r.horario_cierre, r.tiempo_entrega_min,
          r.tiempo_entrega_max, r.costo_delivery, r.calificacion_promedio,
          r.total_calificaciones
        LIMIT 1
      `, [req.session.user.id]);

      if (userRestaurants.length > 0) {
        userRestaurant = processRestaurantList([userRestaurants[0]])[0];
      }
    }

    // Get featured restaurants
    const [restaurants] = await db.execute(`
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
        r.dias_operacion,
        GROUP_CONCAT(DISTINCT cr.nombre) as categorias,
        COUNT(DISTINCT p.id) as total_productos
      FROM restaurantes r
      LEFT JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
      LEFT JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
      LEFT JOIN productos p ON r.id = p.restaurante_id AND p.disponible = 1
      WHERE r.verificado = 1
      GROUP BY
        r.id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner,
        r.direccion, r.ciudad, r.telefono, r.email_contacto,
        r.horario_apertura, r.horario_cierre, r.tiempo_entrega_min,
        r.tiempo_entrega_max, r.costo_delivery, r.calificacion_promedio,
        r.total_calificaciones
      ORDER BY r.calificacion_promedio DESC
      LIMIT 50
    `);

    let processedRestaurants = processRestaurantList(restaurants);

    processedRestaurants.sort((a, b) => {
      if (a.abierto && !b.abierto) return -1;
      if (!a.abierto && b.abierto) return 1;
      return b.calificacion_promedio - a.calificacion_promedio;
    });

    const featuredRestaurants = processedRestaurants.slice(0, 6);

    // Get product categories
    const [categories] = await db.execute(`
      SELECT nombre, COALESCE(orden_display, 999) as orden_display FROM categorias_productos
      WHERE restaurante_id IS NULL AND activa = 1
      ORDER BY orden_display ASC, nombre ASC
    `);
    res.render('index', {
      title: 'A la Mesa - Delivery de Comida',
      restaurants: featuredRestaurants,
      categories,
      user: req.session.user,
      topRatedRestaurants: featuredRestaurants,
      userRestaurant: userRestaurant,
      CategoryIcons: CategoryIcons
    });
  } catch (error) {
    console.error('Error detallado en home:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.render('error', {
      title: 'Error',
      message: 'Error cargando la página principal',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Search results
router.get('/search', async (req, res) => {
  try {
    const { q: query, category, location, sort, price_range, min_rating } = req.query;
    
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
        COALESCE(r.calificacion_promedio, 0) as calificacion_promedio,
        r.total_calificaciones,
        GROUP_CONCAT(DISTINCT cr.nombre) as categorias,
        GROUP_CONCAT(DISTINCT cp.nombre) as categorias_productos,
        COUNT(DISTINCT p.id) as total_productos
      FROM restaurantes r
      LEFT JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
      LEFT JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
      LEFT JOIN productos p ON r.id = p.restaurante_id AND p.disponible = 1
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE r.verificado = 1
      GROUP BY
        r.id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner,
        r.direccion, r.ciudad, r.telefono, r.email_contacto,
        r.horario_apertura, r.horario_cierre, r.tiempo_entrega_min,
        r.tiempo_entrega_max, r.costo_delivery, r.calificacion_promedio,
        r.total_calificaciones
    `;
    
    const params = [];
    
    if (query) {
      // Búsqueda mejorada: nombre de restaurante, descripción, productos, categorías de productos
      sql += ` AND (
        r.nombre LIKE ? OR 
        r.descripcion LIKE ? OR 
        EXISTS (
          SELECT 1 FROM productos p2 
          WHERE p2.restaurante_id = r.id 
          AND p2.disponible = 1 
          AND (p2.nombre LIKE ? OR p2.descripcion LIKE ?)
        ) OR
        EXISTS (
          SELECT 1 FROM productos p3 
          JOIN categorias_productos cp2 ON p3.categoria_id = cp2.id
          WHERE p3.restaurante_id = r.id 
          AND p3.disponible = 1 
          AND cp2.nombre LIKE ?
        )
      )`;
      params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
    }
    
    if (category) {
      // Búsqueda por categoría de restaurante O categoría de productos
      sql += ` AND (
        LOWER(cr.nombre) = LOWER(?) OR
        EXISTS (
          SELECT 1 FROM productos p4
          JOIN categorias_productos cp3 ON p4.categoria_id = cp3.id
          WHERE p4.restaurante_id = r.id
          AND p4.disponible = 1
          AND LOWER(cp3.nombre) = LOWER(?)
        )
      )`;
      params.push(category, category);
    }

    // Aplicar filtros adicionales después del GROUP BY
    let havingClause = '';

    if (price_range) {
      // Filtro por rango de precio basado en productos disponibles
      if (price_range === '0-50') {
        havingClause += 'HAVING MIN(p.precio) >= 0 AND MIN(p.precio) <= 50';
      } else if (price_range === '50-100') {
        havingClause += 'HAVING MIN(p.precio) >= 50 AND MIN(p.precio) <= 100';
      } else if (price_range === '100-200') {
        havingClause += 'HAVING MIN(p.precio) >= 100 AND MIN(p.precio) <= 200';
      } else if (price_range === '200+') {
        havingClause += 'HAVING MIN(p.precio) >= 200';
      }
    }

    if (min_rating) {
      // Filtro por calificación mínima
      if (havingClause) {
        havingClause += ` AND r.calificacion_promedio >= ${parseFloat(min_rating)}`;
      } else {
        havingClause += `HAVING r.calificacion_promedio >= ${parseFloat(min_rating)}`;
      }
    }

    // Agregar MIN(p.precio) al SELECT si hay filtros de precio
    if (price_range) {
      sql = sql.replace('COUNT(DISTINCT p.id) as total_productos',
                       'COUNT(DISTINCT p.id) as total_productos, MIN(p.precio) as precio_minimo');
    }

    sql += ` GROUP BY
      r.id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner,
      r.direccion, r.ciudad, r.telefono, r.email_contacto,
      r.horario_apertura, r.horario_cierre, r.tiempo_entrega_min,
      r.tiempo_entrega_max, r.costo_delivery, r.calificacion_promedio,
      r.total_calificaciones`;

    // Agregar HAVING si hay condiciones
    if (havingClause) {
      sql += ` ${havingClause}`;
    }

    // Aplicar ordenamiento según el parámetro sort
    let orderBy = 'ORDER BY r.calificacion_promedio DESC'; // Default

    if (sort) {
      switch (sort) {
        case 'relevance':
          orderBy = 'ORDER BY r.calificacion_promedio DESC';
          break;
        case 'rating':
          orderBy = 'ORDER BY r.calificacion_promedio DESC';
          break;
        case 'delivery_time':
          orderBy = 'ORDER BY (r.tiempo_entrega_min + r.tiempo_entrega_max) / 2 ASC';
          break;
        case 'delivery_cost':
          orderBy = 'ORDER BY r.costo_delivery ASC';
          break;
        case 'price_low':
          orderBy = 'ORDER BY MIN(p.precio) ASC';
          break;
        case 'price_high':
          orderBy = 'ORDER BY MIN(p.precio) DESC';
          break;
        case 'name':
          orderBy = 'ORDER BY r.nombre ASC';
          break;
        case 'newest':
          orderBy = 'ORDER BY r.id DESC';
          break;
        default:
          orderBy = 'ORDER BY r.calificacion_promedio DESC';
      }
    }

    sql += ` ${orderBy}`;
    
    const [restaurants] = await db.execute(sql, params);
    
    // Usar la función centralizada para determinar si el restaurante está abierto
    processRestaurantList(restaurants);
    
    // Get categories for filter (solo categorías de productos)
    const [categories] = await db.execute(`
      SELECT nombre FROM categorias_productos
      WHERE restaurante_id IS NULL AND activa = 1
      ORDER BY COALESCE(orden_display, 999) ASC, nombre ASC
    `);

    res.render('search', {
      title: `Resultados de búsqueda${query ? ` para "${query}"` : ''}`,
      restaurants,
      categories,
      searchQuery: query || '',
      selectedCategory: category || '',
      sortBy: sort || 'relevance',
      priceRange: price_range || '',
      minRating: min_rating || '',
      user: req.session.user
    });
  } catch (error) {
    console.error('Error detallado en búsqueda:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.render('error', {
      title: 'Error de Búsqueda',
      message: 'Error realizando la búsqueda',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'Acerca de A la Mesa',
    user: req.session.user
  });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contacto - A la Mesa',
    user: req.session.user
  });
});

// Terms and conditions
router.get('/terms', (req, res) => {
  res.render('terms', {
    title: 'Términos y Condiciones',
    user: req.session.user
  });
});

// Privacy policy
router.get('/privacy', (req, res) => {
  res.render('privacy', {
    title: 'Política de Privacidad',
    user: req.session.user
  });
});

// Restaurant requirements page
router.get('/restaurant-requirements', (req, res) => {
  res.render('restaurant-requirements', {
    title: 'Requisitos para Restaurantes - A la Mesa',
    user: req.session.user
  });
});

// Legal information page
router.get('/legal-info', (req, res) => {
  res.render('legal-info', {
    title: 'Información Legal - A la Mesa',
    user: req.session.user
  });
});

// Welcome page
router.get('/bienvenido', (req, res) => {
  res.render('bienvenido', {
    title: 'Bienvenido a A la Mesa',
    user: req.session.user
  });
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const [result] = await db.execute('SELECT 1 as test, NOW() as time');
    res.json({
      status: 'OK',
      database: 'connected',
      timestamp: result[0].time,
      environment: process.env.NODE_ENV,
      db_host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      error: error.message,
      environment: process.env.NODE_ENV
    });
  }
});

// 404 error page
router.get('/error-404', (req, res) => {
  res.status(404).render('error-404', {
    title: 'Página No Encontrada - A la Mesa',
    user: req.session.user
  });
});

module.exports = router;
