// Mapa de seguimiento en tiempo real para dashboard de órdenes
let orderTrackingMap = null;
let driverTrackingMarker = null;
let restaurantTrackingMarker = null;
let clientTrackingMarker = null;
let trackingRouteLines = [];
let currentDriverPosition = null;

function initOrderTrackingMap() {
    const mapContainer = document.getElementById('order-tracking-map');
    if (!mapContainer) {
        console.log('Order tracking map container not found');
        return;
    }

    // Limpiar mapa anterior si existe
    if (orderTrackingMap) {
        orderTrackingMap.remove();
        orderTrackingMap = null;
    }

    // Obtener datos del mapa
    const orderId = mapContainer.dataset.orderId;
    const driverId = mapContainer.dataset.driverId;
    const driverLat = parseFloat(mapContainer.dataset.driverLat) || null;
    const driverLng = parseFloat(mapContainer.dataset.driverLng) || null;
    const clienteLat = parseFloat(mapContainer.dataset.clienteLat);
    const clienteLng = parseFloat(mapContainer.dataset.clienteLng);
    const restauranteLat = parseFloat(mapContainer.dataset.restauranteLat) || null;
    const restauranteLng = parseFloat(mapContainer.dataset.restauranteLng) || null;

    console.log('Initializing order tracking map with data:', {
        orderId, driverId, driverLat, driverLng, clienteLat, clienteLng, restauranteLat, restauranteLng
    });

    // Determinar centro inicial del mapa
    let centerLat = clienteLat;
    let centerLng = clienteLng;
    let zoomLevel = 14;

    if (driverLat && driverLng && !isNaN(driverLat) && !isNaN(driverLng)) {
        centerLat = driverLat;
        centerLng = driverLng;
        zoomLevel = 16;
    } else if (restauranteLat && restauranteLng && !isNaN(restauranteLat) && !isNaN(restauranteLng)) {
        centerLat = restauranteLat;
        centerLng = restauranteLng;
        zoomLevel = 15;
    }

    // Inicializar mapa
    orderTrackingMap = L.map('order-tracking-map', {
        center: [centerLat, centerLng],
        zoom: zoomLevel,
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        keyboardPanDelta: 80
    });

    // Agregar capa de tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(orderTrackingMap);

    // Array para almacenar marcadores
    const markers = [];

    // Crear marcador del cliente (siempre visible)
    if (!isNaN(clienteLat) && !isNaN(clienteLng)) {
        const clientIcon = L.divIcon({
            html: `
                <div style="
                    background-color: #dc3545;
                    border: 2px solid #fff;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                ">
                    <span style="
                        font-size: 16px;
                        color: white;
                    ">🏠</span>
                </div>
            `,
            className: 'custom-client-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });

        clientTrackingMarker = L.marker([clienteLat, clienteLng], { icon: clientIcon })
            .addTo(orderTrackingMap)
            .bindPopup('📍 Ubicación de Entrega');
        markers.push(clientTrackingMarker);
    }

    // Crear marcador del restaurante (si está disponible)
    if (restauranteLat && restauranteLng && !isNaN(restauranteLat) && !isNaN(restauranteLng)) {
        const restaurantIcon = L.divIcon({
            html: `
                <div style="
                    background-color: #28a745;
                    border: 2px solid #fff;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                ">
                    <span style="
                        font-size: 16px;
                        color: white;
                    ">🏪</span>
                </div>
            `,
            className: 'custom-restaurant-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });

        restaurantTrackingMarker = L.marker([restauranteLat, restauranteLng], { icon: restaurantIcon })
            .addTo(orderTrackingMap)
            .bindPopup('🏪 Restaurante');
        markers.push(restaurantTrackingMarker);
    }

    // Crear marcador del repartidor (si está disponible)
    if (driverLat && driverLng && !isNaN(driverLat) && !isNaN(driverLng)) {
        const driverIcon = L.divIcon({
            html: `
                <div style="
                    background-color: #007bff;
                    border: 2px solid #fff;
                    border-radius: 50% 50% 50% 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    transform: rotate(-45deg);
                ">
                    <span style="
                        font-size: 16px;
                        color: white;
                        transform: rotate(45deg);
                    ">🏍️</span>
                </div>
            `,
            className: 'custom-driver-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });

        driverTrackingMarker = L.marker([driverLat, driverLng], { icon: driverIcon })
            .addTo(orderTrackingMap)
            .bindPopup('🏍️ Repartidor');
        markers.push(driverTrackingMarker);
        currentDriverPosition = [driverLat, driverLng];
    }

    // Ajustar vista para mostrar todos los marcadores
    if (markers.length > 1) {
        const group = new L.featureGroup(markers);
        orderTrackingMap.fitBounds(group.getBounds(), { padding: [30, 30] });
    }

    // Dibujar rutas iniciales
    drawInitialRoutes();

    // Configurar Socket.IO para actualizaciones en tiempo real
    setupRealTimeTracking(orderId, driverId);

    // Actualizar estado de conexión
    updateConnectionStatus('Conectado');

    // Forzar actualización del mapa
    setTimeout(() => {
        if (orderTrackingMap) {
            orderTrackingMap.invalidateSize();
        }
    }, 100);
}

// Función para dibujar rutas iniciales
async function drawInitialRoutes() {
    if (!orderTrackingMap) return;

    // Limpiar rutas existentes
    trackingRouteLines.forEach(line => {
        if (line && orderTrackingMap.hasLayer(line)) {
            orderTrackingMap.removeLayer(line);
        }
    });
    trackingRouteLines = [];

    const mapContainer = document.getElementById('order-tracking-map');
    if (!mapContainer) return;

    const driverLat = parseFloat(mapContainer.dataset.driverLat) || null;
    const driverLng = parseFloat(mapContainer.dataset.driverLng) || null;
    const clienteLat = parseFloat(mapContainer.dataset.clienteLat);
    const clienteLng = parseFloat(mapContainer.dataset.clienteLng);
    const restauranteLat = parseFloat(mapContainer.dataset.restauranteLat) || null;
    const restauranteLng = parseFloat(mapContainer.dataset.restauranteLng) || null;
    const orderId = mapContainer.dataset.orderId;

    // Función para calcular y dibujar ruta
    async function calculateAndDrawRoute(startLat, startLng, endLat, endLng, routeType) {
        try {
            const response = await fetch(`/orders/${orderId}/route?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.route && data.route.length > 0) {
                    const routeLine = L.polyline(data.route, {
                        color: '#007bff',
                        weight: 4,
                        opacity: 0.8,
                        dashArray: '10, 10'
                    }).addTo(orderTrackingMap);

                    let popupText = '';
                    switch(routeType) {
                        case 'driver-to-restaurant':
                            popupText = '🚗 Ruta: Repartidor → Restaurante';
                            break;
                        case 'restaurant-to-client':
                            popupText = '🚗 Ruta: Restaurante → Cliente';
                            break;
                        case 'driver-to-client':
                            popupText = '🚗 Ruta: Repartidor → Cliente';
                            break;
                    }

                    routeLine.bindPopup(`${popupText}<br>Distancia: ${(data.distance / 1000).toFixed(1)} km`);
                    trackingRouteLines.push(routeLine);
                    return routeLine;
                }
            }
        } catch (error) {
            console.error('Error calculating route:', error);
        }

        // Fallback: línea recta si la API falla
        const fallbackLine = L.polyline([
            [startLat, startLng],
            [endLat, endLng]
        ], {
            color: '#007bff',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 10'
        }).addTo(orderTrackingMap);

        let popupText = '';
        switch(routeType) {
            case 'driver-to-restaurant':
                popupText = '🚗 Ruta: Repartidor → Restaurante (línea recta)';
                break;
            case 'restaurant-to-client':
                popupText = '🚗 Ruta: Restaurante → Cliente (línea recta)';
                break;
            case 'driver-to-client':
                popupText = '🚗 Ruta: Repartidor → Cliente (línea recta)';
                break;
        }

        fallbackLine.bindPopup(popupText);
        trackingRouteLines.push(fallbackLine);
        return fallbackLine;
    }

    // Calcular rutas según disponibilidad de coordenadas
    if (driverTrackingMarker && restaurantTrackingMarker && driverLat && driverLng) {
        // Ruta: Repartidor → Restaurante
        await calculateAndDrawRoute(driverLat, driverLng, restauranteLat, restauranteLng, 'driver-to-restaurant');
    }

    if (restaurantTrackingMarker) {
        // Ruta: Restaurante → Cliente
        await calculateAndDrawRoute(restauranteLat, restauranteLng, clienteLat, clienteLng, 'restaurant-to-client');
    } else if (driverTrackingMarker && driverLat && driverLng) {
        // Ruta directa: Repartidor → Cliente (si no hay restaurante)
        await calculateAndDrawRoute(driverLat, driverLng, clienteLat, clienteLng, 'driver-to-client');
    }
}

// Función para configurar seguimiento en tiempo real
function setupRealTimeTracking(orderId, driverId) {
    if (!orderId || !driverId) {
        console.log('Order ID or Driver ID not available for real-time tracking');
        return;
    }

    // Conectar a Socket.IO
    const socket = io();

    // Unirse a la sala del pedido
    socket.emit('join-order-room', `order-${orderId}`);

    console.log('Joined order room for real-time tracking:', orderId);

    // Escuchar actualizaciones de ubicación del repartidor
    socket.on('driver-location-update', (data) => {
        console.log('📍 Driver location update received:', data);

        if (data.driverId == driverId) {
            const { latitude, longitude } = data;

            // Actualizar posición del marcador del repartidor
            if (driverTrackingMarker) {
                driverTrackingMarker.setLatLng([latitude, longitude]);
                currentDriverPosition = [latitude, longitude];

                // Centrar mapa en la nueva ubicación
                if (orderTrackingMap) {
                    orderTrackingMap.panTo([latitude, longitude]);
                }

                // Actualizar popup
                driverTrackingMarker.setPopupContent(`🏍️ Repartidor<br>Última actualización: ${new Date().toLocaleTimeString()}`);

                // Recalcular rutas desde la nueva posición
                updateRoutesFromNewPosition(latitude, longitude);

                // Actualizar estado de ubicación
                updateConnectionStatus(`Repartidor en: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            } else {
                // Crear marcador si no existe
                createDriverMarker(latitude, longitude);
            }
        }
    });

    // Escuchar cambios de estado del pedido
    socket.on('order-status-changed', (data) => {
        console.log('Order status changed:', data);
        if (data.orderId == orderId) {
            if (data.status !== 'en_camino') {
                updateConnectionStatus('Pedido completado');
                // Podríamos limpiar rutas o marcadores aquí si es necesario
            }
        }
    });

    // Manejar conexión del socket
    socket.on('connect', () => {
        console.log('🔌 Connected to server for order tracking');
        updateConnectionStatus('Conectado');
    });

    socket.on('disconnect', () => {
        console.log('🔌 Disconnected from server');
        updateConnectionStatus('Desconectado');
    });

    socket.on('connect_error', (error) => {
        console.error('🔌 Connection error:', error);
        updateConnectionStatus('Error de conexión');
    });
}

// Función para actualizar rutas desde nueva posición
async function updateRoutesFromNewPosition(newLat, newLng) {
    if (!orderTrackingMap) return;

    // Limpiar rutas existentes
    trackingRouteLines.forEach(line => {
        if (line && orderTrackingMap.hasLayer(line)) {
            orderTrackingMap.removeLayer(line);
        }
    });
    trackingRouteLines = [];

    const mapContainer = document.getElementById('order-tracking-map');
    if (!mapContainer) return;

    const clienteLat = parseFloat(mapContainer.dataset.clienteLat);
    const clienteLng = parseFloat(mapContainer.dataset.clienteLng);
    const restauranteLat = parseFloat(mapContainer.dataset.restauranteLat) || null;
    const restauranteLng = parseFloat(mapContainer.dataset.restauranteLng) || null;
    const orderId = mapContainer.dataset.orderId;

    // Función para calcular ruta
    async function calculateRoute(startLat, startLng, endLat, endLng, routeType) {
        try {
            const response = await fetch(`/orders/${orderId}/route?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.route && data.route.length > 0) {
                    const routeLine = L.polyline(data.route, {
                        color: '#007bff',
                        weight: 4,
                        opacity: 0.9,
                        dashArray: '10, 10'
                    }).addTo(orderTrackingMap);

                    let popupText = '';
                    switch(routeType) {
                        case 'driver-to-restaurant':
                            popupText = '🚗 Ruta actual: Repartidor → Restaurante';
                            break;
                        case 'driver-to-client':
                            popupText = '🚗 Ruta actual: Repartidor → Cliente';
                            break;
                    }

                    routeLine.bindPopup(`${popupText}<br>Distancia: ${(data.distance / 1000).toFixed(1)} km`);
                    trackingRouteLines.push(routeLine);
                }
            }
        } catch (error) {
            console.error('Error calculating route:', error);
            // Fallback: línea recta
            const fallbackLine = L.polyline([
                [startLat, startLng],
                [endLat, endLng]
            ], {
                color: '#007bff',
                weight: 3,
                opacity: 0.8,
                dashArray: '5, 10'
            }).addTo(orderTrackingMap);

            let popupText = routeType === 'driver-to-restaurant' ?
                '🚗 Ruta actual: Repartidor → Restaurante (línea recta)' :
                '🚗 Ruta actual: Repartidor → Cliente (línea recta)';

            fallbackLine.bindPopup(popupText);
            trackingRouteLines.push(fallbackLine);
        }
    }

    // Calcular nueva ruta desde la posición actual del repartidor
    if (restauranteLat && restauranteLng) {
        // Si hay restaurante, calcular ruta Repartidor → Restaurante
        await calculateRoute(newLat, newLng, restauranteLat, restauranteLng, 'driver-to-restaurant');
    } else {
        // Si no hay restaurante, calcular ruta directa Repartidor → Cliente
        await calculateRoute(newLat, newLng, clienteLat, clienteLng, 'driver-to-client');
    }
}

// Función para crear marcador del repartidor dinámicamente
function createDriverMarker(lat, lng) {
    if (!orderTrackingMap) return;

    const driverIcon = L.divIcon({
        html: `
            <div style="
                background-color: #007bff;
                border: 2px solid #fff;
                border-radius: 50% 50% 50% 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                transform: rotate(-45deg);
            ">
                <span style="
                    font-size: 16px;
                    color: white;
                    transform: rotate(45deg);
                ">🏍️</span>
            </div>
        `,
        className: 'custom-driver-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    driverTrackingMarker = L.marker([lat, lng], { icon: driverIcon })
        .addTo(orderTrackingMap)
        .bindPopup(`🏍️ Repartidor<br>Última actualización: ${new Date().toLocaleTimeString()}`);

    currentDriverPosition = [lat, lng];

    // Centrar mapa en el nuevo marcador
    orderTrackingMap.panTo([lat, lng]);

    // Dibujar rutas desde la nueva posición
    updateRoutesFromNewPosition(lat, lng);
}

// Función para actualizar estado de conexión
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('driver-location-status');
    if (statusElement) {
        statusElement.innerHTML = `<i class="fas fa-map-marker-alt me-1"></i>${status}`;
    }
}

// Función para inicializar mapa de entrega simple (sin seguimiento en tiempo real)
function initOrderDeliveryMap() {
    const mapContainer = document.getElementById('order-delivery-map');
    if (!mapContainer) {
        console.log('Order delivery map container not found');
        return;
    }

    // Limpiar mapa anterior si existe
    if (orderTrackingMap) {
        orderTrackingMap.remove();
        orderTrackingMap = null;
    }

    const lat = parseFloat(mapContainer.dataset.lat);
    const lng = parseFloat(mapContainer.dataset.lng);
    const restauranteLat = parseFloat(mapContainer.dataset.restauranteLat) || null;
    const restauranteLng = parseFloat(mapContainer.dataset.restauranteLng) || null;

    if (isNaN(lat) || isNaN(lng)) {
        console.log('Invalid coordinates for delivery map');
        return;
    }

    // Inicializar mapa simple
    orderTrackingMap = L.map('order-delivery-map', {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        keyboardPanDelta: 80
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(orderTrackingMap);

    // Agregar marcador de entrega
    const deliveryIcon = L.divIcon({
        html: `
            <div style="
                background-color: #dc3545;
                border: 2px solid #fff;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            ">
                <span style="
                    font-size: 16px;
                    color: white;
                ">🏠</span>
            </div>
        `,
        className: 'custom-delivery-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    L.marker([lat, lng], { icon: deliveryIcon })
        .addTo(orderTrackingMap)
        .bindPopup('📍 Ubicación de Entrega');

    // Agregar marcador del restaurante si está disponible
    if (restauranteLat && restauranteLng && !isNaN(restauranteLat) && !isNaN(restauranteLng)) {
        const restaurantIcon = L.divIcon({
            html: `
                <div style="
                    background-color: #28a745;
                    border: 2px solid #fff;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                ">
                    <span style="
                        font-size: 16px;
                        color: white;
                    ">🏪</span>
                </div>
            `,
            className: 'custom-restaurant-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });

        L.marker([restauranteLat, restauranteLng], { icon: restaurantIcon })
            .addTo(orderTrackingMap)
            .bindPopup('🏪 Restaurante');

        // Dibujar línea de ruta entre restaurante y entrega
        L.polyline([
            [restauranteLat, restauranteLng],
            [lat, lng]
        ], {
            color: '#007bff',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 10'
        }).addTo(orderTrackingMap)
        .bindPopup('🚗 Ruta estimada: Restaurante → Entrega');
    }

    // Forzar actualización del mapa
    setTimeout(() => {
        if (orderTrackingMap) {
            orderTrackingMap.invalidateSize();
        }
    }, 100);
}

// Inicializar mapas cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Intentar inicializar mapa de seguimiento en tiempo real
    setTimeout(() => {
        if (document.getElementById('order-tracking-map')) {
            initOrderTrackingMap();
        } else if (document.getElementById('order-delivery-map')) {
            initOrderDeliveryMap();
        }
    }, 500);
});
