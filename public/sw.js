// Service Worker para notificaciones push - Versión simplificada
console.log('Service Worker cargado correctamente - Versión mejorada');

// Instalar el service worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker instalándose...');
    console.log('📍 Origen:', self.location.origin);
    console.log('🔗 URL del SW:', self.location.href);
    self.skipWaiting(); // Forzar activación inmediata
});

// Activar el service worker
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker activándose...');
    console.log('📊 Estado del SW:', self.serviceWorker ? 'Disponible' : 'No disponible');
    event.waitUntil(self.clients.claim()); // Tomar control inmediato
});

// Manejar notificaciones push
self.addEventListener('push', (event) => {
    console.log('📨 Notificación push recibida');
    console.log('📊 Datos del evento:', event);
    console.log('📝 Datos de la notificación:', event.data ? event.data.text() : 'Sin datos');

    let notificationData = {
        title: 'A la Mesa',
        body: 'Tienes una nueva notificación',
        icon: '/images/logo-a-la-mesa.png',
        badge: '/images/logo-a-la-mesa.png',
        tag: 'a-la-mesa-notification',
        requireInteraction: true,
        silent: false,
        actions: [
            {
                action: 'view',
                title: 'Ver',
                icon: '/images/logo-a-la-mesa.png'
            },
            {
                action: 'close',
                title: 'Cerrar',
                icon: '/images/logo-a-la-mesa.png'
            }
        ]
    };

    // Si hay datos en la notificación, usarlos
    if (event.data) {
        try {
            const data = event.data.json();
            console.log('📋 Datos JSON parseados:', data);
            notificationData = {
                ...notificationData,
                ...data
            };
        } catch (error) {
            console.error('❌ Error parseando datos de notificación:', error);
            // Si no se puede parsear como JSON, intentar como texto plano
            try {
                const textData = event.data.text();
                if (textData) {
                    notificationData.body = textData;
                }
            } catch (textError) {
                console.error('❌ Error obteniendo datos como texto:', textError);
            }
        }
    }

    console.log('🔔 Mostrando notificación con datos:', notificationData);

    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
            .then(() => {
                console.log('✅ Notificación mostrada exitosamente');
            })
            .catch((error) => {
                console.error('❌ Error mostrando notificación:', error);
                console.error('❌ Detalles del error:', error.message);
                console.error('❌ Stack trace:', error.stack);
            })
    );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Obtener la URL de la notificación
    let targetUrl = '/dashboard/orders';
    if (event.notification && event.notification.data && event.notification.data.url) {
        targetUrl = event.notification.data.url;
    }
    // Por compatibilidad, intentar también con event.notification.url
    if (event.notification && event.notification.url) {
        targetUrl = event.notification.url;
    }

    // Si la acción es 'view', abrir la URL del pedido
    if (event.action === 'view') {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        if (client.url.includes(targetUrl)) {
                            return client.focus();
                        }
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
        );
        return;
    }

    // Por defecto, abrir la URL del pedido o listado
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    if (client.url.includes(targetUrl)) {
                        return client.focus();
                    }
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Manejar cierre de notificaciones
self.addEventListener('notificationclose', (event) => {
    // Notificación cerrada
});

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
