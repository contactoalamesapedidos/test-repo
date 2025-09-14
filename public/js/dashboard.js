// Dashboard - JavaScript Optimizado

// Función para cambiar el estado del restaurante
async function toggleRestaurantStatus() {
    const statusElement = document.querySelector('[data-restaurant-status]');
    if (!statusElement) {
        console.error('Elemento de estado no encontrado');
        return;
    }
    
    const isActive = statusElement.dataset.restaurantStatus === 'true';
    const accion = isActive ? 'desactivar' : 'activar';
    
    try {
        const response = await fetch('/dashboard/toggle-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ accion })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            location.reload();
        } else {
            console.error('Error:', data.message);
            showToast(data.message || 'Error al cambiar el estado', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error de conexión al cambiar el estado', 'danger');
    }
}

// Toast notification helper
function showToast(message, type = 'success') {
    const toastId = `toast_${Date.now()}`;
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-bg-${type === 'success' ? 'success' : 'danger'} border-0 mb-2" 
             role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="3000">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>`;
    
    let container = document.querySelector('.toast-container') || document.querySelector('#toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = 2000;
        document.body.appendChild(container);
    }
    
    container.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const toast = new bootstrap.Toast(toastEl);
            toast.show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        } else {
            setTimeout(() => toastEl.remove(), 2000);
        }
    } catch (e) {
        console.error('Error mostrando toast:', e);
        setTimeout(() => toastEl.remove(), 2000);
    }
}

// Push Notifications
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
            this.registration = await navigator.serviceWorker.register('/sw.js');
            this.subscription = await this.registration.pushManager.getSubscription();
            return this.subscription !== null;
        } catch (error) {
            console.error('Error inicializando notificaciones push:', error);
            return false;
        }
    }

    async requestPermission() {
        if (!this.isSupported) {
            throw new Error('Las notificaciones push no están soportadas');
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Permiso de notificación denegado');
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
            console.error('Error solicitando permisos:', error);
            throw error;
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
            
            if (!result.success) {
                throw new Error(result.message || 'Error guardando suscripción');
            }
            return true;
        } catch (error) {
            console.error('Error enviando suscripción al servidor:', error);
            throw error;
        }
    }

    isEnabled() {
        return Notification.permission === 'granted' && this.subscription !== null;
    }

    getUserId() {
        const userData = document.querySelector('script[data-user]');
        if (userData && userData.textContent.trim() !== '') {
            try {
                const user = JSON.parse(userData.textContent);
                return user.id;
            } catch (error) {
                console.error('Error parseando datos del usuario:', error);
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
                console.error('Error parseando datos del usuario:', error);
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

window.pushNotificationService = new PushNotificationService();

document.addEventListener('DOMContentLoaded', async function() {
    if (window.pushNotificationService) {
        await window.pushNotificationService.initialize();
        if (!window.pushNotificationService.isEnabled()) {
            // Automatically request permission if not granted
            // window.enablePushNotifications();
        }
    }
}); 