// Push Notifications Service
class PushNotificationService {
    constructor() {
        this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        this.registration = null;
        this.subscription = null;
    }

    async initialize() {
        if (!this.isSupported) {
            console.warn('[PUSH] Push notifications not supported in this browser');
            return false;
        }

        try {
            console.log('[PUSH] Initializing push notifications...');

            // Detectar navegador Edge
            const userAgent = navigator.userAgent.toLowerCase();
            const isEdge = userAgent.includes('edge') || userAgent.includes('edg');

            if (!('serviceWorker' in navigator)) {
                const errorMsg = isEdge ?
                    'Edge requiere HTTPS para Service Workers. Asegúrate de estar en una conexión segura.' :
                    'Service Worker no está soportado en este navegador';
                console.error('[PUSH]', errorMsg);
                return false;
            }

            if (!('PushManager' in window)) {
                const errorMsg = isEdge ?
                    'Edge no soporta PushManager. Intenta con Chrome o Firefox.' :
                    'PushManager no está soportado en este navegador';
                console.error('[PUSH]', errorMsg);
                return false;
            }

            // Verificar HTTPS para Edge
            if (isEdge && location.protocol !== 'https:' && location.hostname !== 'localhost') {
                console.warn('[PUSH] Edge requiere HTTPS para notificaciones push. Intentando continuar de todos modos...');
            }

            console.log('[PUSH] Checking for existing Service Workers...');

            // Verificar si ya hay un Service Worker registrado y activo
            const existingRegistrations = await navigator.serviceWorker.getRegistrations();
            console.log('[PUSH] Found', existingRegistrations.length, 'existing registrations');

            let existingActiveRegistration = null;
            for (const reg of existingRegistrations) {
                if (reg.active && reg.scope === location.origin + '/') {
                    existingActiveRegistration = reg;
                    console.log('[PUSH] Found active Service Worker:', reg.scope);
                    break;
                }
            }

            if (existingActiveRegistration) {
                console.log('[PUSH] Using existing active Service Worker');
                this.registration = existingActiveRegistration;
            } else {
                console.log('[PUSH] Registering new Service Worker...');

                // Limpiar registros antiguos que puedan estar causando conflictos
                for (const registration of existingRegistrations) {
                    try {
                        console.log('[PUSH] Unregistering old Service Worker:', registration.scope);
                        await registration.unregister();
                    } catch (unregisterError) {
                        console.warn('[PUSH] Error unregistering old SW:', unregisterError);
                    }
                }

                // Registrar nuevo Service Worker con mejor manejo de errores
                const registrationPromise = navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Service Worker registration timeout (8s)')), 8000);
                });

                this.registration = await Promise.race([registrationPromise, timeoutPromise]);
                console.log('[PUSH] Service Worker registered successfully:', this.registration.scope);
            }

            // Esperar a que el Service Worker esté completamente listo
            console.log('[PUSH] Waiting for Service Worker to be ready...');

