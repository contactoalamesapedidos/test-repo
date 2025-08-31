const db = require('./config/database');
const webpush = require('web-push');
const vapidKeys = require('./config/vapid-keys.json');

// Configurar web-push
webpush.setVapidDetails(
    'mailto:info@a-la-mesa.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

async function simulateCompleteOrder() {
    try {
        console.log('=== SIMULANDO PEDIDO COMPLETO ===');
        
        // 1. Verificar si el usuario 27 tiene suscripción
        const [subscriptions] = await db.execute(`
            SELECT * FROM push_subscriptions WHERE usuario_id = 27
        `);
        
        console.log(`Suscripciones encontradas: ${subscriptions.length}`);
        
        if (subscriptions.length === 0) {
            console.log('❌ No hay suscripción para el usuario 27');
            console.log('Creando suscripción de prueba...');
            
            const testSubscription = {
                endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
                keys: {
                    p256dh: "test-p256dh-key",
                    auth: "test-auth-key"
                }
            };
            
            await db.execute(`
                INSERT INTO push_subscriptions (
                    usuario_id, 
                    tipo_usuario, 
                    subscription_data, 
                    fecha_creacion, 
                    fecha_actualizacion
                ) VALUES (27, 'restaurante', ?, NOW(), NOW())
            `, [JSON.stringify(testSubscription)]);
            
            console.log('✅ Suscripción de prueba creada');
        } else {
            console.log('✅ Usuario 27 tiene suscripción push');
            const sub = subscriptions[0];
            let dataStr = sub.subscription_data;
            if (typeof dataStr !== 'string') dataStr = JSON.stringify(dataStr);
            console.log('Datos de suscripción:', dataStr.substring(0, 100) + '...');
        }
        
        // 2. Simular datos del pedido
        const orderData = {
            id: 999,
            numero_pedido: 'ALM-TEST-' + Date.now(),
            restaurante_id: 11,
            cliente_id: 15,
            total: 25000,
            items: [
                { nombre: 'Hamburguesa Test', cantidad: 2, precio: 12500 }
            ]
        };
        
        console.log('\n📦 Simulando pedido:', orderData.numero_pedido);
        console.log('Restaurante ID:', orderData.restaurante_id);
        console.log('Total: $' + orderData.total);
        
        // 3. Obtener información del restaurante
        const [restaurants] = await db.execute(`
            SELECT r.*, u.nombre as propietario_nombre 
            FROM restaurantes r 
            JOIN usuarios u ON r.usuario_id = u.id 
            WHERE r.id = ?
        `, [orderData.restaurante_id]);
        
        if (restaurants.length === 0) {
            console.log('❌ Restaurante no encontrado');
            return;
        }
        
        const restaurant = restaurants[0];
        console.log('Restaurante:', restaurant.nombre);
        console.log('Propietario:', restaurant.propietario_nombre);
        console.log('Usuario ID del restaurante:', restaurant.usuario_id);
        
        // 4. Enviar notificación
        const notificationData = {
            title: '¡Nuevo Pedido!',
            body: `Pedido #${orderData.numero_pedido} - $${orderData.total.toFixed(2)}`,
            icon: '/images/logo.jpeg',
            badge: '/images/logo.jpeg',
            tag: 'new-order',
            data: {
                url: `/dashboard/orders`,
                orderId: orderData.id,
                type: 'new-order'
            },
            actions: [
                {
                    action: 'view',
                    title: 'Ver Pedido',
                    icon: '/images/logo.jpeg'
                },
                {
                    action: 'close',
                    title: 'Cerrar',
                    icon: '/images/logo.jpeg'
                }
            ]
        };
        
        console.log('\n📤 Enviando notificación...');
        console.log('Datos de notificación:', JSON.stringify(notificationData, null, 2));
        
        // 5. Obtener suscripción actualizada
        const [currentSubs] = await db.execute(`
            SELECT subscription_data FROM push_subscriptions WHERE usuario_id = ?
        `, [restaurant.usuario_id]);
        
        if (currentSubs.length > 0) {
            try {
                const subscription = JSON.parse(currentSubs[0].subscription_data);
                const payload = JSON.stringify(notificationData);
                
                console.log('Suscripción encontrada:', subscription.endpoint ? '✅' : '❌');
                
                await webpush.sendNotification(subscription, payload);
                console.log('✅ Notificación enviada exitosamente');
                console.log('📱 El restaurante debería recibir la notificación push');
                console.log('🔔 Título: ' + notificationData.title);
                console.log('📝 Mensaje: ' + notificationData.body);
                
            } catch (error) {
                console.log('❌ Error enviando notificación:', error.message);
                console.log('Esto es normal con una suscripción de prueba');
                console.log('Para notificaciones reales, activa desde el navegador');
            }
        } else {
            console.log('❌ No se encontró suscripción para enviar notificación');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

simulateCompleteOrder(); 