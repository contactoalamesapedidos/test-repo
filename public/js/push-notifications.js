// Push Notifications Service - Versión simplificada y mejorada


class PushNotificationService {
    constructor() {
        this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        this.registration = null;
        this.subscription = null;
    }

    async initialize() {
        if (!this.isSupported) {
            return false;
        }

        try {
            // Detectar navegador Edge
            const userAgent = navigator.userAgent.toLowerCase();
            const isEdge = userAgent.includes('edge') || userAgent.includes('edg');
            console.log('Navegador detectado:', isEdge ? 'Edge' : 'Otro', 'UserAgent:', userAgent);

            if (!('serviceWorker' in navigator)) {
                const errorMsg = isEdge ?
                    'Edge requiere HTTPS para Service Workers. Asegúrate de estar en una conexión segura.' :
                    'Service Worker no está soportado en este navegador';
                throw new Error(errorMsg);
            }

            if (!('PushManager' in window)) {
                const errorMsg = isEdge ?
                    'Edge no soporta PushManager. Intenta con Chrome o Firefox.' :
                    'PushManager no está soportado en este navegador';
                throw new Error(errorMsg);
            }

            // Verificar HTTPS para Edge
            if (isEdge && location.protocol !== 'https:' && location.hostname !== 'localhost') {
                throw new Error('Edge requiere HTTPS para notificaciones push. Debes estar en una conexión segura.');
            }

            // Intentar desregistrar cualquier Service Worker anterior que pueda estar causando conflictos
            const existingRegistrations = await navigator.serviceWorker.getRegistrations();

            // Desregistrar Service Workers con timeout para evitar hangs
            for (const registration of existingRegistrations) {
                try {
                    const unregisterPromise = registration.unregister();
                    const unregisterTimeout = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Unregister timeout')), 2000);
                    });

                    await Promise.race([unregisterPromise, unregisterTimeout]);
                } catch (unregisterError) {
                    console.warn('⚠️ Error desregistrando Service Worker (continuando):', unregisterError.message);
                    // Continuar de todos modos, no es crítico
                }
            }

            console.log('🌐 Registrando Service Worker...');
            console.log('📍 URL actual:', window.location.href);
            console.log('🔒 Protocolo:', window.location.protocol);
            console.log('🏠 Hostname:', window.location.hostname);

            // Verificar si estamos en un entorno seguro
            const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
            console.log('🔐 Entorno seguro:', isSecure);

            if (!isSecure) {
                console.warn('⚠️ Advertencia: Las notificaciones push requieren HTTPS en producción');
            }