            const readyTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Service Worker ready timeout')), 5000);
            });

            await Promise.race([navigator.serviceWorker.ready, readyTimeout]);
            console.log('[PUSH] Service Worker is ready');

            // Forzar activación si está esperando
            if (this.registration.waiting) {
                console.log('[PUSH] Activating waiting Service Worker...');
                this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            // Verificar estado final
            if (this.registration.active) {
                console.log('[PUSH] Service Worker is active and ready');
            } else {
                console.warn('[PUSH] Service Worker is not active yet, but continuing...');
            }

            // Obtener suscripción existente
            this.subscription = await this.registration.pushManager.getSubscription();
            if (this.subscription) {
                console.log('[PUSH] Found existing push subscription');
            } else {
                console.log('[PUSH] No existing push subscription found');
            }

            // Configurar listener para mensajes del Service Worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                console.log('[PUSH] Message from Service Worker:', event.data);
                if (event.data && event.data.type === 'NOTIFICATION_ERROR') {
                    console.error('[PUSH] Service Worker notification error:', event.data.error);
                }
            });

            console.log('[PUSH] Push notifications initialized successfully');
            return true;

        } catch (error) {
            console.error('[PUSH] Error initializing push notifications:', error);

            // Intentar limpiar registros problemáticos
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('[PUSH] Cleaned up problematic Service Worker registrations');
            } catch (cleanupError) {
                console.error('[PUSH] Error during cleanup:', cleanupError);
            }

            return false;
        }
    }

    async requestPermission() {
        if (!this.isSupported) {
            throw new Error('Las notificaciones push no están soportadas');
        }

        // Verificar el estado actual del permiso antes de solicitar
        let currentPermission = Notification.permission;

        // Si ya está concedido, continuar
        if (currentPermission === 'granted') {
            // Continuar
        }
        // Si está denegado, dar instrucciones claras
        else if (currentPermission === 'denied') {
            const browserInstructions = this.getBrowserInstructions();
            throw new Error(`Permiso de notificación denegado. ${browserInstructions}`);
        }
        // Si es default, intentar solicitar pero con manejo de errores mejorado
        else {
            try {
                const permission = await Notification.requestPermission();

                // Verificar el permiso inmediatamente después de obtenerlo
                currentPermission = Notification.permission;

                if (permission === 'denied' || currentPermission === 'denied') {
                    const browserInstructions = this.getBrowserInstructions();
                    throw new Error(`Permiso de notificación denegado. ${browserInstructions}`);
                } else if (permission === 'default' && currentPermission === 'default') {
                    // En algunos navegadores, "default" significa que no se preguntó pero puede funcionar
                    // Continuamos con el proceso
                } else if ((permission === 'granted' || currentPermission === 'granted')) {
                    // Permiso concedido
                }
            } catch (permissionError) {
                // Verificar si es un error específico de registro
                if (permissionError.name === 'NotAllowedError' || permissionError.message.includes('permission denied')) {
                    const browserInstructions = this.getBrowserInstructions();
                    throw new Error(`El navegador denegó el permiso para notificaciones. ${browserInstructions}`);
                }

                const browserInstructions = this.getBrowserInstructions();
                throw new Error(`Error solicitando permisos: ${permissionError.message}. ${browserInstructions}`);
            }
        }

        const response = await fetch('/api/push/vapid-public-key');
        if (!response.ok) {
            throw new Error('Error obteniendo clave VAPID: ' + response.status);
        }
        const vapidPublicKey = await response.text();

        const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);

        this.subscription = await this.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        await this.sendSubscriptionToServer(this.subscription);

        return true;
    } catch (error) {
        throw error;
    }

    // Método para obtener instrucciones específicas del navegador
    getBrowserInstructions() {
        const userAgent = navigator.userAgent.toLowerCase();

        if (userAgent.includes('edge') || userAgent.includes('edg')) {
            return 'En Microsoft Edge: 1) Haz clic en el candado 🔒 en la barra de direcciones, 2) Selecciona "Configuración del sitio", 3) En "Permisos", cambia "Notificaciones" a "Permitir". Si aún no funciona, intenta con Chrome o Firefox.';
        } else if (userAgent.includes('chrome')) {
            return 'En Chrome: 1) Haz clic en el candado 🔒 en la barra de direcciones, 2) Selecciona "Configuración del sitio", 3) Cambia "Notificaciones" a "Permitir".';
        } else if (userAgent.includes('firefox')) {
            return 'En Firefox: 1) Haz clic en el escudo 🛡️ en la barra de direcciones, 2) Selecciona "Permitir notificaciones".';
        } else {
            return 'Habilita las notificaciones en la configuración de tu navegador para este sitio.';
        }
    }

    async sendSubscriptionToServer(subscription) {
        try {
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscription: subscription,
                    userId: this.getUserId(),
                    userType: this.getUserType()
                })
            });

            if (!response.ok) {
                throw new Error('Error del servidor: ' + response.status);
            }

            const result = await response.json();

            if (result.success) {
                return true;
            } else {
                throw new Error(result.message || 'Error guardando suscripción');
            }
        } catch (error) {
            throw error;
        }
    }

    async unsubscribe() {
        if (this.subscription) {
            try {
                await this.subscription.unsubscribe();
                this.subscription = null;

                await fetch('/api/push/unsubscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: this.getUserId()
                    })
                });

                return true;
            } catch (error) {
                throw error;
            }
        }
        return false;
    }

    isEnabled() {
        const enabled = Notification.permission === 'granted' && this.subscription !== null;
        return enabled;
    }

    getUserId() {
        const userData = document.getElementById('user-data-script');

        if (userData && userData.textContent.trim() !== '') {
            try {
                const user = JSON.parse(userData.textContent);
                return user.id;
            } catch (error) {
                // Error silencioso
            }
        }
        return null;
    }

    getUserType() {
        const userData = document.getElementById('user-data-script');

        if (userData && userData.textContent.trim() !== '') {
            try {
                const user = JSON.parse(userData.textContent);
                return user.tipo_usuario;
            } catch (error) {
                // Error silencioso
            }
        }
        return null;
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

// Inicializar el servicio globalmente
window.pushNotificationService = new PushNotificationService();

// Función para habilitar notificaciones
window.enablePushNotifications = async function() {
    try {
        const success = await window.pushNotificationService.initialize();

        if (success && window.pushNotificationService.isEnabled()) {
            if (typeof window.showToast === 'function') {
                window.showToast('Las notificaciones push ya están habilitadas', 'info');
            } else {
                alert('Las notificaciones push ya están habilitadas');
            }
            return;
        }

        await window.pushNotificationService.requestPermission();

        if (typeof window.showToast === 'function') {
            window.showToast('Notificaciones push habilitadas exitosamente', 'success');
        } else {
            alert('Notificaciones push habilitadas exitosamente');
        }

        updateNotificationUI(true);
    } catch (error) {
        const message = 'Error habilitando notificaciones: ' + error.message;
        if (typeof window.showToast === 'function') {
            window.showToast(message, 'error');
        } else {
            alert(message);
        }
    }
};

// Función para deshabilitar notificaciones
window.disablePushNotifications = async function() {
    try {
        await window.pushNotificationService.unsubscribe();

        if (typeof window.showToast === 'function') {
            window.showToast('Notificaciones push deshabilitadas', 'success');
        } else {
            alert('Notificaciones push deshabilitadas');
        }

        updateNotificationUI(false);
    } catch (error) {
        if (typeof window.showToast === 'function') {
            window.showToast('Error deshabilitando notificaciones', 'error');
        } else {
            alert('Error deshabilitando notificaciones');
        }
    }
};

// Función para actualizar la UI
function updateNotificationUI(enabled) {
    const enableBtn = document.getElementById('enableNotifications');
    const disableBtn = document.getElementById('disableNotifications');
    const statusText = document.getElementById('notificationStatus');
    
    if (enableBtn) enableBtn.style.display = enabled ? 'none' : 'block';
    if (disableBtn) disableBtn.style.display = enabled ? 'block' : 'none';
    if (statusText) {
        statusText.textContent = enabled ? 'Habilitadas' : 'Deshabilitadas';
        statusText.className = enabled ? 'text-success' : 'text-muted';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    if (window.pushNotificationService) {
        await window.pushNotificationService.initialize();
        updateNotificationUI(window.pushNotificationService.isEnabled());

        // Intentar suscripción automática para clientes
        await attemptAutoSubscribeForClients();
    }

    // Escuchar mensajes del Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function(event) {
            if (event.data.type === 'NOTIFICATION_ERROR') {
                // Mostrar notificación alternativa
                showFallbackNotification(event.data.data);
            }
        });
    }
});

