const express = require('express');
const router = express.Router();
const mercadopago = require('mercadopago');
const db = require('../config/database');
require('dotenv').config();
const BASE_URL = process.env.BASE_URL || 'https://alamesaargentina.loca.lt';

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Debes estar logueado para realizar esta acción' });
    }
    next();
};

// Create payment preference
router.post('/create-preference', requireAuth, async (req, res) => {
    // Log removed for security - payment creation request received
    try {
        const { orderId } = req.body;
        const userId = req.session.user.id;


        // Get order details to find the restaurant_id
        const [orders] = await db.execute(`
            SELECT o.*, r.nombre as restaurante_nombre, r.mp_access_token, r.mp_user_id
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
        // Check if restaurant has Mercado Pago credentials
        if (!order.mp_access_token || !order.mp_user_id) {
            return res.status(400).json({ success: false, message: 'El restaurante no tiene configurado Mercado Pago para recibir pagos.' });
        }

        // Configure Mercado Pago with the restaurant's access token
        mercadopago.configure({
            access_token: order.mp_access_token
        });

        // Get order items
        const [items] = await db.execute(`
            SELECT ip.*, p.nombre, p.descripcion, p.imagen
            FROM items_pedido ip
            JOIN productos p ON ip.producto_id = p.id
            WHERE ip.pedido_id = ?
        `, [orderId]);

        // Create preference items for MercadoPago
        const preferenceItems = items.map(item => ({
            title: item.nombre,
            unit_price: parseFloat(item.precio_unitario),
            quantity: item.cantidad,
        }));

        // Calculate application fee (10% commission)
        const applicationFee = parseFloat((order.total * 0.10).toFixed(2));

        // Create preference
        const preference = {
            items: preferenceItems,
            external_reference: orderId.toString(),
            back_urls: {
                success: `${BASE_URL}/payments/success`,
                failure: `${BASE_URL}/payments/failure`,
                pending: `${BASE_URL}/payments/pending`,
            },
            auto_return: 'approved',
            payment_methods: {
                excluded_payment_types: [
                    { id: 'ticket' }
                ],
                installments: 1,
            },
            notification_url: `${BASE_URL}/payments/webhook`,
            statement_descriptor: 'ALAMESA',
            application_fee: applicationFee,
            payer: {
                entity_type: 'individual',
                type: 'customer',
                // You might want to pass customer details here if available
            },
            // This is crucial for split payments: the platform's user ID
            sponsor_id: process.env.MP_PLATFORM_USER_ID, // Your platform's Mercado Pago User ID
            // The restaurant's Mercado Pago User ID to receive the payment
            collector_id: order.mp_user_id
        };


        const result = await mercadopago.preferences.create(preference);
        res.json({ success: true, preferenceId: result.body.id });

    } catch (error) {
        console.error('Error creating Mercado Pago preference:', error);
        res.status(500).json({ success: false, message: 'Error al crear la preferencia de pago.' });
    }
});

// Payment success page
router.get('/success', async (req, res) => {
    try {
        const { collection_id, collection_status, payment_id, status, external_reference } = req.query;

        if (external_reference) {
            const paymentStatus = collection_status || status;
            // Update order status
            if (paymentStatus === 'approved') {
                await db.execute(`
                    UPDATE pedidos
                    SET estado_pago = ?, mp_payment_id = ?, fecha_pago = NOW(), estado = 'confirmado'
                    WHERE id = ?
                `, [paymentStatus, payment_id || collection_id, external_reference]);
            } else {
                await db.execute(`
                    UPDATE pedidos
                    SET estado_pago = ?, mp_payment_id = ?, fecha_pago = NOW()
                    WHERE id = ?
                `, [paymentStatus, payment_id || collection_id, external_reference]);
            }
        }

        res.render('payments/success', {
            title: 'Pago Exitoso - A la Mesa',
            paymentId: payment_id || collection_id,
            orderId: external_reference,
            status: collection_status || status,
            hideFooterBeneficios: true
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
            // Configure Mercado Pago with platform credentials
            mercadopago.configure({
                client_id: process.env.MP_APP_ID,
                client_secret: process.env.MP_CLIENT_SECRET
            });

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
                        SET estado = 'confirmado'
                        WHERE id = ? AND estado IN ('pending', 'pendiente_pago')
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

router.get('/public-key/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const [rows] = await db.execute('SELECT mp_public_key FROM restaurantes WHERE id = ?', [restaurantId]);

        if (rows.length === 0 || !rows[0].mp_public_key) {
            return res.status(404).json({ error: 'No se encontró la clave pública para este restaurante.' });
        }
        res.json({ publicKey: rows[0].mp_public_key });
    } catch (error) {
        console.error('Error al obtener la clave pública:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;
