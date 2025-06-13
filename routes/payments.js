const express = require('express');
const router = express.Router();
const mercadopago = require('mercadopago');
const db = require('../config/database');

// Configure MercadoPago
mercadopago.configure({
    access_token: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-YOUR-ACCESS-TOKEN',
});

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Debes estar logueado para realizar un pago'
        });
    }
    next();
};

// Create payment preference
router.post('/create-preference', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.session.user.id;

        // Get order details
        const [orders] = await db.execute(`
            SELECT o.*, r.nombre as restaurante_nombre 
            FROM pedidos o
            JOIN restaurantes r ON o.restaurante_id = r.id
            WHERE o.id = ? AND o.cliente_id = ?
        `, [orderId, userId]);

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }

        const order = orders[0];

        // Get order items
        const [items] = await db.execute(`
            SELECT pi.*, p.nombre, p.descripcion, p.imagen
            FROM pedido_items pi
            JOIN productos p ON pi.producto_id = p.id
            WHERE pi.pedido_id = ?
        `, [orderId]);

        // Create preference items for MercadoPago
        const preferenceItems = items.map(item => ({
            title: item.nombre,
            unit_price: parseFloat(item.precio_unitario),
            quantity: item.cantidad,
            description: item.descripcion || '',
            picture_url: item.imagen ? `${req.protocol}://${req.get('host')}/uploads/${item.imagen}` : null,
            category_id: 'food',
            currency_id: 'ARS'
        }));

        // Add delivery cost if exists
        if (order.costo_envio > 0) {
            preferenceItems.push({
                title: 'Costo de envío',
                unit_price: parseFloat(order.costo_envio),
                quantity: 1,
                category_id: 'delivery',
                currency_id: 'ARS'
            });
        }

        const preference = {
            items: preferenceItems,
            payer: {
                name: req.session.user.nombre,
                surname: req.session.user.apellido,
                email: req.session.user.email,
                phone: {
                    area_code: '',
                    number: req.session.user.telefono || ''
                },
                identification: {
                    type: 'DNI',
                    number: ''
                }
            },
            payment_methods: {
                excluded_payment_methods: [],
                excluded_payment_types: [],
                installments: 12
            },
            back_urls: {
                success: `${req.protocol}://${req.get('host')}/payments/success`,
                failure: `${req.protocol}://${req.get('host')}/payments/failure`,
                pending: `${req.protocol}://${req.get('host')}/payments/pending`
            },
            auto_return: 'approved',
            external_reference: orderId.toString(),
            notification_url: `${req.protocol}://${req.get('host')}/payments/webhook`,
            statement_descriptor: 'A LA MESA',
            metadata: {
                order_id: orderId,
                user_id: userId,
                restaurant_id: order.restaurante_id
            }
        };

        const response = await mercadopago.preferences.create(preference);

        // Save payment preference
        await db.execute(`
            UPDATE pedidos 
            SET mp_preference_id = ?, estado_pago = 'pending'
            WHERE id = ?
        `, [response.body.id, orderId]);

        res.json({
            success: true,
            preferenceId: response.body.id,
            initPoint: response.body.init_point,
            sandboxInitPoint: response.body.sandbox_init_point
        });

    } catch (error) {
        console.error('Error creating payment preference:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando preferencia de pago',
            error: error.message
        });
    }
});

// Payment success page
router.get('/success', async (req, res) => {
    try {
        const { collection_id, collection_status, payment_id, status, external_reference } = req.query;
        
        if (external_reference) {
            // Update order status
            await db.execute(`
                UPDATE pedidos 
                SET estado_pago = ?, mp_payment_id = ?, fecha_pago = NOW()
                WHERE id = ?
            `, [collection_status || status, payment_id || collection_id, external_reference]);
        }

        res.render('payments/success', {
            title: 'Pago Exitoso - A la Mesa',
            paymentId: payment_id || collection_id,
            orderId: external_reference,
            status: collection_status || status
        });
    } catch (error) {
        console.error('Error in payment success:', error);
        res.render('payments/success', {
            title: 'Pago Exitoso - A la Mesa',
            paymentId: null,
            orderId: null,
            status: 'approved'
        });
    }
});

