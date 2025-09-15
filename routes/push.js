const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { vapidKeys, webpush } = require('../config/vapid');
const logger = require('../utils/logger');

// Middleware para verificar autenticación
function requireAuth(req, res, next) {
    logger.debug('[AUTH] Verificando autenticación', {
        hasSession: !!req.session,
        hasUser: !!(req.session && req.session.user),
        userId: req.session?.user?.id
    });

    if (req.session && req.session.user) {
        logger.debug('[AUTH] Usuario autenticado', { userId: req.session.user.id });
        next();
    } else {
        logger.warn('[AUTH] Usuario no autenticado');
        res.status(401).json({
            success: false,
            message: 'No autorizado - sesión no encontrada',
            debug: {
                hasSession: !!req.session,
                hasUser: !!(req.session && req.session.user),
                origin: req.headers.origin,
                host: req.headers.host,
                userAgent: req.headers['user-agent']
            }
        });
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
        
        // Log de suscripción push (solo en desarrollo)
        if (process.env.NODE_ENV === 'development') {
            console.log('=== SUSCRIPCIÓN PUSH RECIBIDA ===');
            console.log('userId:', userId);
            console.log('userType:', userType);
        }
        
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
        logger.debug('[PUSH] Iniciando envío de notificación', { userId, title: notificationData.title });

        // Verificar configuración VAPID
        if (!vapidKeys || !vapidKeys.publicKey || !vapidKeys.privateKey) {
            logger.error('[PUSH] Claves VAPID no configuradas');
            return false;
        }

        // Verificar que el usuario existe y tiene preferencias de notificación activadas
        const [userCheck] = await db.execute(
            'SELECT id, nombre, recibir_notificaciones FROM usuarios WHERE id = ?',
            [userId]
        );

        if (userCheck.length === 0) {
            logger.warn('[PUSH] Usuario no encontrado', { userId });
            return false;
        }

        const user = userCheck[0];
        logger.debug('[PUSH] Usuario encontrado', { userId, nombre: user.nombre });

        // Verificar preferencias de notificación
        if (Number(user.recibir_notificaciones) !== 1) {
            logger.debug('[PUSH] Usuario tiene notificaciones desactivadas', { userId });
            return false;
        }

        // Obtener suscripciones activas del usuario
        const [rows] = await db.execute(
            'SELECT id, subscription_data, fecha_creacion FROM push_subscriptions WHERE usuario_id = ? ORDER BY fecha_creacion DESC',
            [userId]
        );

        if (rows.length === 0) {
            logger.debug('[PUSH] No hay suscripciones push activas', { userId });
            return false;
        }

        logger.debug('[PUSH] Suscripciones encontradas', { userId, count: rows.length });
        let anySuccess = false;
        let validSubscriptions = 0;

        for (const row of rows) {
            logger.debug('[PUSH] Procesando suscripción', { subscriptionId: row.id });

            let subscription = row.subscription_data;
            if (typeof subscription === 'string') {
                try {
                    subscription = JSON.parse(subscription);
                } catch (e) {
                    logger.error('[PUSH] Error parseando suscripción', { subscriptionId: row.id, error: e.message });
                    // Eliminar suscripción corrupta
                    await db.execute('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
                    continue;
                }
            }

            // Validar estructura de la suscripción
            if (!subscription || !subscription.endpoint || !subscription.keys) {
                logger.error('[PUSH] Suscripción inválida', { subscriptionId: row.id });
                // Eliminar suscripción inválida
                await db.execute('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
                continue;
            }

            // Verificar que el endpoint sea válido
            if (!subscription.endpoint || typeof subscription.endpoint !== 'string' || subscription.endpoint.length < 10) {
                logger.error('[PUSH] Endpoint inválido', { subscriptionId: row.id });
                await db.execute('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
                continue;
            }

            validSubscriptions++;

            try {
                // Preparar payload con metadatos adicionales
                const enhancedPayload = {
                    ...notificationData,
                    userId: userId,
                    timestamp: new Date().toISOString(),
                    subscriptionId: row.id
                };

                const result = await webpush.sendNotification(subscription, JSON.stringify(enhancedPayload));
                logger.info('[PUSH] Notificación enviada exitosamente', {
                    userId,
                    subscriptionId: row.id,
                    title: notificationData.title
                });
                anySuccess = true;

            } catch (error) {
                logger.error('[PUSH] Error enviando notificación', {
                    userId,
                    subscriptionId: row.id,
                    statusCode: error.statusCode,
                    message: error.message
                });

                // Manejar diferentes tipos de errores
                if (error.statusCode === 410) {
                    logger.warn('[PUSH] Suscripción expirada, eliminándola', { subscriptionId: row.id });
                    try {
                        await db.execute('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
                    } catch (dbError) {
                        logger.error('[PUSH] Error eliminando suscripción expirada', {
                            subscriptionId: row.id,
                            error: dbError.message
                        });
                    }
                } else if (error.statusCode === 400) {
                    logger.error('[PUSH] Payload inválido', { subscriptionId: row.id });
                    await db.execute('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
                } else if (error.statusCode === 413) {
                    logger.error('[PUSH] Payload demasiado grande', {
                        subscriptionId: row.id,
                        payloadSize: JSON.stringify(notificationData).length
                    });
                } else if (error.statusCode === 429) {
                    logger.warn('[PUSH] Rate limit excedido', { subscriptionId: row.id });
                }
            }
        }

        logger.info('[PUSH] Resumen envío', {
            userId,
            totalSubscriptions: rows.length,
            validSubscriptions,
            success: anySuccess
        });

        return anySuccess;

    } catch (error) {
        logger.error('[PUSH] Error general en sendNotificationToUser', {
            userId,
            error: error.message,
            stack: error.stack
        });
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
            silent: false,
            actions: [
                { action: 'view', title: 'Ver pedido' },
                { action: 'close', title: 'Cerrar' }
            ],
            vibrate: [200, 100, 200, 100, 200],
            data: {
                url: '/dashboard/orders', // Siempre ir a la lista de pedidos, no al pedido específico
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
                { action: 'view', title: 'Ver pedido' },
                { action: 'close', title: 'Cerrar' }
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

async function sendNotificationToDriver(driverId, notificationData) {
    try {
        console.log(`[PUSH] [sendNotificationToDriver] Buscando usuario para driver ${driverId}`);
        const [drivers] = await db.execute('SELECT user_id FROM drivers WHERE id = ?', [driverId]);
        if (drivers.length === 0) {
            console.log(`[PUSH] No se encontró usuario para el driver ${driverId}`);
            return false;
        }
        const userId = drivers[0].user_id;
        return await sendNotificationToUser(userId, notificationData);
    } catch (error) {
        console.error(`[PUSH] Error enviando notificación push al driver ${driverId}`, error);
        return false;
    }
}

// Endpoint para verificar estado de notificaciones push
router.get('/status', requireAuth, async (req, res) => {
    try {
        console.log('[PUSH] [status] Verificando estado de notificaciones para usuario:', req.session.user.id);

        // Verificar suscripciones
        const [subscriptions] = await db.execute('SELECT id, subscription_data, fecha_creacion FROM push_subscriptions WHERE usuario_id = ?', [req.session.user.id]);
        console.log('[PUSH] [status] Suscripciones encontradas:', subscriptions.length);

        // Verificar restaurante
        const [restaurants] = await db.execute('SELECT id, nombre FROM restaurantes WHERE usuario_id = ?', [req.session.user.id]);
        console.log('[PUSH] [status] Restaurantes encontrados:', restaurants.length);

        // Verificar preferencias de usuario
        const [userPrefs] = await db.execute('SELECT recibir_notificaciones FROM usuarios WHERE id = ?', [req.session.user.id]);
        const hasPushPreference = userPrefs.length > 0 && userPrefs[0].recibir_notificaciones;
        console.log('[PUSH] [status] Preferencia de notificaciones:', hasPushPreference);

        return res.json({
            success: true,
            userId: req.session.user.id,
            userType: req.session.user.tipo_usuario,
            hasSubscriptions: subscriptions.length > 0,
            subscriptionCount: subscriptions.length,
            hasRestaurant: restaurants.length > 0,
            restaurantId: restaurants.length > 0 ? restaurants[0].id : null,
            restaurantName: restaurants.length > 0 ? restaurants[0].nombre : null,
            hasPushPreference: hasPushPreference,
            subscriptions: subscriptions.map(sub => ({
                id: sub.id,
                fecha_creacion: sub.fecha_creacion,
                endpoint: sub.subscription_data ? (typeof sub.subscription_data === 'string' ? JSON.parse(sub.subscription_data).endpoint : sub.subscription_data.endpoint) : null
            })),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[PUSH] [status] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error verificando estado: ' + error.message
        });
    }
});

// Endpoint de prueba para notificación push a restaurante
router.post('/test-restaurant', requireAuth, async (req, res) => {
    try {
        console.log('[PUSH] [test-restaurant] === INICIO TEST RESTAURANT ===');
        console.log('[PUSH] [test-restaurant] Headers:', JSON.stringify(req.headers, null, 2));
        console.log('[PUSH] [test-restaurant] Session:', req.session ? 'EXISTS' : 'NULL');
        console.log('[PUSH] [test-restaurant] Session User:', req.session && req.session.user ? req.session.user : 'NULL');
        console.log('[PUSH] [test-restaurant] Usuario ID:', req.session.user.id);
        console.log('[PUSH] [test-restaurant] Usuario tipo:', req.session.user.tipo_usuario);
        console.log('[PUSH] [test-restaurant] Origin:', req.headers.origin);
        console.log('[PUSH] [test-restaurant] Host:', req.headers.host);
        console.log('[PUSH] [test-restaurant] User-Agent:', req.headers['user-agent']);

        // Obtener el restaurante asociado al usuario actual
        const [restaurants] = await db.execute('SELECT id, nombre FROM restaurantes WHERE usuario_id = ?', [req.session.user.id]);
        console.log('[PUSH] [test-restaurant] Restaurantes encontrados:', restaurants.length);

        if (restaurants.length === 0) {
            console.log('[PUSH] [test-restaurant] No se encontró restaurante para usuario:', req.session.user.id);
            return res.status(404).json({
                success: false,
                message: 'No tienes restaurante asociado. Solo los propietarios de restaurantes pueden probar las notificaciones.',
                userId: req.session.user.id,
                userType: req.session.user.tipo_usuario
            });
        }
        const restaurantId = restaurants[0].id;
        const restaurantName = restaurants[0].nombre;
        console.log('[PUSH] [test-restaurant] Restaurante encontrado:', restaurantId, restaurantName);

        // Verificar si el usuario tiene suscripción push
        const [subscriptions] = await db.execute('SELECT id, subscription_data FROM push_subscriptions WHERE usuario_id = ?', [req.session.user.id]);
        console.log('[PUSH] [test-restaurant] Suscripciones encontradas:', subscriptions.length);

        if (subscriptions.length === 0) {
            console.log('[PUSH] [test-restaurant] No hay suscripción push para usuario:', req.session.user.id);

            // Intentar crear una suscripción push automáticamente si el usuario tiene la preferencia activada
            const [userPrefs] = await db.execute('SELECT recibir_notificaciones FROM usuarios WHERE id = ?', [req.session.user.id]);
            const hasPushPreference = userPrefs.length > 0 && userPrefs[0].recibir_notificaciones;

            if (hasPushPreference) {
                console.log('[PUSH] [test-restaurant] Usuario tiene preferencia activada, intentando crear suscripción...');
                return res.status(400).json({
                    success: false,
                    message: 'Tienes las notificaciones activadas pero no hay suscripción push. Actualiza la página y vuelve a activar el switch de notificaciones.',
                    userId: req.session.user.id,
                    restaurantId: restaurantId,
                    restaurantName: restaurantName,
                    needsResubscribe: true
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'No tienes suscripción push activa. Ve a Configuración > Notificaciones y habilita las notificaciones push.',
                    userId: req.session.user.id,
                    restaurantId: restaurantId,
                    restaurantName: restaurantName
                });
            }
        }

        console.log('[PUSH] [test-restaurant] Suscripción encontrada, enviando notificación de prueba...');

        // Datos de prueba
        const notificationData = {
            title: `🔔 Prueba - ${restaurantName}`,
            body: '¡Esto es una notificación real enviada desde el backend! Si la ves, las notificaciones funcionan correctamente.',
            url: '/dashboard/orders',
            orderId: null // No hay pedido específico para esta prueba
        };

        const ok = await sendNotificationToRestaurant(restaurantId, notificationData);

        if (ok) {
            console.log('[PUSH] [test-restaurant] Notificación enviada exitosamente');
            return res.json({
                success: true,
                message: '✅ Notificación de prueba enviada correctamente. Deberías recibirla en breve.',
                subscriptionCount: subscriptions.length,
                restaurantId: restaurantId,
                restaurantName: restaurantName
            });
        } else {
            console.log('[PUSH] [test-restaurant] Falló el envío de la notificación');
            return res.status(500).json({
                success: false,
                message: '❌ No se pudo enviar la notificación. Revisa la consola del navegador y el service worker.',
                restaurantId: restaurantId,
                subscriptionCount: subscriptions.length
            });
        }
    } catch (error) {
        console.error('[PUSH] Error en /test-restaurant:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno al enviar la notificación: ' + error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Endpoint temporal para testing sin autenticación (SOLO PARA DESARROLLO)
if (process.env.NODE_ENV !== 'production') {
    router.post('/test-restaurant-debug', async (req, res) => {
        try {
            console.log('[DEBUG] === TEST RESTAURANT DEBUG (SIN AUTH) ===');
            console.log('[DEBUG] Headers:', JSON.stringify(req.headers, null, 2));
            console.log('[DEBUG] Body:', JSON.stringify(req.body, null, 2));

            // Usar un usuario hardcodeado para testing (cambiar según necesidad)
            const testUserId = req.body.userId || 1; // Usuario de prueba
            console.log('[DEBUG] Usando usuario de prueba:', testUserId);

            // Obtener el restaurante asociado al usuario de prueba
            const [restaurants] = await db.execute('SELECT id, nombre FROM restaurantes WHERE usuario_id = ?', [testUserId]);
            console.log('[DEBUG] Restaurantes encontrados:', restaurants.length);

            if (restaurants.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró restaurante para el usuario de prueba',
                    testUserId: testUserId
                });
            }

            const restaurantId = restaurants[0].id;
            const restaurantName = restaurants[0].nombre;

            // Verificar suscripciones
            const [subscriptions] = await db.execute('SELECT id, subscription_data FROM push_subscriptions WHERE usuario_id = ?', [testUserId]);
            console.log('[DEBUG] Suscripciones encontradas:', subscriptions.length);

            if (subscriptions.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay suscripción push para el usuario de prueba',
                    testUserId: testUserId,
                    restaurantId: restaurantId
                });
            }

            // Datos de prueba
            const notificationData = {
                title: `🔔 DEBUG - ${restaurantName}`,
                body: `Test desde ngrok - ${new Date().toLocaleTimeString()}`,
                url: '/dashboard/orders',
                orderId: null
            };

            console.log('[DEBUG] Enviando notificación de prueba...');
            const ok = await sendNotificationToRestaurant(restaurantId, notificationData);

            return res.json({
                success: ok,
                message: ok ? '✅ Notificación enviada' : '❌ Falló el envío',
                testUserId: testUserId,
                restaurantId: restaurantId,
                restaurantName: restaurantName,
                subscriptionCount: subscriptions.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('[DEBUG] Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error en debug: ' + error.message,
                stack: error.stack
            });
        }
    });

    // Endpoint para enviar notificación de prueba inmediata
router.post('/test-immediate', requireAuth, async (req, res) => {
    try {
        console.log('[PUSH] [test-immediate] Enviando notificación inmediata de prueba');

        const notificationData = {
            title: '🔔 TEST INMEDIATO',
            body: `Test enviado a las ${new Date().toLocaleTimeString()}`,
            icon: '/images/logo-a-la-mesa.png',
            badge: '/images/logo-a-la-mesa.png',
            requireInteraction: true,
            silent: false,
            actions: [
                { action: 'view', title: 'Ver' },
                { action: 'close', title: 'Cerrar' }
            ],
            vibrate: [200, 100, 200, 100, 200],
            data: {
                url: '/dashboard/orders',
                test: true
            }
        };

        const ok = await sendNotificationToUser(req.session.user.id, notificationData);

        return res.json({
            success: ok,
            message: ok ? '✅ Notificación enviada inmediatamente' : '❌ Falló el envío inmediato',
            userId: req.session.user.id,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[PUSH] [test-immediate] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error en test inmediato: ' + error.message
        });
    }
});

    // Endpoint de debug directo para probar notificaciones sin validaciones
    router.post('/debug-send', async (req, res) => {
        try {
            console.log('[DEBUG-SEND] === DEBUG SEND DIRECT ===');
            console.log('[DEBUG-SEND] Body:', JSON.stringify(req.body, null, 2));

            const { userId, title, body, url } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId es requerido'
                });
            }

            // Verificar suscripciones del usuario
            const [subscriptions] = await db.execute('SELECT id, subscription_data FROM push_subscriptions WHERE usuario_id = ?', [userId]);
            console.log('[DEBUG-SEND] Suscripciones encontradas:', subscriptions.length);

            if (subscriptions.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay suscripciones para este usuario',
                    userId: userId,
                    suggestion: 'El usuario debe activar las notificaciones push desde su navegador'
                });
            }

            // Mostrar detalles de las suscripciones
            console.log('[DEBUG-SEND] Detalles de suscripciones:');
            subscriptions.forEach((sub, index) => {
                console.log(`[DEBUG-SEND] Suscripción ${index + 1}:`, {
                    id: sub.id,
                    data: sub.subscription_data
                });
            });

            // Datos de la notificación
            const notificationData = {
                title: title || '🔔 Debug Notification',
                body: body || `Debug test - ${new Date().toLocaleTimeString()}`,
                icon: '/images/logo-a-la-mesa.png',
                badge: '/images/logo-a-la-mesa.png',
                requireInteraction: true,
                silent: false,
                actions: [
                    { action: 'view', title: 'Ver' },
                    { action: 'close', title: 'Cerrar' }
                ],
                vibrate: [200, 100, 200],
                data: {
                    url: url || '/dashboard/orders'
                }
            };

            console.log('[DEBUG-SEND] Enviando notificación...');
            const ok = await sendNotificationToUser(userId, notificationData);

            return res.json({
                success: ok,
                message: ok ? '✅ Notificación enviada exitosamente' : '❌ Falló el envío',
                userId: userId,
                subscriptionCount: subscriptions.length,
                notificationData: notificationData,
                timestamp: new Date().toISOString(),
                debug: {
                    vapidConfigured: !!(vapidKeys && vapidKeys.publicKey),
                    webpushConfigured: !!webpush
                }
            });

        } catch (error) {
            console.error('[DEBUG-SEND] Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error interno: ' + error.message,
                stack: error.stack,
                debug: {
                    vapidConfigured: !!(vapidKeys && vapidKeys.publicKey),
                    webpushConfigured: !!webpush
                }
            });
        }
    });

    // Endpoint para probar notificaciones con reintento
    router.post('/test-with-retry', async (req, res) => {
        try {
            console.log('[TEST-RETRY] === TEST WITH RETRY ===');
            const { userId, maxRetries = 3 } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId es requerido'
                });
            }

            const notificationData = {
                title: '🔄 Test con Reintento',
                body: `Test enviado con reintento - ${new Date().toLocaleTimeString()}`,
                icon: '/images/logo-a-la-mesa.png',
                badge: '/images/logo-a-la-mesa.png',
                data: { url: '/dashboard/orders' }
            };

            let attempt = 0;
            let success = false;

            while (attempt < maxRetries && !success) {
                attempt++;
                console.log(`[TEST-RETRY] Intento ${attempt}/${maxRetries}`);

                try {
                    success = await sendNotificationToUser(userId, {
                        ...notificationData,
                        body: `${notificationData.body} (Intento ${attempt})`
                    });

                    if (success) {
                        console.log(`[TEST-RETRY] ✅ Éxito en intento ${attempt}`);
                        break;
                    } else {
                        console.log(`[TEST-RETRY] ❌ Falló intento ${attempt}, esperando antes de reintentar...`);
                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Espera progresiva
                        }
                    }
                } catch (error) {
                    console.error(`[TEST-RETRY] Error en intento ${attempt}:`, error);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                    }
                }
            }

            return res.json({
                success: success,
                message: success ? `✅ Notificación enviada en intento ${attempt}` : `❌ Fallaron todos los ${maxRetries} intentos`,
                userId: userId,
                attempts: attempt,
                maxRetries: maxRetries,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('[TEST-RETRY] Error general:', error);
            return res.status(500).json({
                success: false,
                message: 'Error en test con reintento: ' + error.message
            });
        }
    });

    // Endpoint para verificar todas las suscripciones
    router.get('/debug-subscriptions', async (req, res) => {
        try {
            console.log('[DEBUG-SUBS] === VERIFICANDO SUSCRIPCIONES ===');

            const [allSubscriptions] = await db.execute(`
                SELECT ps.id, ps.usuario_id, ps.tipo_usuario, ps.fecha_creacion,
                       u.nombre, u.apellido, u.email
                FROM push_subscriptions ps
                LEFT JOIN usuarios u ON ps.usuario_id = u.id
                ORDER BY ps.fecha_creacion DESC
                LIMIT 20
            `);

            console.log('[DEBUG-SUBS] Total de suscripciones:', allSubscriptions.length);

            // También verificar si hay usuarios con preferencias de notificaciones activadas
            const [usersWithPrefs] = await db.execute(`
                SELECT u.id, u.nombre, u.apellido, u.email, u.recibir_notificaciones
                FROM usuarios u
                WHERE u.recibir_notificaciones = 1
                ORDER BY u.id
                LIMIT 10
            `);

            return res.json({
                success: true,
                totalSubscriptions: allSubscriptions.length,
                subscriptions: allSubscriptions,
                usersWithPushEnabled: usersWithPrefs,
                totalUsersWithPush: usersWithPrefs.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('[DEBUG-SUBS] Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error verificando suscripciones: ' + error.message
            });
        }
    });

    // Endpoint simple para verificar estado de un usuario específico
    router.get('/debug-user/:userId', async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);

            console.log('[DEBUG-USER] === VERIFICANDO USUARIO ===');
            console.log('[DEBUG-USER] UserId:', userId);

            // Verificar usuario
            const [users] = await db.execute(
                'SELECT id, nombre, apellido, email, recibir_notificaciones FROM usuarios WHERE id = ?',
                [userId]
            );

            if (users.length === 0) {
                return res.json({
                    success: false,
                    message: 'Usuario no encontrado',
                    userId: userId
                });
            }

            const user = users[0];

            // Verificar suscripciones
            const [subscriptions] = await db.execute(
                'SELECT id, tipo_usuario, fecha_creacion FROM push_subscriptions WHERE usuario_id = ?',
                [userId]
            );

            // Verificar restaurante si es propietario
            const [restaurants] = await db.execute(
                'SELECT id, nombre FROM restaurantes WHERE usuario_id = ?',
                [userId]
            );

            return res.json({
                success: true,
                user: {
                    id: user.id,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    email: user.email,
                    recibir_notificaciones: user.recibir_notificaciones
                },
                subscriptions: subscriptions,
                subscriptionCount: subscriptions.length,
                restaurants: restaurants,
                restaurantCount: restaurants.length,
                hasActiveSubscription: subscriptions.length > 0,
                hasPushPreference: user.recibir_notificaciones === 1,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('[DEBUG-USER] Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error verificando usuario: ' + error.message
            });
        }
    });

    // Página de debug completa
    router.get('/debug', (req, res) => {
        console.log('[DEBUG-PAGE] Accediendo a página de debug de notificaciones push');
        res.render('push-debug', {
            title: 'Debug Notificaciones Push - A la Mesa',
            user: req.session && req.session.user ? req.session.user : null
        });
    });
}

// Exportar el router y las funciones por separado
module.exports = {
    router,
    sendNewOrderNotification,
    sendOrderStatusNotification,
    sendNotificationToUser,
    sendNotificationToRestaurant,
    sendNotificationToDriver
};
