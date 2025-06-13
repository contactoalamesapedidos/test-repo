const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Restaurants list
router.get('/', async (req, res) => {
  try {
    const { category, search, sort } = req.query;
    
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
        GROUP_CONCAT(DISTINCT cr.nombre) as categorias,
        COUNT(DISTINCT p.id) as total_productos
      FROM restaurantes r
      LEFT JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
      LEFT JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
      LEFT JOIN productos p ON r.id = p.restaurante_id AND p.disponible = 1
      WHERE r.activo = 1 AND r.verificado = 1
    `;
    
    const params = [];
    
    if (search) {
      sql += ` AND (r.nombre LIKE ? OR r.descripcion LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (category) {
      sql += ` AND cr.nombre = ?`;
      params.push(category);
    }
    
    sql += ` GROUP BY 
      r.id, r.nombre, r.descripcion, r.imagen_logo, r.imagen_banner,
      r.direccion, r.ciudad, r.telefono, r.email_contacto,
      r.horario_apertura, r.horario_cierre, r.tiempo_entrega_min,
      r.tiempo_entrega_max, r.costo_delivery, r.calificacion_promedio,
      r.total_calificaciones`;
    
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
    
    console.log('Ejecutando consulta de restaurantes con filtros:', { category, search, sort });
    const [restaurants] = await db.execute(sql, params);
    console.log('Restaurantes encontrados:', restaurants.length);
    
    // Get categories for filter
    const [categories] = await db.execute(`
      SELECT * FROM categorias_restaurantes 
      WHERE activa = 1 
      ORDER BY nombre ASC
    `);
    console.log('Categorías disponibles:', categories.length);

    res.render('restaurants/list', {
      title: 'Restaurantes - A la Mesa',
      restaurants,
      categories,
      currentCategory: category || '',
      currentSearch: search || '',
      currentSort: sort || 'rating'
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
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Restaurant detail
router.get('/:id', async (req, res) => {
  try {
    const restaurantId = req.params.id;
    
    // Get restaurant info
    const [restaurants] = await db.execute(`
      SELECT r.*, u.nombre as owner_nombre, u.apellido as owner_apellido
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ? AND r.activo = 1
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
    const now = new Date();
    const currentDay = now.getDay() || 7; // Convertir 0 (Domingo) a 7
    
    // Si dias_operacion es null, asumimos que opera todos los días
    let diasOperacion;
    try {
        diasOperacion = restaurant.dias_operacion ? JSON.parse(restaurant.dias_operacion) : [1,2,3,4,5,6,7];
    } catch (e) {
        console.error('Error parseando dias_operacion:', e);
        diasOperacion = [1,2,3,4,5,6,7]; // Por defecto, todos los días
    }
    
    const estaAbiertoHoy = diasOperacion.includes(currentDay);
    
    console.log('Validación de horarios (restaurante):', {
        horaActual: now.toLocaleTimeString(),
        diaActual: currentDay,
        diasOperacion,
        estaAbiertoHoy,
        horarioApertura: restaurant.horario_apertura,
        horarioCierre: restaurant.horario_cierre,
        activo: restaurant.activo,
        verificado: restaurant.verificado,
        diasOperacionOriginal: restaurant.dias_operacion
    });
    
    // Crear objetos Date para las horas de apertura y cierre usando la hora actual
    const [aperturaHora, aperturaMinuto] = restaurant.horario_apertura.split(':');
    const [cierreHora, cierreMinuto] = restaurant.horario_cierre.split(':');
    
    const apertura = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                             parseInt(aperturaHora), parseInt(aperturaMinuto));
    const cierre = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                           parseInt(cierreHora), parseInt(cierreMinuto));
    
    // Si la hora de cierre es menor que la de apertura, significa que cierra al día siguiente
    if (cierre < apertura) {
        cierre.setDate(cierre.getDate() + 1);
    }
    
    const abierto = estaAbiertoHoy && now >= apertura && now <= cierre;

    console.log('Resultado de validación (restaurante):', {
        horaApertura: apertura.toLocaleTimeString(),
        horaCierre: cierre.toLocaleTimeString(),
        esDespuesDeApertura: now >= apertura,
        esAntesDeCierre: now <= cierre,
        abierto,
        horaActual: now.toLocaleTimeString()
    });
    
    // Get restaurant categories
    const [categories] = await db.execute(`
      SELECT cp.*, COUNT(p.id) as productos_count
      FROM categorias_productos cp
      LEFT JOIN productos p ON cp.id = p.categoria_id AND p.disponible = 1
      WHERE cp.restaurante_id = ? AND cp.activa = 1
      GROUP BY cp.id
      HAVING productos_count > 0
      ORDER BY cp.orden_display ASC, cp.nombre ASC
    `, [restaurantId]);
    
    // Get products by category
    const [products] = await db.execute(`
      SELECT p.*, cp.nombre as categoria_nombre
      FROM productos p
      JOIN categorias_productos cp ON p.categoria_id = cp.id
      WHERE p.restaurante_id = ? AND p.disponible = 1 AND cp.activa = 1
      ORDER BY cp.orden_display ASC, p.destacado DESC, p.nombre ASC
    `, [restaurantId]);
    
    // Get recent reviews
    const [reviews] = await db.execute(`
      SELECT c.*, u.nombre, u.apellido, u.imagen_perfil
      FROM calificaciones c
      JOIN usuarios u ON c.cliente_id = u.id
      WHERE c.restaurante_id = ?
      ORDER BY c.fecha_calificacion DESC
      LIMIT 5
    `, [restaurantId]);
    
    // Group products by category
    const productsByCategory = {};
    categories.forEach(category => {
      productsByCategory[category.nombre] = products.filter(p => p.categoria_id === category.id);
    });

    res.render('restaurants/detail', {
      title: `${restaurant.nombre} - A la Mesa`,
      restaurant,
      categories,
      productsByCategory,
      reviews,
      scripts: ['/js/restaurant-detail.js']
    });
  } catch (error) {
    console.error('Error cargando restaurante:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el restaurante',
      error: {}
    });
  }
});

module.exports = router;