// Payment failure page
router.get('/failure', async (req, res) => {
    try {
        const { collection_id, collection_status, payment_id, status, external_reference } = req.query;
        
        if (external_reference) {
            // Update order status
            await db.execute(`
                UPDATE pedidos 
                SET estado_pago = ?
                WHERE id = ?
            `, [collection_status || status || 'failed', external_reference]);
        }

        res.render('payments/failure', {
            title: 'Error en el Pago - A la Mesa',
            paymentId: payment_id || collection_id,
            orderId: external_reference,
            status: collection_status || status
        });
    } catch (error) {
        console.error('Error in payment failure:', error);
        res.render('payments/failure', {
            title: 'Error en el Pago - A la Mesa',
            paymentId: null,
            orderId: null,
            status: 'failed'
        });
    }
});

// Payment pending page
router.get('/pending', async (req, res) => {
    try {
        const { collection_id, collection_status, payment_id, status, external_reference } = req.query;
        
        if (external_reference) {
            // Update order status
            await db.execute(`
                UPDATE pedidos 
                SET estado_pago = ?
                WHERE id = ?
            `, [collection_status || status || 'pending', external_reference]);
        }

        res.render('payments/pending', {
            title: 'Pago Pendiente - A la Mesa',
            paymentId: payment_id || collection_id,
            orderId: external_reference,
            status: collection_status || status
        });
    } catch (error) {
        console.error('Error in payment pending:', error);
        res.render('payments/pending', {
            title: 'Pago Pendiente - A la Mesa',
            paymentId: null,
            orderId: null,
            status: 'pending'
        });
    }
});

// Webhook for payment notifications
router.post('/webhook', async (req, res) => {
    try {
        const { type, data } = req.body;
        
        if (type === 'payment') {
            const paymentId = data.id;
            
            // Get payment information from MercadoPago
            const payment = await mercadopago.payment.findById(paymentId);
            
            if (payment.body) {
                const paymentInfo = payment.body;
                const orderId = paymentInfo.external_reference;
                
                // Update order in database
                await db.execute(`
                    UPDATE pedidos 
                    SET estado_pago = ?, mp_payment_id = ?, fecha_pago = NOW(),
                        mp_status = ?, mp_status_detail = ?
                    WHERE id = ?
                `, [
                    paymentInfo.status,
                    paymentInfo.id,
                    paymentInfo.status,
                    paymentInfo.status_detail,
                    orderId
                ]);

                // If payment is approved, update order status
                if (paymentInfo.status === 'approved') {
                    await db.execute(`
                        UPDATE pedidos 
                        SET estado = 'confirmed'
                        WHERE id = ? AND estado = 'pending'
                    `, [orderId]);
                    
                    // Notify restaurant via socket
                    if (req.app.locals.io) {
                        const [orderDetails] = await db.execute(`
                            SELECT * FROM pedidos WHERE id = ?
                        `, [orderId]);
                        
                        if (orderDetails.length > 0) {
                            req.app.locals.io.to(`restaurant-${orderDetails[0].restaurante_id}`)
                                .emit('new-order-notification', {
                                    orderId: orderId,
                                    message: 'Nuevo pedido confirmado con pago aprobado'
                                });
                        }
                    }
                }
            }
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error in payment webhook:', error);
        res.status(500).send('Error');
    }
});

// Get payment status
router.get('/status/:orderId', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user.id;

        const [orders] = await db.execute(`
            SELECT estado_pago, mp_payment_id, mp_status, mp_status_detail
            FROM pedidos 
            WHERE id = ? AND cliente_id = ?
        `, [orderId, userId]);

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }

        res.json({
            success: true,
            paymentStatus: orders[0].estado_pago,
            mpPaymentId: orders[0].mp_payment_id,
            mpStatus: orders[0].mp_status,
            mpStatusDetail: orders[0].mp_status_detail
        });

    } catch (error) {
        console.error('Error getting payment status:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estado del pago'
        });
    }
});

// Test payment (sandbox)
router.post('/test-payment', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.body;
        
        // Simulate approved payment for testing
        await db.execute(`
            UPDATE pedidos 
            SET estado_pago = 'approved', mp_payment_id = ?, fecha_pago = NOW(),
                mp_status = 'approved', mp_status_detail = 'accredited', estado = 'confirmed'
            WHERE id = ?
        `, [`TEST_${Date.now()}`, orderId]);

        res.json({
            success: true,
            message: 'Pago de prueba aprobado',
            paymentId: `TEST_${Date.now()}`
        });

    } catch (error) {
        console.error('Error in test payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error en pago de prueba'
        });
    }
});

module.exports = router;