// Función para intentar suscripción automática de clientes
async function attemptAutoSubscribeForClients() {
    try {
        const userType = window.pushNotificationService.getUserType();
        const userId = window.pushNotificationService.getUserId();

        console.log('[PUSH] UserType:', userType, 'UserId:', userId);

        // Solo para clientes
        if (userType !== 'cliente' || !userId) {
            console.log('[PUSH] No es cliente o no hay userId, saliendo...');
            return;
        }

        console.log('[PUSH] Verificando suscripción automática para cliente:', userId);

        // Verificar si ya tiene suscripción activa
        const isEnabled = window.pushNotificationService.isEnabled();
        console.log('[PUSH] ¿Suscripción ya activa?:', isEnabled);

        if (isEnabled) {
            console.log('[PUSH] Cliente ya tiene suscripción activa');
            return;
        }

        // Verificar permisos del navegador
        const permissionStatus = Notification.permission;
        console.log('[PUSH] Estado del permiso de notificaciones:', permissionStatus);

        // Si el permiso está denegado, no intentar suscribir
        if (permissionStatus === 'denied') {
            console.log('[PUSH] Permiso denegado por el navegador, no se puede suscribir automáticamente');
            return;
        }

        // Verificar preferencias del usuario desde el servidor
        console.log('[PUSH] Consultando estado de notificaciones desde servidor...');
        const response = await fetch('/api/push/status', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin' // Importante para enviar cookies de sesión
        });

        if (!response.ok) {
            console.log('[PUSH] ❌ Error consultando estado:', response.status, response.statusText);
            return;
        }

        const status = await response.json();
        console.log('[PUSH] Estado recibido del servidor:', status);

        if (status.hasPushPreference && !status.hasSubscriptions) {
            console.log('[PUSH] ✅ Cliente tiene preferencia activada pero no suscripción. Intentando suscripción automática...');

            try {
                // Intentar suscribir automáticamente
                await window.pushNotificationService.requestPermission();
                console.log('[PUSH] ✅ Suscripción automática exitosa para cliente');

                // Actualizar UI
                updateNotificationUI(true);

                // Mostrar mensaje sutil de éxito (opcional)
                if (typeof window.showToast === 'function') {
                    window.showToast('Notificaciones push activadas automáticamente', 'success');
                }

            } catch (subscribeError) {
                console.log('[PUSH] ⚠️ Suscripción automática falló:', subscribeError.message);
                console.log('[PUSH] Detalles del error:', subscribeError);

                // No mostrar error al usuario, es normal que falle en algunos casos
                // El usuario podrá activar manualmente desde la configuración
            }
        } else if (status.hasSubscriptions) {
            console.log('[PUSH] Cliente ya tiene suscripciones registradas');
        } else {
            console.log('[PUSH] Cliente no tiene preferencia de notificaciones activada');
        }

    } catch (error) {
        console.log('[PUSH] ❌ Error en suscripción automática:', error.message);
        console.log('[PUSH] Stack trace:', error.stack);
        // Error silencioso, no molestar al usuario
    }
}

// Función para mostrar notificación alternativa cuando la nativa falla
function showFallbackNotification(notificationData) {
    // Crear notificación HTML en la página
    const notificationHtml = `
        <div id="fallback-notification" class="alert alert-info alert-dismissible fade show position-fixed"
             style="top: 20px; right: 20px; z-index: 9999; min-width: 300px; max-width: 400px;">
            <div class="d-flex align-items-center">
                <img src="${notificationData.icon || '/images/logo-a-la-mesa.png'}"
                     alt="Logo" class="me-3 rounded" width="40" height="40">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${notificationData.title || 'Notificación'}</h6>
                    <p class="mb-1 small">${notificationData.body || 'Tienes una nueva notificación'}</p>
                    <small class="text-muted">${new Date().toLocaleTimeString()}</small>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        </div>
    `;

    // Agregar al DOM
    document.body.insertAdjacentHTML('beforeend', notificationHtml);

    // Auto-cerrar después de 10 segundos
    setTimeout(() => {
        const notification = document.getElementById('fallback-notification');
        if (notification) {
            notification.remove();
        }
    }, 10000);
}
