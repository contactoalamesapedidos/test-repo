const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Initialize cart if not exists
function initCart(req) {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  return req.session.cart;
}

// Update cart totals
function updateCartTotals(req) {
  const cart = req.session.cart || [];
  let subtotal = 0;
  let count = 0;
  
  cart.forEach(item => {
    subtotal += item.price * item.quantity;
    count += item.quantity;
  });
  
  req.session.cartTotal = subtotal;
  req.session.cartCount = count;
  
  return { subtotal, count };
}

// Add to cart
router.post('/add', async (req, res) => {
  try {
    const { productId, quantity = 1, specialInstructions = '' } = req.body;
    console.log('Intentando agregar al carrito:', { productId, quantity, specialInstructions });
    
    // Get product info
    const [products] = await db.execute(`
      SELECT p.*, r.nombre as restaurante_nombre, r.id as restaurante_id, 
             r.horario_apertura, r.horario_cierre, r.dias_operacion,
             r.activo, r.verificado
      FROM productos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      WHERE p.id = ? AND p.disponible = 1 AND r.activo = 1 AND r.verificado = 1
    `, [productId]);
    
    console.log('Producto encontrado:', products[0] || 'No encontrado');
    
    if (products.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Producto no encontrado o no disponible' 
      });
    }
    
    const product = products[0];

    // Verificar que el restaurante esté activo y verificado
    if (!product.activo || !product.verificado) {
      console.log('Restaurante no disponible:', { activo: product.activo, verificado: product.verificado });
      return res.json({
        success: false,
        message: 'El restaurante no está disponible en este momento'
      });
    }

    // Calcular si el restaurante está abierto
    const now = new Date();
    const currentDay = now.getDay() || 7; // Convertir 0 (Domingo) a 7
    
    // Si dias_operacion es null, asumimos que opera todos los días
    let diasOperacion;
    try {
        diasOperacion = product.dias_operacion ? JSON.parse(product.dias_operacion) : [1,2,3,4,5,6,7];
    } catch (e) {
        console.error('Error parseando dias_operacion:', e);
        diasOperacion = [1,2,3,4,5,6,7]; // Por defecto, todos los días
    }
    
    const estaAbiertoHoy = diasOperacion.includes(currentDay);
    console.log('Estado del restaurante:', { 
      currentDay, 
      diasOperacion, 
      estaAbiertoHoy,
      horario_apertura: product.horario_apertura,
      horario_cierre: product.horario_cierre
    });
    
    // Crear objetos Date para las horas de apertura y cierre usando la hora actual
    const [aperturaHora, aperturaMinuto] = product.horario_apertura.split(':');
    const [cierreHora, cierreMinuto] = product.horario_cierre.split(':');
    
    const apertura = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                             parseInt(aperturaHora), parseInt(aperturaMinuto));
    const cierre = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                           parseInt(cierreHora), parseInt(cierreMinuto));
    
    // Si la hora de cierre es menor que la de apertura, significa que cierra al día siguiente
    if (cierre < apertura) {
        cierre.setDate(cierre.getDate() + 1);
    }
    
    const abierto = estaAbiertoHoy && now >= apertura && now <= cierre;
    console.log('Horarios:', { 
      ahora: now.toLocaleTimeString(),
      apertura: apertura.toLocaleTimeString(),
      cierre: cierre.toLocaleTimeString(),
      abierto
    });

    // Verificar si el restaurante está abierto
    if (!abierto) {
      return res.json({
        success: false,
        message: 'El restaurante está cerrado en este momento'
      });
    }
    
    const cart = initCart(req);
    console.log('Carrito actual:', cart);
    
    // Check if cart has products from different restaurant
    if (cart.length > 0 && cart[0].restaurante_id !== product.restaurante_id) {
      console.log('Intento de agregar producto de otro restaurante:', {
        carrito_actual: cart[0].restaurante_id,
        nuevo_producto: product.restaurante_id
      });
      return res.json({
        success: false,
        message: 'Solo puedes agregar productos del mismo restaurante',
        needsClearCart: true,
        newRestaurant: product.restaurante_nombre
      });
    }
    
    // Check if product already in cart
    const existingItemIndex = cart.findIndex(item => 
      item.productId === parseInt(productId) && 
      item.specialInstructions === specialInstructions
    );
    
    if (existingItemIndex >= 0) {
      // Update quantity
      cart[existingItemIndex].quantity += parseInt(quantity);
      console.log('Actualizando cantidad de producto existente:', cart[existingItemIndex]);
    } else {
      // Add new item
      const newItem = {
        productId: parseInt(productId),
        name: product.nombre,
        price: parseFloat(product.precio),
        quantity: parseInt(quantity),
        specialInstructions,
        restaurante_id: product.restaurante_id,
        restaurante_nombre: product.restaurante_nombre,
        imagen: product.imagen
      };
      cart.push(newItem);
      console.log('Agregando nuevo producto al carrito:', newItem);
    }
    
    const totals = updateCartTotals(req);
    console.log('Totales actualizados:', totals);
    
    res.json({
      success: true,
      message: 'Producto agregado al carrito',
      cartCount: totals.count,
      cartTotal: totals.subtotal
    });
    
  } catch (error) {
    console.error('Error agregando al carrito:', error);
    res.json({ 
      success: false, 
      message: 'Error agregando producto al carrito' 
    });
  }
});

