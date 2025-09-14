const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Restaurants list
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, page = 1 } = req.query;
    const limit = 10;
    const offset = (page - 1) * limit;
    
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
        r.dias_operacion,
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
    
    let countSql = `
      SELECT COUNT(DISTINCT r.id) as total_count
      FROM restaurantes r
      LEFT JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
      LEFT JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
      LEFT JOIN productos p ON r.id = p.restaurante_id AND p.disponible = 1
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE r.verificado = 1
    `;
    
    const params = [];
    const countParams = [];
    
    if (search) {
      const searchPattern = `%${search}%`;
      sql += ` AND (r.nombre LIKE ? OR r.descripcion LIKE ? OR EXISTS (SELECT 1 FROM productos p2 WHERE p2.restaurante_id = r.id AND p2.disponible = 1 AND (p2.nombre LIKE ? OR p2.descripcion LIKE ?)) OR EXISTS (SELECT 1 FROM productos p3 JOIN categorias_productos cp2 ON p3.categoria_id = cp2.id WHERE p3.restaurante_id = r.id AND p3.disponible = 1 AND cp2.nombre LIKE ?))`;
      countSql += ` AND (r.nombre LIKE ? OR r.descripcion LIKE ? OR EXISTS (SELECT 1 FROM productos p2 WHERE p2.restaurante_id = r.id AND p2.disponible = 1 AND (p2.nombre LIKE ? OR p2.descripcion LIKE ?)) OR EXISTS (SELECT 1 FROM productos p3 JOIN categorias_productos cp2 ON p3.categoria_id = cp2.id WHERE p3.restaurante_id = r.id AND p3.disponible = 1 AND cp2.nombre LIKE ?))`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    if (category) {
      sql += ` AND (LOWER(cr.nombre) = LOWER(?) OR EXISTS (SELECT 1 FROM productos p4 JOIN categorias_productos cp3 ON p4.categoria_id = cp3.id WHERE p4.restaurante_id = r.id AND p4.disponible = 1 AND LOWER(cp3.nombre) = LOWER(?)))`;
      countSql += ` AND (LOWER(cr.nombre) = LOWER(?) OR EXISTS (SELECT 1 FROM productos p4 JOIN categorias_productos cp3 ON p4.categoria_id = cp3.id WHERE p4.restaurante_id = r.id AND p4.disponible = 1 AND LOWER(cp3.nombre) = LOWER(?)))`;
      params.push(category, category);
      countParams.push(category, category);
    }
    
    sql += ` GROUP BY r.id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner, r.direccion, r.ciudad, r.telefono, r.email_contacto, r.horario_apertura, r.horario_cierre, r.tiempo_entrega_min, r.tiempo_entrega_max, r.costo_delivery, r.calificacion_promedio, r.total_calificaciones`;
    
    // Sorting
    switch (sort) {
      case 'rating':
        sql += ` ORDER BY r.calificacion_promedio DESC`;
        break;
      case 'delivery_time':
        sql += ` ORDER BY r.tiempo_entrega_min ASC`;
        break;
      case 'delivery_cost':
        sql += ` ORDER BY r.costo_delivery ASC`;
        break;
      default:
        sql += ` ORDER BY r.calificacion_promedio DESC`;
    }

    const [totalResult] = await db.execute(countSql, countParams);
    const totalRestaurants = totalResult[0].total_count;
    const totalPages = Math.ceil(totalRestaurants / limit);

    sql += ` LIMIT ${limit} OFFSET ${offset}`;
    
    let [restaurants] = await db.execute(sql, params);
    
    // Usar la función centralizada para determinar si el restaurante está abierto
    const { processRestaurantList } = require('../utils/restaurantUtils');
    restaurants = processRestaurantList(restaurants);

    // Get categories for filter (incluir categorías de productos)
    const [categories] = await db.execute(`
      SELECT DISTINCT nombre, 'restaurante' as tipo FROM categorias_restaurantes 
      WHERE activa = 1 
      UNION
      SELECT DISTINCT nombre, 'producto' as tipo FROM categorias_productos 
      WHERE restaurante_id IS NULL
      ORDER BY nombre ASC
    `);

    res.render('restaurants/list', {
      title: 'Restaurantes - A la Mesa',
      restaurants,
      categories,
      currentCategory: category || '',
      currentSearch: search || '',
      currentSort: sort || 'rating',
      user: req.session.user,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error('Error detallado en listado de restaurantes:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.render('error', {
      title: 'Error',
      message: 'Error cargando restaurantes',
      error: process.env.NODE_ENV === 'development' ? error : {},
      user: req.session.user
    });
  }
});

