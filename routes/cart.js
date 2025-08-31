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
async function updateCartTotals(req) {
  const cart = req.session.cart || [];
  let subtotal = 0;
  let count = 0;
  let deliveryFee = 0;
  
  cart.forEach(item => {
      // Usar item.price si existe, sino item.precio para compatibilidad
      const price = parseFloat(item.price) || 0;
      subtotal += price * (item.quantity || 0);
      count += item.quantity || 0;
  });
  
  // Redondear el subtotal a 2 decimales
  req.session.cartTotal = parseFloat(subtotal.toFixed(2));
  req.session.cartCount = count;
  
  // Obtener el costo de envío si hay productos en el carrito
  if (cart.length > 0) {
    const [restaurants] = await db.execute(`
      SELECT costo_delivery 
      FROM restaurantes 
      WHERE id = ?
    `, [cart[0].restaurante_id]);
    
    if (restaurants.length > 0) {
      deliveryFee = parseFloat(restaurants[0].costo_delivery) || 0;
    }
  }
  
  return { 
    subtotal: parseFloat(subtotal.toFixed(2)), 
    count,
    deliveryFee
  };
}

// Get cart data
router.get('/data', async (req, res) => {
  try {
    const cart = req.session.cart || [];
    const totals = await updateCartTotals(req);
    
    res.json({
      cart,
      subtotal: totals.subtotal,
      cartCount: totals.count,
      deliveryFee: totals.deliveryFee,
      total: totals.subtotal + totals.deliveryFee
    });
  } catch (error) {
    console.error('Error obteniendo datos del carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo datos del carrito'
    });
  }
});

// Get cart data for sidebar
router.get('/sidebar', async (req, res) => {
  try {
    const cart = req.session.cart || [];
    const totals = await updateCartTotals(req);
    
    res.json({
      cart,
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      total: totals.subtotal + totals.deliveryFee
    });
  } catch (error) {
    console.error('Error obteniendo datos del carrito:', error);
    res.status(500).json({
      error: 'Error obteniendo datos del carrito'
    });
  }
});

// Clear cart
router.post('/clear', async (req, res) => {
  try {
    req.session.cart = [];
    await updateCartTotals(req);
    req.session.save(() => {
      res.json({
        success: true,
        message: 'Carrito limpiado'
      });
    });
  } catch (error) {
    console.error('Error al limpiar el carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar el carrito'
    });
  }
});

// Update item quantity
router.post('/update', async (req, res) => {
  try {
    const { productId, change } = req.body;
    if (!productId || !change) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan datos requeridos' 
      });
    }
    
    const cart = req.session.cart || [];
    const item = cart.find(item => item.producto_id === parseInt(productId));
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: 'Producto no encontrado en el carrito' 
      });
    }

    // Actualizar la cantidad del producto
    const newQuantity = parseInt(item.quantity || 0) + parseInt(change);
    let finalQuantity = 0;
    let newPrice = 0;
    
    if (newQuantity <= 0) {
      cart.splice(cart.indexOf(item), 1);
    } else {
      item.quantity = newQuantity;
      finalQuantity = newQuantity;
      newPrice = (parseFloat(item.price) || parseFloat(item.precio) || 0) * finalQuantity;
    }
    
    // Actualizar totales y guardar sesión
    const totals = await updateCartTotals(req);
    
    req.session.save(() => {
      res.json({
        success: true,
        message: 'Producto actualizado',
        cart: cart,
        cartCount: totals.count,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        total: totals.subtotal + totals.deliveryFee,
        newQuantity: finalQuantity,
        newPrice: newPrice
      });
    });
  } catch (error) {
    console.error('Error actualizando carrito:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al actualizar el carrito' 
    });
  }
});

