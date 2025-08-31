
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
    console.log('Iniciando consulta de restaurantes...');
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
      LIMIT 6
    `);
    console.log('Restaurantes encontrados:', restaurants.length);

    let processedRestaurants = processRestaurantList(restaurants);

    console.log('Iniciando consulta de categorías...');
    // Get restaurant categories
    const [categories] = await db.execute(`
      SELECT * FROM categorias_restaurantes 
      WHERE activa = 1 
      ORDER BY orden_display ASC
    `);
    console.log('Categorías encontradas:', categories.length);

    console.log('Renderizando página...');
    res.render('index', {
      title: 'A la Mesa - Delivery de Comida',
      restaurants: processedRestaurants,
      categories,
      user: req.session.user,
      topRatedRestaurants: processedRestaurants.slice(0, 6),
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
    const { q: query, category, location } = req.query;
    
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
    
    sql += ` GROUP BY 
      r.id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner,
      r.direccion, r.ciudad, r.telefono, r.email_contacto,
      r.horario_apertura, r.horario_cierre, r.tiempo_entrega_min,
      r.tiempo_entrega_max, r.costo_delivery, r.calificacion_promedio,
      r.total_calificaciones
    ORDER BY r.calificacion_promedio DESC`;
    
    console.log('Ejecutando búsqueda mejorada con query:', query, 'categoría:', category);
    const [restaurants] = await db.execute(sql, params);
    console.log('Restaurantes encontrados:', restaurants.length);
    
    // Usar la función centralizada para determinar si el restaurante está abierto
    processRestaurantList(restaurants);
    
    // Get categories for filter (solo categorías de productos)
    const [categories] = await db.execute(`
      SELECT DISTINCT nombre FROM categorias_productos 
      WHERE restaurante_id IS NULL
      ORDER BY nombre ASC
    `);
    console.log('Categorías disponibles:', categories.length);

    res.render('search', {
      title: `Resultados de búsqueda${query ? ` para "${query}"` : ''}`,
      restaurants,
      categories,
      searchQuery: query || '',
      selectedCategory: category || '',
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

// 404 error page
router.get('/error-404', (req, res) => {
  res.status(404).render('error-404', {
    title: 'Página No Encontrada - A la Mesa',
    user: req.session.user
  });
});

module.exports = router;
