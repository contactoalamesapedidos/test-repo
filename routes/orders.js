const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware to check if user is logged in
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
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
      SELECT * FROM restaurantes WHERE id = ?
    `, [restaurantId]);

    if (restaurants.length === 0) {
      return res.redirect('/cart');
    }

    const restaurant = restaurants[0];
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = parseFloat(restaurant.costo_delivery) || 350;
    const total = subtotal + deliveryFee;
    
    res.render('orders/checkout', {
      title: 'Finalizar Pedido - A la Mesa',
      cart,
      restaurant,
      subtotal,
      deliveryFee,
      total,
      scripts: ['/js/checkout.js']
    });
  } catch (error) {
    console.error('Error cargando checkout:', error);
    res.redirect('/cart');
  }
});

// Process order
router.post('/create', requireAuth, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const cart = req.session.cart || [];
    
    if (cart.length === 0) {
      return res.json({
        success: false,
        message: 'El carrito está vacío'
      });
    }
    
    const {
      direccion,
      ciudad,
      codigo_postal,
      instrucciones,
      metodo_pago,
      telefono_entrega
    } = req.body;
    
    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = 350;
    const total = subtotal + deliveryFee;
    
    // Get restaurant ID from cart
    const restaurantId = cart[0].restaurante_id;
    
    await connection.beginTransaction();
    
    // Generate order number
    const orderNumber = `ALM-${Date.now()}`;
    
    // Create order
    const [orderResult] = await connection.execute(`
      INSERT INTO pedidos (
        numero_pedido, cliente_id, restaurante_id, direccion_entrega,
        subtotal, costo_delivery, total, estado, metodo_pago, notas_especiales
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)
    `, [
      orderNumber,
      req.session.user.id,
      restaurantId,
      `${direccion}, ${ciudad} ${codigo_postal}`,
      subtotal,
      deliveryFee,
      total,
      metodo_pago,
      instrucciones || null
    ]);
    
    const orderId = orderResult.insertId;
    
    // Create order items
    for (const item of cart) {
      await connection.execute(`
        INSERT INTO items_pedido (
          pedido_id, producto_id, cantidad, precio_unitario, subtotal, notas_especiales
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        item.productId,
        item.quantity,
        item.price,
        item.price * item.quantity,
        item.specialInstructions || null
      ]);
    }
    
    await connection.commit();
    
    // Clear cart
    req.session.cart = [];
    req.session.cartTotal = 0;
    req.session.cartCount = 0;
    
    // Emit socket event for restaurant
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant-${restaurantId}`).emit('new-order-notification', {
        orderId: orderId,
        orderNumber: orderNumber,
        restaurantId: restaurantId,
        total: total
      });
    }
    
    res.json({
      success: true,
      message: 'Pedido creado exitosamente',
      orderId: orderId,
      orderNumber: orderNumber
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error creando pedido:', error);
    res.json({
      success: false,
      message: 'Error creando el pedido'
    });
  } finally {
    connection.release();
  }
});

// Order history
router.get('/', requireAuth, async (req, res) => {
  try {
    const [orders] = await db.execute(`
      SELECT p.*, r.nombre as restaurante_nombre, r.imagen_logo,
             COUNT(ip.id) as total_items
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN items_pedido ip ON p.id = ip.pedido_id
      WHERE p.cliente_id = ?
      GROUP BY p.id
      ORDER BY p.fecha_pedido DESC
    `, [req.session.user.id]);
    
    res.render('orders/history', {
      title: 'Mis Pedidos - A la Mesa',
      orders,
      scripts: ['/js/orders.js']
    });
    
  } catch (error) {
    console.error('Error cargando pedidos:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el historial de pedidos',
      error: {}
    });
  }
});

// Order detail
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log('Buscando pedido:', orderId);
    
    // Get order info
    const [orders] = await db.execute(`
      SELECT p.*, r.nombre as restaurante_nombre, r.telefono as restaurante_telefono,
             r.direccion as restaurante_direccion, r.imagen_logo as restaurante_logo,
             u.nombre as repartidor_nombre, u.telefono as repartidor_telefono
      FROM pedidos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      LEFT JOIN usuarios u ON p.repartidor_id = u.id
      WHERE p.id = ? AND p.cliente_id = ?
    `, [orderId, req.session.user.id]);
    
    console.log('Pedido encontrado:', orders[0] || 'No encontrado');
    
    if (orders.length === 0) {
      return res.status(404).render('error', {
        title: 'Pedido No Encontrado',
        message: 'El pedido que buscas no existe',
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
    
    console.log('Items del pedido:', items);
    
    // Get restaurant info
    const [restaurants] = await db.execute(`
      SELECT * FROM restaurantes WHERE id = ?
    `, [order.restaurante_id]);
    
    console.log('Restaurante encontrado:', restaurants[0] || 'No encontrado');
    
    if (restaurants.length === 0) {
      return res.status(404).render('error', {
        title: 'Error',
        message: 'No se encontró la información del restaurante',
        error: {}
      });
    }
    
    const restaurant = restaurants[0];
    
    // Preparar los datos para la vista
    const viewData = {
      title: `Pedido #${order.numero_pedido} - A la Mesa`,
      order,
      items,
      restaurant,
      scripts: ['/js/order-detail.js']
    };
    
    console.log('Datos enviados a la vista:', {
      orderId: order.id,
      restaurantId: restaurant.id,
      itemsCount: items.length
    });
    
    res.render('orders/detail', viewData);
    
  } catch (error) {
    console.error('Error cargando pedido:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el detalle del pedido',
      error: {}
    });
  }
});

// Cancel order
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
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

module.exports = router;
