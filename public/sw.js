// Service Worker para notificaciones push - Versión mejorada
console.log('[SW] Service Worker loaded and starting...');

// Instalar Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    self.skipWaiting();
});

// Activar Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Limpiar notificaciones antiguas
            self.registration.getNotifications().then(notifications => {
                notifications.forEach(notification => {
                    notification.close();
                });
            })
        ])
    );
    console.log('[SW] Service Worker activated and claimed clients');
});

// Manejar notificaciones push
self.addEventListener('push', (event) => {
    console.log('[SW] Push event received:', event);

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

    // Procesar datos de la notificación
    if (event.data) {
        console.log('[SW] Processing push data...');
        try {
            const data = event.data.json();
            console.log('[SW] Push data parsed as JSON:', data);
            notificationData = {
                ...notificationData,
                ...data
            };
        } catch (error) {
            console.warn('[SW] Could not parse push data as JSON, trying text:', error);
            try {
                const textData = event.data.text();
                if (textData) {
                    console.log('[SW] Push data as text:', textData);
                    notificationData.body = textData;
                }
            } catch (textError) {
                console.error('[SW] Could not parse push data as text either:', textError);
            }
        }
    } else {
        console.log('[SW] No data in push event');
    }

    // Verificar permisos antes de mostrar
    if (!('Notification' in self) || Notification.permission !== 'granted') {
        console.warn('[SW] Notification permission not granted or not supported');
        return;
    }

    console.log('[SW] Permission granted, showing notification...');

    // Asegurar que la notificación tenga propiedades para mostrarse siempre
    const enhancedNotificationData = {
        ...notificationData,
        requireInteraction: true,
        silent: false,
        renotify: true,
        timestamp: Date.now(),
        noscreen: false,
        sticky: true,
        data: {
            ...notificationData.data,
            receivedAt: new Date().toISOString()
        }
    };

    console.log('[SW] Enhanced notification data:', enhancedNotificationData);

    event.waitUntil(
        self.registration.showNotification(enhancedNotificationData.title, enhancedNotificationData)
            .then(() => {
                console.log('[SW] Notification shown successfully');

                // Enviar mensaje al cliente para confirmar
                return self.clients.matchAll().then(clients => {
                    console.log('[SW] Notifying', clients.length, 'clients about notification');
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'NOTIFICATION_SHOWN',
                            data: enhancedNotificationData
                        });
                    });
                });
            })
            .catch((error) => {
                console.error('[SW] Error showing notification:', error);

                // Intentar notificar al cliente sobre el error
                return self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'NOTIFICATION_ERROR',
                            error: error.message,
                            data: enhancedNotificationData
                        });
                    });
                });
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
