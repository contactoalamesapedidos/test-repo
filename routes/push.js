const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { vapidKeys, webpush } = require('../config/vapid');

// Middleware para verificar autenticación
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'No autorizado' });
    }
}

// Obtener clave pública VAPID
router.get('/vapid-public-key', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(vapidKeys.publicKey);
});

// Suscribir usuario a notificaciones push
router.post('/subscribe', requireAuth, async (req, res) => {
    try {
        const { subscription, userId, userType } = req.body;
        
        console.log('=== SUSCRIPCIÓN PUSH RECIBIDA ===');
        console.log('userId:', userId);
        console.log('userType:', userType);
        console.log('subscription type:', typeof subscription);
        console.log('subscription:', subscription);
        
        if (!subscription || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Datos de suscripción incompletos'
            });
        }

        // Manejo multi-dispositivo: buscar por endpoint dentro de las suscripciones del usuario
        const endpoint = subscription && subscription.endpoint ? String(subscription.endpoint) : null;
        const subscriptionJson = JSON.stringify(subscription);

        // Traer suscripciones existentes del usuario
        const [existingSubscriptions] = await db.execute(`
            SELECT id, subscription_data FROM push_subscriptions 
            WHERE usuario_id = ?
        `, [userId]);

        let updated = false;
        for (const row of existingSubscriptions) {
            try {
                const data = typeof row.subscription_data === 'string' ? JSON.parse(row.subscription_data) : row.subscription_data;
                if (data && data.endpoint && endpoint && data.endpoint === endpoint) {
                    console.log('Actualizando suscripción existente con mismo endpoint...');
                    await db.execute(`
                        UPDATE push_subscriptions 
                        SET subscription_data = ?, 
                            tipo_usuario = ?,
                            fecha_actualizacion = NOW()
                        WHERE id = ?
                    `, [subscriptionJson, userType, row.id]);
                    updated = true;
                    break;
                }
            } catch (e) {
                console.warn('No se pudo parsear subscription_data existente, se omitirá para comparación de endpoint', e);
            }
        }

        if (!updated) {
            console.log('Insertando nueva suscripción (multi-dispositivo)...');
            await db.execute(`
                INSERT INTO push_subscriptions (
                    usuario_id, 
                    tipo_usuario, 
                    subscription_data, 
                    fecha_creacion, 
                    fecha_actualizacion
                ) VALUES (?, ?, ?, NOW(), NOW())
            `, [userId, userType, subscriptionJson]);
        }

        res.json({
            success: true,
            message: 'Suscripción guardada exitosamente'
        });

    } catch (error) {
        console.error('Error guardando suscripción:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Cancelar suscripción
router.post('/unsubscribe', requireAuth, async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'ID de usuario requerido'
            });
        }

        // Eliminar suscripción
        await db.execute(`
            DELETE FROM push_subscriptions 
            WHERE usuario_id = ?
        `, [userId]);

        res.json({
            success: true,
            message: 'Suscripción cancelada exitosamente'
        });

    } catch (error) {
        console.error('Error cancelando suscripción:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Enviar notificación a un usuario específico
async function sendNotificationToUser(userId, notificationData) {
    try {
        console.log('[PUSH] [sendNotificationToUser] Buscando suscripción para usuario', userId, 'con datos:', notificationData);
        // Obtener la suscripción push del usuario
        const [rows] = await db.execute('SELECT * FROM push_subscriptions WHERE usuario_id = ?', [userId]);
        if (rows.length === 0) {
            console.log(`[PUSH] No hay suscripción push para el usuario ${userId}`);
            return false;
        }
        let anySuccess = false;
        for (const row of rows) {
            let subscription = row.subscription_data;
            if (typeof subscription === 'string') {
                try {
                    subscription = JSON.parse(subscription);
                } catch (e) {
                    console.error('[PUSH] Error parseando la suscripción push (id=' + row.id + '):', e);
                    continue;
                }
            }
            if (!subscription || !subscription.endpoint) {
                console.error('[PUSH] Suscripción inválida (id=' + row.id + ') para usuario', userId, subscription);
                continue;
            }
            try {
                console.log('[PUSH] Enviando notificación push al usuario', userId, 'suscripción id=', row.id);
                await webpush.sendNotification(subscription, JSON.stringify(notificationData));
                console.log('[PUSH] Notificación enviada correctamente al usuario', userId, 'suscripción id=', row.id);
                anySuccess = true;
            } catch (error) {
                if (error.statusCode === 410) {
                    console.log('[PUSH] La suscripción ha expirado o no es válida. Eliminándola de la BD. id=', row.id);
                    try {
                        await db.execute('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
                        console.log('[PUSH] Suscripción eliminada de la BD (id=', row.id, ') para el usuario:', userId);
                    } catch (dbError) {
                        console.error('[PUSH] Error eliminando la suscripción de la BD (id=' + row.id + '):', dbError);
                    }
                } else {
                    console.error('[PUSH] Error enviando notificación push al usuario', userId, 'suscripción id=', row.id, error);
                }
            }
        }
        return anySuccess;
    } catch (error) {
        console.error('[PUSH] Error general en sendNotificationToUser para usuario', userId, error);
        return false;
    }
}

// Enviar notificación a todos los usuarios de un restaurante
async function sendNotificationToRestaurant(restaurantId, notificationData) {
    try {
        console.log('[PUSH] [sendNotificationToRestaurant] Buscando propietario del restaurante', restaurantId, 'con datos:', notificationData);
        // Obtener el usuario propietario del restaurante
        const [owners] = await db.execute(
            'SELECT usuario_id FROM restaurantes WHERE id = ?', [restaurantId]
        );
        if (owners.length === 0) {
            console.log(`[PUSH] No se encontró propietario para el restaurante ${restaurantId}`);
            return false;
        }
        const ownerId = owners[0].usuario_id;

        // Obtener datos del pedido para personalizar la notificación
        let pedido = null;
        let productoImagen = null;
        try {
            const [pedidos] = await db.execute(
                'SELECT p.id, p.numero_pedido, p.total, r.nombre as restaurante_nombre FROM pedidos p JOIN restaurantes r ON p.restaurante_id = r.id WHERE p.id = ?',
                [notificationData.orderId]
            );
            if (pedidos.length > 0) {
                pedido = pedidos[0];
                // Buscar imagen del primer producto del pedido
                const [items] = await db.execute(
                    'SELECT pr.imagen FROM items_pedido ip JOIN productos pr ON ip.producto_id = pr.id WHERE ip.pedido_id = ? LIMIT 1',
                    [pedido.id]
                );
                if (items.length > 0 && items[0].imagen) {
                    productoImagen = items[0].imagen;
                }
            }
        } catch (e) {
            console.error('[PUSH] Error obteniendo datos del pedido para personalizar notificación:', e);
        }

        // Personalizar la notificación
        const pushPayload = {
            title: pedido ? `🍽️ Nuevo pedido en ${pedido.restaurante_nombre}` : '🍽️ Nuevo pedido recibido',
            body: pedido ? `Pedido #${pedido.numero_pedido} - Total: $${pedido.total}` : notificationData.body,
            icon: '/images/logo-a-la-mesa.png',
            badge: '/images/logo-a-la-mesa.png',
            image: productoImagen ? productoImagen : undefined,
            tag: pedido ? `pedido-${pedido.id}` : undefined,
            requireInteraction: true,
            actions: [
                { action: 'view', title: 'Ver pedido', icon: '/images/eye.png' },
                { action: 'close', title: 'Cerrar', icon: '/images/close.png' }
            ],
            vibrate: [200, 100, 200, 100, 200],
            data: {
                url: notificationData.url || (pedido ? `/dashboard/orders/${pedido.id}` : '/dashboard/orders'),
                pedidoId: pedido ? pedido.id : undefined
            }
        };

        let success = false;
        const ok = await sendNotificationToUser(ownerId, pushPayload);
        if (ok) success = true;
        if (success) {
            console.log('[PUSH] Notificación enviada al propietario del restaurante', restaurantId);
        } else {
            console.log('[PUSH] No se pudo enviar la notificación al propietario del restaurante', restaurantId);
        }
        return success;
    } catch (error) {
        console.error('[PUSH] Error enviando notificación push al restaurante', restaurantId, error);
        return false;
    }
}

// Función para enviar notificación de nuevo pedido
async function sendNewOrderNotification(orderId, restaurantId, orderNumber, total) {
    try {
        console.log('[PUSH] [sendNewOrderNotification] Notificando nuevo pedido', { orderId, restaurantId, orderNumber, total });
        const notificationData = {
            title: 'Nuevo pedido recibido',
            body: `Pedido #${orderNumber} - Total: $${total}`,
            url: `/dashboard/orders/${orderId}`
        };
        const ok = await sendNotificationToRestaurant(restaurantId, notificationData);
        if (ok) {
            console.log('[PUSH] Notificación de nuevo pedido enviada correctamente al restaurante', restaurantId);
        } else {
            console.log('[PUSH] Falló el envío de la notificación de nuevo pedido al restaurante', restaurantId);
        }
        return ok;
    } catch (error) {
        console.error('[PUSH] Error en sendNewOrderNotification:', error);
        return false;
    }
}

// Enviar notificación de cambio de estado de pedido a un usuario
async function sendOrderStatusNotification(userId, pedidoId, nuevoEstado) {
    try {
        // Obtener datos del pedido y producto
        let pedido = null;
        let productoImagen = null;
        let restauranteNombre = '';
        try {
            const [pedidos] = await db.execute(
                'SELECT p.id, p.numero_pedido, p.estado, r.nombre as restaurante_nombre FROM pedidos p JOIN restaurantes r ON p.restaurante_id = r.id WHERE p.id = ?',
                [pedidoId]
            );
            if (pedidos.length > 0) {
                pedido = pedidos[0];
                restauranteNombre = pedido.restaurante_nombre;
                // Buscar imagen del primer producto del pedido
                const [items] = await db.execute(
                    'SELECT pr.imagen FROM items_pedido ip JOIN productos pr ON ip.producto_id = pr.id WHERE ip.pedido_id = ? LIMIT 1',
                    [pedido.id]
                );
                if (items.length > 0 && items[0].imagen) {
                    productoImagen = items[0].imagen;
                }
            }
        } catch (e) {
            console.error('[PUSH] Error obteniendo datos del pedido para notificación de estado:', e);
        }

        // Mensaje y título según el estado
        const estadoMap = {
            pendiente: { emoji: '⏳', texto: 'Pendiente' },
            confirmado: { emoji: '✅', texto: 'Confirmado' },
            preparando: { emoji: '👨‍🍳', texto: 'Preparando' },
            listo: { emoji: '🍽️', texto: 'Listo para retirar/entregar' },
            en_camino: { emoji: '🛵', texto: 'En camino' },
            entregado: { emoji: '🎉', texto: 'Entregado' },
            cancelado: { emoji: '❌', texto: 'Cancelado' }
        };
        const estadoInfo = estadoMap[nuevoEstado] || { emoji: '', texto: nuevoEstado };

        const pushPayload = {
            title: pedido ? `${estadoInfo.emoji} Pedido #${pedido.numero_pedido} - ${estadoInfo.texto}` : `Estado de tu pedido: ${estadoInfo.texto}`,
            body: pedido ? `Tu pedido en ${restauranteNombre} está ahora: ${estadoInfo.texto}` : `Estado actualizado: ${estadoInfo.texto}`,
            icon: '/images/logo-a-la-mesa.png',
            badge: '/images/logo-a-la-mesa.png',
            image: productoImagen ? productoImagen : undefined,
            tag: pedido ? `pedido-${pedido.id}` : undefined,
            requireInteraction: true,
            actions: [
                { action: 'view', title: 'Ver pedido', icon: '/images/eye.png' },
                { action: 'close', title: 'Cerrar', icon: '/images/close.png' }
            ],
            vibrate: [100, 50, 200, 50, 100],
            data: {
                url: pedido ? `/orders/${pedido.id}` : '/orders/history',
                pedidoId: pedido ? pedido.id : undefined
            }
        };

        return await sendNotificationToUser(userId, pushPayload);
    } catch (error) {
        console.error('[PUSH] Error enviando notificación de estado de pedido:', error);
        return false;
    }
}

// Endpoint de prueba para notificación push a restaurante
router.post('/test-restaurant', requireAuth, async (req, res) => {
    try {
        // Obtener el restaurante asociado al usuario actual
        const [restaurants] = await db.execute('SELECT id FROM restaurantes WHERE usuario_id = ?', [req.session.user.id]);
        if (restaurants.length === 0) {
            return res.status(404).json({ success: false, message: 'No tienes restaurante asociado' });
        }
        const restaurantId = restaurants[0].id;
        // Datos de prueba
        const notificationData = {
            title: 'Prueba de notificación push',
            body: '¡Esto es una notificación real enviada desde el backend!',
            url: '/dashboard/orders'
        };
        const ok = await router.sendNotificationToRestaurant(restaurantId, notificationData);
        if (ok) {
            return res.json({ success: true, message: 'Notificación enviada correctamente al restaurante' });
        } else {
            return res.status(500).json({ success: false, message: 'No se pudo enviar la notificación al restaurante' });
        }
    } catch (error) {
        console.error('[PUSH] Error en /test-restaurant:', error);
        return res.status(500).json({ success: false, message: 'Error interno al enviar la notificación' });
    }
});

// Exportar funciones para uso en otras rutas
module.exports = router;

// También exportar las funciones como propiedades del router para uso en otras rutas
router.sendNewOrderNotification = sendNewOrderNotification;
router.sendOrderStatusNotification = sendOrderStatusNotification;
router.sendNotificationToUser = sendNotificationToUser;
router.sendNotificationToRestaurant = sendNotificationToRestaurant; 
router.sendNotificationToRestaurant = sendNotificationToRestaurant;