// Add to cart
router.post('/add', async (req, res) => {
  try {
    const { productId, quantity = 1, specialInstructions = '' } = req.body;
    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de producto requerido' 
      });
    }

    // Obtener información del producto y restaurante
    const [products] = await db.execute(`
      SELECT p.*, p.precio_descuento, r.nombre as restaurante_nombre, r.id as restaurante_id, 
             r.horario_apertura, r.horario_cierre, r.dias_operacion,
             r.activo, r.verificado
      FROM productos p
      JOIN restaurantes r ON p.restaurante_id = r.id
      WHERE p.id = ? AND p.disponible = 1 AND r.activo = 1 AND r.verificado = 1
    `, [productId]);

    if (products.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Producto no encontrado o no disponible' 
      });
    }

    const product = products[0];
    const now = new Date();
    const currentDay = now.getDay() || 7;

    // Validar horario y disponibilidad
    let diasOperacion;
    try {
      if (typeof product.dias_operacion === 'string') {
        diasOperacion = JSON.parse(product.dias_operacion.trim());
      } else if (Array.isArray(product.dias_operacion)) {
        diasOperacion = product.dias_operacion;
      } else {
        diasOperacion = [1,2,3,4,5,6,7];
      }
    } catch (e) {
      diasOperacion = [1,2,3,4,5,6,7];
    }

    const estaAbiertoHoy = diasOperacion.includes(currentDay);
    const [aperturaHora, aperturaMinuto] = product.horario_apertura.split(':');
    const [cierreHora, cierreMinuto] = product.horario_cierre.split(':');
    const apertura = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                             parseInt(aperturaHora), parseInt(aperturaMinuto));
    const cierre = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                           parseInt(cierreHora), parseInt(cierreMinuto));
    
    if (cierre < apertura) {
      cierre.setDate(cierre.getDate() + 1);
    }
    
    const abierto = estaAbiertoHoy && now >= apertura && now <= cierre;
    if (!abierto) {
      return res.status(400).json({
        success: false,
        message: 'El restaurante está cerrado en este momento'
      });
    }

    // Inicializar carrito si no existe
    const cart = initCart(req);
    
    // Validar que todos los productos sean del mismo restaurante
    if (cart.length > 0 && cart[0].restaurante_id !== product.restaurante_id) {
      return res.status(400).json({
        success: false,
        message: 'Solo puedes agregar productos del mismo restaurante',
        needsClearCart: true,
        newRestaurant: product.restaurante_nombre
      });
    }

    // Actualizar o agregar producto
    const existingItemIndex = cart.findIndex(item => 
      item.producto_id === parseInt(productId) && 
      item.specialInstructions === specialInstructions
    );

    if (existingItemIndex >= 0) {
      cart[existingItemIndex].quantity += parseInt(quantity);
    } else {
      const price = product.precio_descuento && parseFloat(product.precio_descuento) < parseFloat(product.precio)
        ? parseFloat(product.precio_descuento)
        : parseFloat(product.precio);

      cart.push({
        producto_id: parseInt(productId),
        name: product.nombre,
        price: price,
        quantity: parseInt(quantity),
        specialInstructions,
        restaurante_id: product.restaurante_id,
        restaurante_nombre: product.restaurante_nombre,
        imagen: product.imagen || ''
      });
    }

    // Actualizar totales y guardar sesión
    const totals = await updateCartTotals(req);
    req.session.save(() => {
      res.json({
        success: true,
        message: 'Producto agregado al carrito',
        cart: cart,
        cartCount: totals.count,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        total: totals.subtotal + totals.deliveryFee
      });
    });
  } catch (error) {
    console.error('Error en /cart/add:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar al carrito'
    });
  }
});

// Remove item
router.post('/remove', async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'ID de producto requerido'
      });
    }

    const cart = req.session.cart || [];
    const itemIndex = cart.findIndex(item => item.producto_id === parseInt(productId));
    if (itemIndex >= 0) {
      cart.splice(itemIndex, 1);
      const totals = await updateCartTotals(req);
      req.session.save(() => {
        res.json({
          success: true,
          message: 'Producto eliminado del carrito',
          cartCount: totals.count,
          cartTotal: totals.subtotal,
          deliveryFee: totals.deliveryFee,
          total: totals.subtotal + totals.deliveryFee
        });
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Producto no encontrado en el carrito'
      });
    }
  } catch (error) {
    console.error('Error eliminando del carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando producto del carrito'
    });
  }
});

// Get cart data
router.get('/data', async (req, res) => {
  try {
    const cart = req.session.cart || [];
    const totals = await updateCartTotals(req);
    
    res.json({
      cart,
      subtotal: totals.subtotal,
      cartCount: totals.count,
      deliveryFee: totals.deliveryFee,
      total: totals.subtotal + totals.deliveryFee
    });
  } catch (error) {
    console.error('Error obteniendo datos del carrito:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo datos del carrito'
    });
  }
});

// Render cart page
router.get('/', async (req, res) => {
  try {
    const cart = req.session.cart || [];
    const totals = await updateCartTotals(req);
    
    res.render('cart/index', {
      title: 'Mi Carrito - A la Mesa',
      cart,
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      total: totals.subtotal + totals.deliveryFee,
      user: req.session.user
    });
    
  } catch (error) {
    console.error('Error cargando carrito:', error);
    res.render('error', {
      title: 'Error',
      message: 'Error cargando el carrito',
      error: {},
      user: req.session.user
    });
  }
});

module.exports = router;