// Clear cart
router.post('/clear', (req, res) => {
  req.session.cart = [];
  updateCartTotals(req);
  
  res.json({
    success: true,
    message: 'Carrito limpiado'
  });
});

// Update item quantity
router.post('/update', (req, res) => {
  try {
    const { productId, change } = req.body;
    const cart = req.session.cart || [];
    
    const itemIndex = cart.findIndex(item => item.productId === parseInt(productId));
    
    if (itemIndex >= 0) {
      const newQuantity = cart[itemIndex].quantity + parseInt(change);
      
      if (newQuantity <= 0) {
        // Remove item if quantity would be 0 or negative
        cart.splice(itemIndex, 1);
      } else {
        // Update quantity
        cart[itemIndex].quantity = newQuantity;
      }
      
      const totals = updateCartTotals(req);
      
      res.json({
        success: true,
        cart: cart,
        cartCount: totals.count,
        cartTotal: totals.subtotal
      });
    } else {
      res.json({
        success: false,
        message: 'Producto no encontrado en el carrito'
      });
    }
    
  } catch (error) {
    console.error('Error actualizando carrito:', error);
    res.json({
      success: false,
      message: 'Error actualizando el carrito'
    });
  }
});

// Remove item
router.post('/remove', (req, res) => {
  try {
    const { productId } = req.body;
    const cart = req.session.cart || [];
    
    const itemIndex = cart.findIndex(item => item.productId === parseInt(productId));
    
    if (itemIndex >= 0) {
      cart.splice(itemIndex, 1);
      const totals = updateCartTotals(req);
      
      res.json({
        success: true,
        message: 'Producto eliminado del carrito',
        cartCount: totals.count,
        cartTotal: totals.subtotal
      });
    } else {
      res.json({
        success: false,
        message: 'Producto no encontrado en el carrito'
      });
    }
    
  } catch (error) {
    console.error('Error eliminando del carrito:', error);
    res.json({
      success: false,
      message: 'Error eliminando producto del carrito'
    });
  }
});

// View cart
router.get('/', async (req, res) => {
  const cart = req.session.cart || [];
  const totals = updateCartTotals(req);
  
  let deliveryFee = 0;
  if (cart.length > 0) {
    // Obtener el costo de envío del restaurante
    const [restaurants] = await db.execute(`
      SELECT costo_delivery FROM restaurantes WHERE id = ?
    `, [cart[0].restaurante_id]);
    
    if (restaurants.length > 0) {
      deliveryFee = parseFloat(restaurants[0].costo_delivery) || 0;
    }
  }
  
  res.render('cart/index', {
    title: 'Carrito de Compras - A la Mesa',
    cart,
    subtotal: totals.subtotal,
    deliveryFee,
    total: totals.subtotal + deliveryFee,
    scripts: ['/js/cart.js']
  });
});

// Get cart data
router.get('/data', async (req, res) => {
  try {
    const cart = req.session.cart || [];
    const totals = updateCartTotals(req);
    
    let deliveryFee = 0;
    if (cart.length > 0) {
      // Obtener el costo de envío del restaurante
      const [restaurants] = await db.execute(`
        SELECT costo_delivery FROM restaurantes WHERE id = ?
      `, [cart[0].restaurante_id]);
      
      if (restaurants.length > 0) {
        deliveryFee = parseFloat(restaurants[0].costo_delivery) || 0;
      }
    }
    
    res.json({
      success: true,
      cart: cart,
      cartCount: totals.count,
      subtotal: totals.subtotal,
      deliveryFee: deliveryFee,
      total: totals.subtotal + deliveryFee
    });
  } catch (error) {
    console.error('Error obteniendo datos del carrito:', error);
    res.json({
      success: false,
      message: 'Error obteniendo datos del carrito'
    });
  }
});

module.exports = router;
