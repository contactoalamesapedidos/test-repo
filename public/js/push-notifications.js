// Push Notifications Service - Versión simplificada y mejorada
console.log('=== CARGANDO PUSH NOTIFICATIONS SERVICE ===');

class PushNotificationService {
    constructor() {
        console.log('Inicializando PushNotificationService...');
        this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        console.log('Soporte detectado:', this.isSupported);
        this.registration = null;
        this.subscription = null;
    }

    async initialize() {
        console.log('Inicializando servicio de notificaciones...');
        
        if (!this.isSupported) {
            console.log('❌ Las notificaciones push no están soportadas en este navegador');
            return false;
        }

        try {
            console.log('Registrando Service Worker...');
            this.registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker registrado:', this.registration);

            this.subscription = await this.registration.pushManager.getSubscription();
            
            if (this.subscription) {
                console.log('✅ Suscripción existente encontrada');
                return true;
            }

            console.log('ℹ️ No hay suscripción existente');
            return false;
        } catch (error) {
            console.error('❌ Error inicializando notificaciones push:', error);
            return false;
        }
    }

    async requestPermission() {
        console.log('Solicitando permisos de notificación...');
        
        if (!this.isSupported) {
            throw new Error('Las notificaciones push no están soportadas');
        }

        try {
            console.log('Solicitando permiso de Notification...');
            const permission = await Notification.requestPermission();
            console.log('Permiso obtenido:', permission);
            
            if (permission !== 'granted') {
                throw new Error('Permiso de notificación denegado');
            }

            console.log('Obteniendo clave VAPID...');
            const response = await fetch('/api/push/vapid-public-key');
            if (!response.ok) {
                throw new Error('Error obteniendo clave VAPID: ' + response.status);
            }
            const vapidPublicKey = await response.text();
            console.log('✅ Clave VAPID obtenida');

            const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);

            console.log('Creando suscripción push...');
            this.subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            console.log('✅ Suscripción creada:', this.subscription);

            await this.sendSubscriptionToServer(this.subscription);

            return true;
        } catch (error) {
            console.error('❌ Error solicitando permisos:', error);
            throw error;
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

// Utilidad para mostrar toasts
if (!window.showToast) {
    window.showToast = function(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    };
}

console.log('✅ Push Notifications Service cargado correctamente'); 