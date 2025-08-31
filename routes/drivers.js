const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware para asegurar que el usuario es un repartidor
function requireDriver(req, res, next) {
    if (!req.session.user || req.session.user.tipo_usuario !== 'repartidor') {
        return res.status(403).json({ success: false, message: 'Acceso denegado. Solo para repartidores.' });
    }
    next();
}

// Ruta para obtener el perfil del repartidor
router.get('/me', requireDriver, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [driver] = await db.execute(
            'SELECT d.*, u.nombre, u.apellido, u.email FROM drivers d JOIN usuarios u ON d.user_id = u.id WHERE d.user_id = ?',
            [userId]
        );

        if (driver.length === 0) {
            return res.status(404).json({ success: false, message: 'Repartidor no encontrado.' });
        }

        res.json({ success: true, driver: driver[0] });
    } catch (error) {
        console.error('Error al obtener perfil del repartidor:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para actualizar el estado del repartidor
router.put('/me/status', requireDriver, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { status } = req.body;

        if (!['available', 'on_delivery', 'offline'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado inválido.' });
        }

        await db.execute(
            'UPDATE drivers SET status = ? WHERE user_id = ?',
            [status, userId]
        );

        res.json({ success: true, message: 'Estado actualizado correctamente.' });
    } catch (error) {
        console.error('Error al actualizar estado del repartidor:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para actualizar la ubicación del repartidor
router.put('/me/location', requireDriver, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { latitude, longitude } = req.body;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return res.status(400).json({ success: false, message: 'Coordenadas inválidas.' });
        }

        await db.execute(
            'UPDATE drivers SET current_latitude = ?, current_longitude = ? WHERE user_id = ?',
            [latitude, longitude, userId]
        );

        // Obtener los pedidos activos de este repartidor para notificar a los clientes
        const [activeOrders] = await db.execute(
            `SELECT cliente_id FROM pedidos WHERE repartidor_id = ? AND delivery_status IN ('assigned', 'picked_up', 'on_the_way')`,
            [userId]
        );

        // Emitir la actualización de ubicación a cada cliente relevante
        const io = req.app.get('io');
        activeOrders.forEach(order => {
            io.to(`user-${order.cliente_id}`).emit('driverLocationUpdate', { driverId: userId, latitude, longitude });
        });

        res.json({ success: true, message: 'Ubicación actualizada correctamente.' });
    } catch (error) {
        console.error('Error al actualizar ubicación del repartidor:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para obtener los pedidos asignados al repartidor
router.get('/me/orders', requireDriver, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [orders] = await db.execute(
            `SELECT p.*, r.nombre as restaurante_nombre, r.direccion as restaurante_direccion, r.latitud as restaurante_latitud, r.longitud as restaurante_longitud,
                    u.nombre as cliente_nombre, u.apellido as cliente_apellido
             FROM pedidos p
             JOIN restaurantes r ON p.restaurante_id = r.id
             JOIN usuarios u ON p.cliente_id = u.id
             WHERE p.repartidor_id = ? AND p.delivery_status IN ('assigned', 'picked_up', 'on_the_way')
             ORDER BY p.fecha_pedido ASC`,
            [userId]
        );

        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error al obtener pedidos del repartidor:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para marcar un pedido como recogido
router.put('/orders/:id/pickup', requireDriver, async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user.id;

        const [result] = await db.execute(
            `UPDATE pedidos SET delivery_status = ?, picked_up_at = NOW() WHERE id = ? AND repartidor_id = ? AND delivery_status = 'assigned'`,
            ['picked_up', orderId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'No se pudo marcar el pedido como recogido. Verifique el ID o el estado actual.' });
        }

        // Emitir actualización de estado a través de Socket.IO
        const [order] = await db.execute('SELECT cliente_id FROM pedidos WHERE id = ?', [orderId]);
        if (order.length > 0) {
            req.app.get('io').to(`user-${order[0].cliente_id}`).emit('orderStatusUpdate', { orderId, status: 'picked_up' });
        }

        res.json({ success: true, message: 'Pedido marcado como recogido.' });
    } catch (error) {
        console.error('Error al marcar pedido como recogido:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// Ruta para marcar un pedido como entregado
router.put('/orders/:id/deliver', requireDriver, async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user.id;

        const [result] = await db.execute(
            `UPDATE pedidos SET delivery_status = ?, delivered_at = NOW(), estado = 'entregado' WHERE id = ? AND repartidor_id = ? AND delivery_status IN ('picked_up', 'on_the_way')`,
            ['delivered', orderId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'No se pudo marcar el pedido como entregado. Verifique el ID o el estado actual.' });
        }

        // Emitir actualización de estado a través de Socket.IO
        const [order] = await db.execute('SELECT cliente_id FROM pedidos WHERE id = ?', [orderId]);
        if (order.length > 0) {
            req.app.get('io').to(`user-${order[0].cliente_id}`).emit('orderStatusUpdate', { orderId, status: 'delivered' });
        }

        res.json({ success: true, message: 'Pedido marcado como entregado.' });
    } catch (error) {
        console.error('Error al marcar pedido como entregado:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

module.exports = router;
