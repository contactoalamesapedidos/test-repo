// Service Worker para notificaciones push
const CACHE_NAME = 'a-la-mesa-v1';
const urlsToCache = [
    '/',
    '/css/style.css',
    '/js/app.js',
    '/js/push-notifications.js'
];

// Instalar el service worker
self.addEventListener('install', (event) => {
    console.log('Service Worker instalado');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache abierto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activar el service worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker activado');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Interceptar peticiones de red
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then(async (response) => {
                // Si la solicitud es exitosa, clonar la respuesta y guardarla en caché
                const responseClone = response.clone();
                const cache = await caches.open(CACHE_NAME);
                cache.put(event.request, responseClone);
                return response;
            })
            .catch(async () => {
                // Si la solicitud de red falla, intentar servir desde la caché
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Si no hay caché y la red falla, puedes devolver una respuesta de fallback o un error
                // Por ahora, simplemente logueamos el error y dejamos que falle
                console.error('Fallo la solicitud de red y no hay respuesta en caché:', event.request.url);
                // Puedes devolver una respuesta de error personalizada aquí si lo deseas
                // return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                throw new Error('Network request failed and no cache available.');
            })
    );
});

// Manejar notificaciones push
self.addEventListener('push', (event) => {
    console.log('Notificación push recibida:', event);
    
    let notificationData = {
        title: 'A la Mesa',
        body: 'Tienes una nueva notificación',
        icon: '/images/logo-a-la-mesa.png',
        badge: '/images/logo-a-la-mesa.png',
        tag: 'a-la-mesa-notification',
        requireInteraction: true,
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
            notificationData = {
                ...notificationData,
                ...data
            };
        } catch (error) {
            console.error('Error parseando datos de notificación:', error);
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
    );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
    console.log('Notificación clickeada:', event);
    
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
    console.log('Notificación cerrada:', event);
});

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
    console.log('Mensaje recibido en Service Worker:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
}); 