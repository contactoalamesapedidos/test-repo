el// Driver GPS Tracker - Para simular/envíar actualizaciones de ubicación GPS
class DriverGPSTracker {
    constructor() {
        this.watchId = null;
        this.isTracking = false;
        this.currentPosition = null;
        this.updateInterval = 5000; // 5 segundos
        this.intervalId = null;
    }

    // Iniciar seguimiento GPS
    startTracking() {
        if (this.isTracking) {
            return;
        }



        if ('geolocation' in navigator) {
            // Opciones para obtener ubicación más precisa
            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            };

            // Obtener posición inicial
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = position;
                    this.sendLocationUpdate(position.coords.latitude, position.coords.longitude);

                },
                (error) => {
                    console.error('Error getting initial position:', error);
                    this.fallbackToManualLocation();
                },
                options
            );

            // Configurar seguimiento continuo
            this.watchId = navigator.geolocation.watchPosition(
                (position) => {
                    this.currentPosition = position;
                    this.sendLocationUpdate(position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.error('Error watching position:', error);
                },
                options
            );

            this.isTracking = true;

        } else {
            console.error('Geolocation is not supported by this browser');
            this.fallbackToManualLocation();
        }
    }

    // Detener seguimiento GPS
    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isTracking = false;

    }

    // Enviar actualización de ubicación al servidor
    async sendLocationUpdate(latitude, longitude) {
        try {
            // Enviar actualización vía HTTP (mantener para compatibilidad)
            const response = await fetch('/repartidores/update-location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    latitude: latitude,
                    longitude: longitude
                })
            });

            const result = await response.json();

    // Enviar actualización vía WebSocket si está disponible
            if (window.socket && window.socket.connected) {
                const activeOrderId = document.getElementById('active-order-id')?.value;
                const driverId = document.getElementById('driver-id')?.value || driverData?.userId;

                // Enviar con driverId para que el servidor pueda encontrar pedidos activos automáticamente
                window.socket.emit('update-driver-location', {
                    orderId: activeOrderId, // Puede ser null/undefined
                    driverId: driverId,
                    latitude: latitude,
                    longitude: longitude
                });
            }

            if (result.success) {
                // Location updated successfully
            } else {
                console.error('Failed to update location:', result.message);
            }
        } catch (error) {
            console.error('Error sending location update:', error);
        }
    }

    // Fallback para ubicación manual (útil para testing)
    fallbackToManualLocation() {


        // Coordenadas de ejemplo - reemplazar con coordenadas reales
        let manualLat = -33.899541;
        let manualLng = -61.107330;

        this.intervalId = setInterval(() => {
            // Simular movimiento pequeño
            manualLat += (Math.random() - 0.5) * 0.001;
            manualLng += (Math.random() - 0.5) * 0.001;

            this.sendLocationUpdate(manualLat, manualLng);
        }, this.updateInterval);
    }

    // Obtener estado actual
    getStatus() {
        return {
            isTracking: this.isTracking,
            currentPosition: this.currentPosition,
            watchId: this.watchId
        };
    }
}

// Función global para controlar el tracker
let gpsTracker = null;

function startGPSTracking() {
    if (!gpsTracker) {
        gpsTracker = new DriverGPSTracker();
    }
    gpsTracker.startTracking();
}

function stopGPSTracking() {
    if (gpsTracker) {
        gpsTracker.stopTracking();
    }
}

function getGPSTrackingStatus() {
    if (gpsTracker) {
        return gpsTracker.getStatus();
    }
    return { isTracking: false };
}

// Auto-iniciar cuando se carga la página (solo para repartidores)
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si estamos en una página de repartidor
    if (window.location.pathname.includes('/repartidores')) {

        
        // Inicializar WebSocket
        window.socket = io();
        
        // Manejar conexión exitosa
        window.socket.on('connect', () => {
            window.socket.connected = true;
        });

        // Manejar desconexión
        window.socket.on('disconnect', () => {
            window.socket.connected = false;
        });

        // Inicializar el GPS tracker para repartidores
        if (!gpsTracker) {
            gpsTracker = new DriverGPSTracker();
        }

        // Iniciar seguimiento GPS automáticamente
        gpsTracker.startTracking();


    }
});
