// Mapa de seguimiento para dashboard de órdenes - similar al de repartidores
let orderMap = null;
let driverMarker = null;
let restaurantMarker = null;
let clientMarker = null;
let currentRoute = null;

function initOrderMap() {
    const mapContainer = document.getElementById('order-map');
    if (!mapContainer) {
        console.log('Order map container not found');
        return;
    }

    // Limpiar mapa anterior si existe
    if (orderMap) {
        orderMap.remove();
        orderMap = null;
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
    const orderStatus = mapContainer.dataset.orderStatus;

    console.log('=== INICIANDO MAPA DE ORDEN ===');
    console.log('Order ID:', orderId);
    console.log('Driver ID:', driverId);
    console.log('Order Status:', orderStatus);
    console.log('Driver Lat/Lng:', driverLat, driverLng);
    console.log('Client Lat/Lng:', clienteLat, clienteLng);
    console.log('Restaurant Lat/Lng:', restauranteLat, restauranteLng);
    console.log('================================');

    console.log('Initializing order map with data:', {
        orderId, driverId, driverLat, driverLng, clienteLat, clienteLng, restauranteLat, restauranteLng, orderStatus
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
    orderMap = L.map('order-map', {
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
    }).addTo(orderMap);

    // Array para almacenar marcadores
    const markers = [];

    // Crear marcador del cliente (siempre visible) - usando marcador por defecto
    if (!isNaN(clienteLat) && !isNaN(clienteLng)) {
        clientMarker = L.marker([clienteLat, clienteLng])
            .addTo(orderMap)
            .bindPopup('📍 Ubicación de Entrega');
        markers.push(clientMarker);
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

        restaurantMarker = L.marker([restauranteLat, restauranteLng], { icon: restaurantIcon })
            .addTo(orderMap)
            .bindPopup('🏪 Restaurante');
        markers.push(restaurantMarker);
    }

    // Crear marcador del repartidor (si está disponible y el pedido está en camino)
    if (driverLat && driverLng && !isNaN(driverLat) && !isNaN(driverLng) && orderStatus === 'en_camino') {
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

        driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon })
            .addTo(orderMap)
            .bindPopup('🏍️ Repartidor');
        markers.push(driverMarker);
    }

    // Ajustar vista para mostrar todos los marcadores
    if (markers.length > 1) {
        const group = new L.featureGroup(markers);
        orderMap.fitBounds(group.getBounds(), { padding: [30, 30] });
    }

    // Dibujar ruta inicial si hay repartidor y asignar a variable global
    if (driverMarker && orderStatus === 'en_camino') {
        drawRoute().then((routeLineResult) => {
            currentRoute = routeLineResult; // Asignar a variable global para que las actualizaciones puedan removerla
        });
    }

    // Configurar Socket.IO para actualizaciones en tiempo real si el pedido está en camino
    if (orderStatus === 'en_camino' && driverId) {
        setupRealTimeTracking(orderId, driverId);
    } else {
        updateConnectionStatus('Ubicación estática');
    }

    // Forzar actualización del mapa
    setTimeout(() => {
        if (orderMap) {
            orderMap.invalidateSize();
        }
    }, 100);
}

// Función para dibujar ruta
async function drawRoute() {
    if (!orderMap || !driverMarker) return;

    // Limpiar ruta existente
    if (currentRoute) {
        orderMap.removeLayer(currentRoute);
        currentRoute = null;
    }

    const mapContainer = document.getElementById('order-map');
    if (!mapContainer) return;

    const driverLat = parseFloat(mapContainer.dataset.driverLat);
    const driverLng = parseFloat(mapContainer.dataset.driverLng);
    const clienteLat = parseFloat(mapContainer.dataset.clienteLat);
    const clienteLng = parseFloat(mapContainer.dataset.clienteLng);

    if (!driverLat || !driverLng || !clienteLat || !clienteLng) return;

    try {
        const response = await fetch(`/orders/${mapContainer.dataset.orderId}/route?startLat=${driverLat}&startLng=${driverLng}&endLat=${clienteLat}&endLng=${clienteLng}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.route && data.route.length > 0) {
                const routeLine = L.polyline(data.route, {
                    color: '#007bff',
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '10, 10'
                }).addTo(orderMap);

                routeLine.bindPopup(`🚗 Ruta del repartidor<br>Distancia: ${(data.distance / 1000).toFixed(1)} km`);
                return routeLine; // Devolver la línea para asignarla a variable global
            }
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        // Fallback: línea recta
        const routeLine = L.polyline([
            [driverLat, driverLng],
            [clienteLat, clienteLng]
        ], {
            color: '#007bff',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 10'
        }).addTo(orderMap);

        routeLine.bindPopup('🚗 Ruta estimada (línea recta)');
        return routeLine; // Devolver la línea fallback
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

    // Unirse a la sala de actualizaciones del pedido
    socket.emit('join-order-updates', { orderId });

    console.log('Joined order updates room for real-time tracking:', orderId);

    // Escuchar actualizaciones de ubicación del repartidor
    socket.on('driver-location-update', (data) => {
        console.log('📍 Driver location update received:', data);

        if (data.driverId == driverId) {
            const { latitude, longitude } = data;

            // Actualizar posición del marcador del repartidor
            if (driverMarker) {
                driverMarker.setLatLng([latitude, longitude]);

                // Centrar mapa en la nueva ubicación
                if (orderMap) {
                    orderMap.panTo([latitude, longitude]);
                }

                // Actualizar popup
                driverMarker.setPopupContent(`🏍️ Repartidor<br>Última actualización: ${new Date().toLocaleTimeString()}`);

                // Redibujar ruta desde la nueva posición
                updateRouteFromNewPosition(latitude, longitude);

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
            }
        }
    });

    // Manejar conexión del socket
    socket.on('connect', () => {
        console.log('🔌 Connected to server for order tracking');
        updateConnectionStatus('Conectado - Esperando ubicación...');
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

// Función para actualizar ruta desde nueva posición
async function updateRouteFromNewPosition(newLat, newLng) {
    if (!orderMap) return;

    // Limpiar ruta existente
    if (currentRoute) {
        orderMap.removeLayer(currentRoute);
        currentRoute = null;
    }

    const mapContainer = document.getElementById('order-map');
    if (!mapContainer) return;

    const clienteLat = parseFloat(mapContainer.dataset.clienteLat);
    const clienteLng = parseFloat(mapContainer.dataset.clienteLng);

    try {
        const response = await fetch(`/orders/${mapContainer.dataset.orderId}/route?startLat=${newLat}&startLng=${newLng}&endLat=${clienteLat}&endLng=${clienteLng}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.route && data.route.length > 0) {
                currentRoute = L.polyline(data.route, {
                    color: '#007bff',
                    weight: 4,
                    opacity: 0.9,
                    dashArray: '10, 10'
                }).addTo(orderMap);

                currentRoute.bindPopup(`🚗 Ruta actualizada<br>Distancia: ${(data.distance / 1000).toFixed(1)} km`);
            }
        }
    } catch (error) {
        console.error('Error updating route:', error);
        // Fallback: línea recta
        currentRoute = L.polyline([
            [newLat, newLng],
            [clienteLat, clienteLng]
        ], {
            color: '#007bff',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 10'
        }).addTo(orderMap);

        currentRoute.bindPopup('🚗 Ruta actualizada (línea recta)');
    }
}

// Función para crear marcador del repartidor dinámicamente
function createDriverMarker(lat, lng) {
    if (!orderMap) return;

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

    driverMarker = L.marker([lat, lng], { icon: driverIcon })
        .addTo(orderMap)
        .bindPopup(`🏍️ Repartidor<br>Última actualización: ${new Date().toLocaleTimeString()}`);

    // Centrar mapa en el nuevo marcador
    orderMap.panTo([lat, lng]);

    // Dibujar ruta desde la nueva posición
    updateRouteFromNewPosition(lat, lng);
}

// Función para actualizar estado de conexión
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('driver-location-status');
    if (statusElement) {
        statusElement.innerHTML = `<i class="fas fa-map-marker-alt me-1"></i>${status}`;
    }
}

// Nota: La inicialización del mapa se maneja desde dashboard-orders.js
// cuando se carga el modal de detalles del pedido
