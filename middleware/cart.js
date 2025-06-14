const db = require('../config/database');

module.exports = (db) => {
    return async function cartMiddleware(req, res, next) {
    // Inicializar el carrito si no existe
    if (!req.session.cart) {
        req.session.cart = [];
    }

    // Calcular el total de items en el carrito
    const cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);

    // Obtener información adicional de los productos en el carrito
    const cartItems = req.session.cart.map(item => {
        // Asegurarse de que la imagen tenga la ruta correcta
        let imagePath = item.imagen;
        if (imagePath) {
            // Si la imagen ya comienza con /uploads/, no agregar el prefijo
            if (!imagePath.startsWith('/uploads/')) {
                imagePath = `/uploads/${imagePath}`;
            }
        } else {
            imagePath = '/images/no-image.png';
        }

        return {
            ...item,
            imagen: imagePath
        };
    });

    // Hacer el carrito disponible en todas las vistas
    res.locals.cart = cartItems;
    res.locals.cartCount = cartCount;

    let deliveryFee = 0;
    // Asegurarse de que deliveryFee siempre esté definido
    res.locals.deliveryFee = deliveryFee;

    if (cartItems.length > 0) {
        try {
            const [restaurants] = await db.execute(
                'SELECT costo_delivery FROM restaurantes WHERE id = ?',
                [cartItems[0].restaurante_id]
            );
            if (restaurants.length > 0) {
                deliveryFee = parseFloat(restaurants[0].costo_delivery);
            }
        } catch (error) {
            console.error('Error al obtener costo_delivery en cartMiddleware:', error);
        }
    }
    res.locals.deliveryFee = deliveryFee;

    next();
}

    };