// Restaurant detail
router.get('/:id', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    
    // Get restaurant info
    const [restaurants] = await db.execute(`
      SELECT r.id, r.usuario_id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner, r.direccion, r.ciudad, r.latitud, r.longitud, r.horario_apertura, r.horario_cierre, r.dias_operacion, r.tiempo_entrega_min, r.tiempo_entrega_max, r.costo_delivery, r.pedido_minimo, r.calificacion_promedio, r.total_calificaciones, r.activo, r.verificado, r.fecha_registro, u.nombre as owner_nombre, u.apellido as owner_apellido
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ?
    `, [restaurantId]);
    
    if (restaurants.length === 0) {
      return res.status(404).render('error', {
        title: 'Restaurante No Encontrado',
        message: 'El restaurante que buscas no existe o no está disponible',
        error: {}
      });
    }
    
    const restaurant = restaurants[0];
    
    // Calcular si el restaurante está abierto
    const { isRestaurantOpen } = require('../utils/restaurantUtils');
    restaurant.abierto = isRestaurantOpen(restaurant);
    
    // Obtener productos y categorías asociadas de una sola vez
    const [products] = await db.execute(`
      SELECT 
        p.*, 
        cp.nombre as categoria_nombre,
        cp.orden_display as categoria_orden,
        p.visible
      FROM productos p
      LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.restaurante_id = ? 
        AND p.disponible = 1
    `, [restaurantId]);

    // Agrupar productos por nombre de categoría
    const productsByCategory = products.reduce((acc, product) => {
      const categoryName = product.categoria_nombre || 'Sin Categoría';
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(product);
      return acc;
    }, {});
    
    // Crear una lista ordenada de categorías que tienen productos
    const orderedCategoryNames = Object.keys(productsByCategory)
      .map(name => {
        const representative = productsByCategory[name][0];
        // Los productos sin categoría van al final
        const order = (name === 'Sin Categoría' || representative.categoria_orden === null) 
                      ? 999 
                      : representative.categoria_orden;
        const displayName = (name === 'Sin Categoría') ? name : representative.categoria_nombre;
        return { name: displayName, order };
      })
      .sort((a, b) => a.order - b.order)
      .map(c => c.name);

    // Reconstruir el objeto `productsByCategory` en el orden correcto
    const orderedProductsByCategory = {};
    orderedCategoryNames.forEach(name => {
      orderedProductsByCategory[name] = productsByCategory[name];
    });
    
    // Get recent reviews
    const [reviews] = await db.execute(`
      SELECT c.*, u.nombre, u.apellido, u.imagen_perfil
      FROM calificaciones c
      JOIN usuarios u ON c.cliente_id = u.id
      WHERE c.restaurante_id = ? AND c.resena_dejada = TRUE
      ORDER BY c.fecha_resena DESC
      LIMIT 5
    `, [restaurantId]);
    
    res.render('restaurants/detail', {
      title: `${restaurant.nombre} - A la Mesa`,
      restaurant,
      productsByCategory: orderedProductsByCategory,
      reviews,
      scripts: ['/js/restaurant-detail.js'],
      user: req.session.user
    });
  } catch (error) {
    console.error('Error cargando restaurante:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el restaurante',
      error: {},
      user: req.session.user
    });
  }
});

module.exports = router;