            // Agregar timeout más corto para detectar problemas rápidamente
            const registrationPromise = navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });

            console.log('⏳ Esperando registro del Service Worker...');

            // Crear timeout de 5 segundos (más corto para detectar problemas)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout: Service Worker registration took too long (5s)')), 5000);
            });

            this.registration = await Promise.race([registrationPromise, timeoutPromise]);

            console.log('✅ Service Worker registrado exitosamente');
            console.log('📋 Detalles del registro:', {
                scope: this.registration.scope,
                active: !!this.registration.active,
                installing: !!this.registration.installing,
                waiting: !!this.registration.waiting
            });

            // Verificar que el Service Worker esté listo con timeout más corto
            const activationTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout: Service Worker activation took too long')), 3000);
            });

            const activationPromise = new Promise(async (resolve) => {
                if (this.registration.installing) {
                    this.registration.installing.addEventListener('statechange', (event) => {
                        if (event.target.state === 'activated') {
                            resolve();
                        }
                    });
                } else if (this.registration.waiting) {
                    // Forzar activación del Service Worker en espera
                    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    this.registration.waiting.addEventListener('statechange', (event) => {
                        if (event.target.state === 'activated') {
                            resolve();
                        }
                    });
                } else if (this.registration.active) {
                    resolve();
                } else {
                    // Intentar forzar activación
                    if (this.registration.installing) {
                        this.registration.installing.postMessage({ type: 'SKIP_WAITING' });
                    }
                    resolve(); // Continuar de todos modos
                }
            });

            await Promise.race([activationPromise, activationTimeout]);

            this.subscription = await this.registration.pushManager.getSubscription();

            return true;
        } catch (error) {
            console.error('❌ Error inicializando notificaciones push:', error);
            console.error('Tipo de error:', error.constructor.name);
            console.error('Mensaje de error:', error.message);
            console.error('Stack trace:', error.stack);

            // Intentar limpiar cualquier registro anterior si hay error
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    console.log('Desregistrando Service Worker por error:', registration.scope);
                    await registration.unregister();
                }
            } catch (unregisterError) {
                console.error('Error desregistrando Service Workers:', unregisterError);
            }

            return false;
        }
    }

    async requestPermission() {
        console.log('=== SOLICITANDO PERMISOS DE NOTIFICACIÓN ===');

        if (!this.isSupported) {
            throw new Error('Las notificaciones push no están soportadas');
        }

        // Verificar el estado actual del permiso antes de solicitar
        let currentPermission = Notification.permission;
        console.log('🔍 Permiso actual del navegador:', currentPermission);
        console.log('🌐 Protocolo:', location.protocol);
        console.log('🏠 Hostname:', location.hostname);

        // Si ya está concedido, continuar
        if (currentPermission === 'granted') {
            console.log('✅ Permiso ya concedido, continuando...');
        }
        // Si está denegado, dar instrucciones claras
        else if (currentPermission === 'denied') {
            console.log('❌ Permiso denegado por el navegador');
            const browserInstructions = this.getBrowserInstructions();
            throw new Error(`Permiso de notificación denegado. ${browserInstructions}`);
        }
        // Si es default, intentar solicitar pero con manejo de errores mejorado
        else {
            try {
                console.log('📝 Solicitando permiso de Notification...');
                const permission = await Notification.requestPermission();
                console.log('📋 Permiso obtenido:', permission);

                // Verificar el permiso inmediatamente después de obtenerlo
                currentPermission = Notification.permission;
                console.log('🔄 Permiso actual después de solicitud:', currentPermission);

                if (permission === 'denied' || currentPermission === 'denied') {
                    console.log('❌ Usuario denegó el permiso o navegador lo cambió automáticamente');
                    const browserInstructions = this.getBrowserInstructions();
                    throw new Error(`Permiso de notificación denegado. ${browserInstructions}`);
                } else if (permission === 'default' && currentPermission === 'default') {
                    console.log('⚠️ Permiso en estado "default" - el usuario no tomó decisión. Continuando de todos modos...');
                    // En algunos navegadores, "default" significa que no se preguntó pero puede funcionar
                    // Continuamos con el proceso
                } else if ((permission === 'granted' || currentPermission === 'granted')) {
                    console.log('✅ Permiso concedido explícitamente');
                } else {
                    console.log('⚠️ Estado de permiso inesperado:', { permission, currentPermission });
                }
            } catch (permissionError) {
                console.error('❌ Error en requestPermission:', permissionError);
                console.error('❌ Tipo de error:', permissionError.name);
                console.error('❌ Mensaje de error:', permissionError.message);

                // Verificar si es un error específico de registro
                if (permissionError.name === 'NotAllowedError' || permissionError.message.includes('permission denied')) {
                    console.log('🚫 Error de permisos - navegador denegó el acceso');
                    const browserInstructions = this.getBrowserInstructions();
                    throw new Error(`El navegador denegó el permiso para notificaciones. ${browserInstructions}`);
                }

                const browserInstructions = this.getBrowserInstructions();
                throw new Error(`Error solicitando permisos: ${permissionError.message}. ${browserInstructions}`);
            }
        }

        console.log('Obteniendo clave VAPID...');
        const response = await fetch('/api/push/vapid-public-key');
        console.log('Respuesta VAPID status:', response.status);
        if (!response.ok) {
            throw new Error('Error obteniendo clave VAPID: ' + response.status);
        }
        const vapidPublicKey = await response.text();
        console.log('✅ Clave VAPID obtenida:', vapidPublicKey.substring(0, 20) + '...');

        const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);
        console.log('Clave VAPID convertida, longitud:', convertedVapidKey.length);

        console.log('Creando suscripción push...');
        console.log('Registration disponible:', !!this.registration);
        console.log('PushManager disponible:', !!this.registration?.pushManager);

        this.subscription = await this.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        console.log('✅ Suscripción creada:', this.subscription);
        console.log('Endpoint de suscripción:', this.subscription?.endpoint);

        console.log('Enviando suscripción al servidor...');
        await this.sendSubscriptionToServer(this.subscription);

        return true;
    } catch (error) {
        console.error('❌ Error solicitando permisos:', error);
        console.error('Stack trace:', error.stack);
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
            console.log('Enviando suscripción al servidor...');
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
                console.log('✅ Suscripción guardada en el servidor');
                return true;
            } else {
                throw new Error(result.message || 'Error guardando suscripción');
            }
        } catch (error) {
            console.error('❌ Error enviando suscripción al servidor:', error);
            throw error;
        }
    }

    async unsubscribe() {
        if (this.subscription) {
            try {
                console.log('Cancelando suscripción...');
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

                console.log('✅ Suscripción cancelada');
                return true;
            } catch (error) {
                console.error('❌ Error cancelando suscripción:', error);
                throw error;
            }
        }
        return false;
    }

    isEnabled() {
        const enabled = Notification.permission === 'granted' && this.subscription !== null;
        console.log('Estado de notificaciones:', enabled);
        return enabled;
    }

    getUserId() {
        const userData = document.querySelector('script[data-user]');
        
        if (userData && userData.textContent.trim() !== '') {
            try {
                const user = JSON.parse(userData.textContent);
                return user.id;
            } catch (error) {
                console.error('❌ Error parseando datos del usuario:', error);
            }
        }
        return null;
    }

    getUserType() {
        const userData = document.querySelector('script[data-user]');
        
        if (userData && userData.textContent.trim() !== '') {
            try {
                const user = JSON.parse(userData.textContent);
                return user.tipo_usuario;
            } catch (error) {
                console.error('❌ Error parseando datos del usuario:', error);
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
console.log('Creando instancia global de PushNotificationService...');
window.pushNotificationService = new PushNotificationService();

// Función para habilitar notificaciones
window.enablePushNotifications = async function() {
    console.log('=== HABILITANDO NOTIFICACIONES PUSH ===');
    try {
        const success = await window.pushNotificationService.initialize();
        
        if (success && window.pushNotificationService.isEnabled()) {
            console.log('✅ Las notificaciones push ya están habilitadas');
            if (typeof window.showToast === 'function') {
                window.showToast('Las notificaciones push ya están habilitadas', 'info');
            } else {
                alert('Las notificaciones push ya están habilitadas');
            }
            return;
        }

        await window.pushNotificationService.requestPermission();
        console.log('✅ Notificaciones push habilitadas exitosamente');
        
        if (typeof window.showToast === 'function') {
            window.showToast('Notificaciones push habilitadas exitosamente', 'success');
        } else {
            alert('Notificaciones push habilitadas exitosamente');
        }
        
        updateNotificationUI(true);
    } catch (error) {
        console.error('❌ Error habilitando notificaciones:', error);
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
        console.log('✅ Notificaciones push deshabilitadas');
        
        if (typeof window.showToast === 'function') {
            window.showToast('Notificaciones push deshabilitadas', 'success');
        } else {
            alert('Notificaciones push deshabilitadas');
        }
        
        updateNotificationUI(false);
    } catch (error) {
        console.error('❌ Error deshabilitando notificaciones:', error);
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
    console.log('DOM cargado, inicializando notificaciones push...');
    if (window.pushNotificationService) {
        await window.pushNotificationService.initialize();
        updateNotificationUI(window.pushNotificationService.isEnabled());
    } else {
        console.log('❌ PushNotificationService no está disponible');
    }
});

// Función para diagnosticar el estado del Service Worker
window.diagnoseServiceWorker = async function() {
    console.log('🔍 === DIAGNÓSTICO DE SERVICE WORKER ===');

    if (!('serviceWorker' in navigator)) {
        console.error('❌ Service Worker no soportado en este navegador');
        return;
    }

    try {
        // Verificar registros existentes
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('📋 Registros de SW encontrados:', registrations.length);

        for (const reg of registrations) {
            console.log('🔧 Registro SW:', {
                scope: reg.scope,
                state: reg.active ? 'activo' : (reg.installing ? 'instalando' : 'esperando'),
                url: reg.active ? reg.active.scriptURL : 'N/A'
            });
        }

        // Verificar suscripción push
        if (window.pushNotificationService && window.pushNotificationService.registration) {
            const subscription = await window.pushNotificationService.registration.pushManager.getSubscription();
            console.log('📨 Suscripción push:', subscription ? 'EXISTE' : 'NO EXISTE');
            if (subscription) {
                console.log('🔗 Endpoint:', subscription.endpoint);
            }
        }

        // Verificar permisos
        const permission = Notification.permission;
        console.log('🔔 Permiso de notificaciones:', permission);

        // Verificar si estamos en HTTPS
        const isHttps = location.protocol === 'https:' || location.hostname === 'localhost';
        console.log('🔒 HTTPS/Localhost:', isHttps);

        console.log('✅ Diagnóstico completado');

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
};

// Utilidad para mostrar toasts
if (!window.showToast) {
    window.showToast = function(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    };
}

console.log('✅ Push Notifications Service cargado correctamente - Versión mejorada');
