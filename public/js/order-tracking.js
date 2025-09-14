let map = null;
let driverMarker = null;
let orderMarker = null;
let routeLine = null;

// Function to update driver's marker position
function updateDriverPosition(lat, lng) {
    if (driverMarker) {
        driverMarker.setLatLng([lat, lng]);
    } else if (map) {
        // Si no existe el marcador, crearlo
        const motorcycleIcon = L.icon({
            iconUrl: '/images/motorcycle.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        driverMarker = L.marker([lat, lng], { icon: motorcycleIcon })
            .addTo(map)
            .bindPopup('🏍️ Repartidor');

        // Ajustar la vista para mostrar ambos marcadores
        if (orderMarker) {
            const group = L.featureGroup([driverMarker, orderMarker]);
            map.fitBounds(group.getBounds().pad(0.2));
        } else {
            map.setView([lat, lng], 16);
        }
    }

    // Recalcular la ruta desde la nueva posición del repartidor hasta el punto de entrega
    if (orderMarker && driverMarker) {
        const orderLatLng = orderMarker.getLatLng();


        calculateRoute(lat, lng, orderLatLng.lat, orderLatLng.lng).then((newRouteCoords) => {
            // Actualizar la línea de ruta directamente con las nuevas coordenadas
            if (routeLine) {
                map.removeLayer(routeLine);
                routeLine = null;
            }

            // Usar las coordenadas calculadas o fallback a línea recta
            const routeCoords = newRouteCoords && newRouteCoords.length > 0 ? newRouteCoords : [[lat, lng], [orderLatLng.lat, orderLatLng.lng]];

            routeLine = L.polyline(routeCoords, {
                color: '#007bff',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 10'
            }).addTo(map);

            // Calcular distancia
            const distance = map.distance([lat, lng], [orderLatLng.lat, orderLatLng.lng]);
            const distanceKm = (distance / 1000).toFixed(1);

            routeLine.bindPopup(`🚗 Ruta del repartidor<br>Distancia: ${distanceKm} km`);

    
        }).catch((error) => {
            console.error('❌ Error recalculando ruta:', error);
            // Fallback: dibujar línea recta si hay error
            if (routeLine) {
                map.removeLayer(routeLine);
            }

            const orderLatLng = orderMarker.getLatLng();
            routeLine = L.polyline([[lat, lng], [orderLatLng.lat, orderLatLng.lng]], {
                color: '#007bff',
                weight: 3,
                opacity: 0.8,
                dashArray: '5, 10'
            }).addTo(map);

            const distance = map.distance([lat, lng], [orderLatLng.lat, orderLatLng.lng]);
            const distanceKm = (distance / 1000).toFixed(1);
            routeLine.bindPopup(`🚗 Ruta del repartidor (línea recta)<br>Distancia: ${distanceKm} km`);

            console.log('🔄 Usando ruta fallback (línea recta) - Distancia:', distanceKm, 'km');
        });
    }

    console.log('✅ Ubicación del repartidor actualizada:', { lat, lng });
}

// Initialize WebSocket connection for real-time updates
function initWebSocket() {
    const orderId = document.getElementById('order-status-data')?.dataset.orderId;
    if (!orderId) {
        console.log('No se encontró el ID del pedido para WebSocket');
        return;
    }
    
    console.log('🔌 Inicializando WebSocket para seguimiento en tiempo real');
    
    // Conectar al servidor Socket.IO
    const socket = io();
    
    // Unirse a la sala de actualizaciones del pedido
    socket.emit('join-order-updates', { orderId });
    
    // Escuchar actualizaciones de ubicación del repartidor
    socket.on('driver-location-update', (data) => {
        console.log('📍 Nueva ubicación recibida:', data);
        if (data.latitude && data.longitude) {
            updateDriverPosition(
                parseFloat(data.latitude), 
                parseFloat(data.longitude)
            );
        }
    });
    
    // Manejar errores de conexión
    socket.on('connect_error', (error) => {
        console.error('Error de conexión WebSocket:', error);
    });
}

function initMap(lat, lng) {
    // Limpiar mapa anterior completamente
    if (map) {
        try {
            map.remove();
            map = null;
        } catch (e) {
            console.warn('Error removing previous map:', e);
        }
    }

    // Limpiar marcadores anteriores
    driverMarker = null;
    orderMarker = null;
    if (routeLine) {
        routeLine = null;
    }

    // Verificar que el contenedor del mapa existe
    const mapContainer = document.getElementById('deliveryMap');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    // Limpiar contenido del contenedor
    mapContainer.innerHTML = '';

    // Initialize map con zoom inicial centrado en el repartidor
    // Usar coordenadas válidas o fallback a Buenos Aires
    const centerLat = (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) ? lat : -34.6037;
    const centerLng = (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) ? lng : -58.3816;
    const initialZoom = (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) ? 16 : 14;

    map = L.map('deliveryMap', {
        center: [centerLat, centerLng],
        zoom: initialZoom,
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true, // ✅ Habilitar arrastre del mapa desde cualquier lugar
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        keyboardPanDelta: 80
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Add order location marker
    const orderLat = parseFloat(document.getElementById('order-status-data').dataset.orderLat);
    const orderLng = parseFloat(document.getElementById('order-status-data').dataset.orderLng);

    if (!isNaN(orderLat) && !isNaN(orderLng)) {
        orderMarker = L.marker([orderLat, orderLng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(map)
        .bindPopup('📍 Ubicación de Entrega');
    }

    // Agregar marcador del restaurante si las coordenadas están disponibles - OCULTO
    // const restaurantLat = parseFloat(document.getElementById('order-status-data').dataset.restaurantLat);
    // const restaurantLng = parseFloat(document.getElementById('order-status-data').dataset.restaurantLng);

    // let restaurantMarker = null;
    // if (!isNaN(restaurantLat) && !isNaN(restaurantLng)) {
    //     // Crear icono personalizado para el restaurante
    //     const restaurantIcon = L.divIcon({
    //         html: `
    //             <div style="
    //                 background-color: #28a745;
    //                 border: 2px solid #fff;
    //                 border-radius: 50%;
    //                 width: 30px;
    //                 height: 30px;
    //                 display: flex;
    //                 align-items: center;
    //                 justify-content: center;
    //                 box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    //             ">
    //                 <span style="
    //                     font-size: 16px;
    //                     color: white;
    //                 ">🏪</span>
    //             </div>
    //         `,
    //         className: 'custom-restaurant-marker',
    //         iconSize: [30, 30],
    //         iconAnchor: [15, 30],
    //         popupAnchor: [0, -30]
    //     });

    //     restaurantMarker = L.marker([restaurantLat, restaurantLng], {
    //         icon: restaurantIcon
    //     }).addTo(map)
    //     .bindPopup('🏪 Restaurante');
    // }

    // Create custom motorcycle icon
    const motorcycleIcon = L.divIcon({
        html: `
            <div style="
                background-color: #ff6b35;
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
        className: 'custom-motorcycle-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    // Add driver marker with custom motorcycle icon (solo si las coordenadas son válidas y hay repartidor asignado)
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) &&
        document.getElementById('order-status-data')?.dataset.repartidorId) {
        driverMarker = L.marker([lat, lng], {
            icon: motorcycleIcon
        }).addTo(map)
        .bindPopup('🏍️ Repartidor');
        console.log('✅ Driver marker created in initMap at:', [lat, lng]);
    } else {
        console.warn('Invalid driver coordinates or no driver assigned, skipping driver marker creation');
    }

    // Fit bounds to show all markers (driver, order)
    const markersToShow = [];
    if (driverMarker) markersToShow.push(driverMarker);
    if (orderMarker) markersToShow.push(orderMarker);

    if (markersToShow.length > 1) {
        const group = new L.featureGroup(markersToShow);
        map.fitBounds(group.getBounds(), { padding: [20, 20] });
    } else if (markersToShow.length === 1) {
        // Si solo hay un marcador, centrar en él con zoom apropiado
        const marker = markersToShow[0];
        const markerLatLng = marker.getLatLng();
        map.setView([markerLatLng.lat, markerLatLng.lng], 16);
    } else {
        // Si no hay marcadores válidos, usar coordenadas válidas o fallback
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 16);
        } else {
            // Fallback a Buenos Aires si no hay coordenadas válidas
            map.setView([-34.6037, -58.3816], 14);
        }
    }

    // Calculate route and draw route line if both driver and order markers exist
    if (orderMarker && driverMarker) {
        calculateRoute(lat, lng, orderLat, orderLng).then(() => {
            updateRouteLine();
        });
    }

    // Forzar actualización del mapa después de un breve delay
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 100);
}

// Store the full route coordinates
let routeCoordinates = [];

async function calculateRoute(startLat, startLng, endLat, endLng) {
    try {
        // Use backend endpoint to avoid CORS issues
        const orderId = document.getElementById('order-status-data').dataset.orderId;
        const response = await fetch(`/orders/${orderId}/route?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`);

        if (!response.ok) {
            throw new Error('Failed to fetch route');
        }

        const data = await response.json();

        if (data.success && data.route) {
            routeCoordinates = data.route;
            return routeCoordinates;
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        // Fallback to straight line if routing fails
        return [[startLat, startLng], [endLat, endLng]];
    }
}

function updateRouteLine() {
    if (routeLine) {
        map.removeLayer(routeLine);
    }

    if (driverMarker && orderMarker) {
        const driverLatLng = driverMarker.getLatLng();
        const orderLatLng = orderMarker.getLatLng();

        // If we have a calculated route, use it; otherwise use straight line
        const routeCoords = routeCoordinates.length > 0 ? routeCoordinates : [driverLatLng, orderLatLng];

        routeLine = L.polyline(routeCoords, {
            color: '#007bff',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10'
        }).addTo(map);

        // Calculate distance
        const distance = map.distance(driverLatLng, orderLatLng);
        const distanceKm = (distance / 1000).toFixed(1);

        routeLine.bindPopup(`🚗 Ruta del repartidor<br>Distancia: ${distanceKm} km`);
    }
}

// Función para manejar la subida de comprobantes de pago
function initComprobanteUpload() {
    const comprobanteForm = document.getElementById('comprobanteForm');
    if (comprobanteForm) {
        comprobanteForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const fileInput = document.getElementById('comprobante');
            const submitButton = this.querySelector('button[type="submit"]');

            // Validar que se haya seleccionado un archivo
            if (!fileInput.files || fileInput.files.length === 0) {
                alert('Por favor selecciona un archivo para subir.');
                return;
            }

            const file = fileInput.files[0];

            // Validar tipo de archivo
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                alert('Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF) y PDF.');
                return;
            }

            // Validar tamaño del archivo (máximo 5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                alert('El archivo es demasiado grande. El tamaño máximo permitido es 5MB.');
                return;
            }

            // Deshabilitar botón y mostrar loading
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Subiendo...';

            try {
                const orderId = document.getElementById('order-status-data').dataset.orderId;
                const response = await fetch(`/orders/${orderId}/upload-comprobante`, {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    alert('Comprobante subido correctamente. El restaurante revisará tu pago.');
                    // Recargar la página para mostrar el comprobante subido
                    window.location.reload();
                } else {
                    throw new Error(result.message || 'Error al subir el comprobante');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al subir el comprobante: ' + error.message);
            } finally {
                // Restaurar botón
                submitButton.disabled = false;
                submitButton.innerHTML = 'Enviar Comprobante';
            }
        });
    }
}

// Function to initialize order location map
function initializeOrderMaps() {
    // Get coordinates from data attributes
    const orderLat = parseFloat(document.getElementById('order-status-data')?.dataset.orderLat) || null;
    const orderLng = parseFloat(document.getElementById('order-status-data')?.dataset.orderLng) || null;
    const restaurantLat = parseFloat(document.getElementById('order-status-data')?.dataset.restaurantLat) || null;
    const restaurantLng = parseFloat(document.getElementById('order-status-data')?.dataset.restaurantLng) || null;
    const driverLat = parseFloat(document.getElementById('order-status-data')?.dataset.driverLat) || null;
    const driverLng = parseFloat(document.getElementById('order-status-data')?.dataset.driverLng) || null;
    const orderStatus = document.getElementById('order-status-data')?.dataset.orderStatus;
    const driverId = document.getElementById('order-status-data')?.dataset.repartidorId;

    console.log('Initializing order location maps with coordinates:', {
        order: [orderLat, orderLng],
        restaurant: [restaurantLat, restaurantLng],
        driver: [driverLat, driverLng],
        status: orderStatus,
        driverId: driverId
    });

    if (orderLat && orderLng && !isNaN(orderLat) && !isNaN(orderLng)) {
        // Initialize main map in the right column
        const mainMapDiv = document.getElementById('orderLocationMap');
        if (mainMapDiv) {
            try {
                // Clear any existing map instance
                if (window.mainOrderMap) {
                    window.mainOrderMap.remove();
                    window.mainOrderMap = null;
                }

                // Clear container content
                mainMapDiv.innerHTML = '';

                // Determinar el centro inicial del mapa
                let centerLat, centerLng, zoomLevel = 14;

                if (driverLat !== null && driverLng !== null && !isNaN(driverLat) && !isNaN(driverLng)) {
                    // Si hay conductor, centrar en el conductor
                    centerLat = driverLat;
                    centerLng = driverLng;
                    zoomLevel = 16;
                } else {
                    // Fallback: centrar en la ubicación de entrega
                    centerLat = orderLat;
                    centerLng = orderLng;
                    zoomLevel = 16;
                }

                const mainMap = L.map('orderLocationMap', {
                    center: [centerLat, centerLng],
                    zoom: zoomLevel,
                    zoomControl: true,
                    scrollWheelZoom: true,
                    dragging: true, // ✅ Habilitar arrastre del mapa
                    touchZoom: true,
                    doubleClickZoom: true,
                    boxZoom: true,
                    keyboard: true,
                    keyboardPanDelta: 80
                });
                window.mainOrderMap = mainMap; // Store reference globally
                map = mainMap; // Asignar también a la variable global para que las actualizaciones WebSocket funcionen

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap',
                    crossOrigin: true
                }).addTo(mainMap);

                // Array para almacenar todos los marcadores
                const markers = [];

                // Add marker for order location (siempre visible)
                orderMarker = L.marker([orderLat, orderLng], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                }).addTo(mainMap)
                .bindPopup('📍 Ubicación de Entrega');
                markers.push(orderMarker);

                // Add marker for restaurant location (si está disponible) - OCULTO
                // let restaurantMarker = null;
                // if (!isNaN(restaurantLat) && !isNaN(restaurantLng)) {
                //     const restaurantIcon = L.divIcon({
                //         html: `
                //             <div style="
                //                 background-color: #28a745;
                //                 border: 2px solid #fff;
                //                 border-radius: 50%;
                //                 width: 30px;
                //                 height: 30px;
                //                 display: flex;
                //                 align-items: center;
                //                 justify-content: center;
                //                 box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                //             ">
                //                 <span style="
                //                     font-size: 16px;
                //                     color: white;
                //                 ">🏪</span>
                //             </div>
                //         `,
                //         className: 'custom-restaurant-marker',
                //         iconSize: [30, 30],
                //         iconAnchor: [15, 30],
                //         popupAnchor: [0, -30]
                //     });

                //     restaurantMarker = L.marker([restaurantLat, restaurantLng], {
                //         icon: restaurantIcon
                //     }).addTo(mainMap)
                //     .bindPopup('🏪 Restaurante');
                //     markers.push(restaurantMarker);
                // }

                // Add marker for driver location (si está disponible y hay repartidor asignado)
                console.log('🔍 Checking driver marker conditions in initializeOrderMaps:', {
                    driverLat,
                    driverLng,
                    driverId,
                    hasDriverId: !!driverId,
                    driverLatType: typeof driverLat,
                    driverLngType: typeof driverLng,
                    driverLatIsNumber: typeof driverLat === 'number',
                    driverLngIsNumber: typeof driverLng === 'number'
                });

                if (driverId && driverLat !== null && driverLat !== undefined && driverLng !== null && driverLng !== undefined) {
                    try {
                        // Convert to numbers if they are strings
                        const lat = parseFloat(driverLat);
                        const lng = parseFloat(driverLng);

                        console.log('📍 Parsed coordinates in initializeOrderMaps:', { lat, lng });

                        if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
                            const motorcycleIcon = L.divIcon({
                                html: `
                                    <div style="
                                        background-color: #ff6b35;
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
                                className: 'custom-motorcycle-marker',
                                iconSize: [30, 30],
                                iconAnchor: [15, 30],
                                popupAnchor: [0, -30]
                            });

                            // Usar la variable global driverMarker para que las actualizaciones WebSocket funcionen
                            driverMarker = L.marker([lat, lng], {
                                icon: motorcycleIcon
                            }).addTo(mainMap)
                            .bindPopup('🏍️ Repartidor');
                            markers.push(driverMarker);
                            console.log('✅ Driver marker created successfully in initializeOrderMaps at:', [lat, lng]);
                        } else {
                            console.log('❌ Invalid parsed coordinates in initializeOrderMaps:', { lat, lng });
                        }
                    } catch (error) {
                        console.error('❌ Error creating driver marker in initializeOrderMaps:', error);
                        driverMarker = null;
                    }
                } else {
                    console.log('⚠️ Skipping driver marker creation in initializeOrderMaps - missing data:', {
                        hasDriverId: !!driverId,
                        driverLatNull: driverLat === null || driverLat === undefined,
                        driverLngNull: driverLng === null || driverLng === undefined,
                        driverLatValue: driverLat,
                        driverLngValue: driverLng
                    });
                }

                // Dibujar rutas reales usando la API de rutas
                if (markers.length > 1) {
                    const orderId = document.getElementById('order-status-data').dataset.orderId;

                    // Función para calcular y dibujar ruta
                    async function calculateAndDrawRoute(startLat, startLng, endLat, endLng, popupText) {
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
                                    }).addTo(mainMap);
                                    routeLine.bindPopup(`${popupText}<br>Distancia: ${(data.distance / 1000).toFixed(1)} km`);
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
                        }).addTo(mainMap);
                        fallbackLine.bindPopup(`${popupText} (línea recta)`);
                        return fallbackLine;
                    }

                    // Calcular ruta desde repartidor hacia la entrega (cuando hay repartidor asignado)
                    if (driverMarker && orderMarker && driverLat !== null && driverLng !== null && !isNaN(driverLat) && !isNaN(driverLng)) {
                        // Dibujar la ruta inicial y asignar a la variable global
        calculateAndDrawRoute(driverLat, driverLng, orderLat, orderLng, '🚗 Ruta: Repartidor → Entrega').then((routeLineResult) => {
            routeLine = routeLineResult; // Asignar a variable global para que las actualizaciones puedan removerla
        });
                    }
                }

                // Ajustar vista para mostrar todos los marcadores
                if (markers.length > 1) {
                    const group = new L.featureGroup(markers);
                    mainMap.fitBounds(group.getBounds(), { padding: [30, 30] });
                }

                // Ocultar loading cuando el mapa esté listo
                mainMap.whenReady(function() {
                    console.log('Main map completely loaded and ready');
                    const loadingDiv = document.getElementById('orderMapLoading');
                    if (loadingDiv) {
                        loadingDiv.style.display = 'none';
                        console.log('Loading indicator hidden - main map ready');
                    }
                });

                // Invalidate size after a short delay to ensure proper rendering
                setTimeout(function() {
                    if (window.mainOrderMap) {
                        window.mainOrderMap.invalidateSize();
                    }
                }, 100);
                console.log('Main map initialized successfully');
            } catch (error) {
                console.error('Error initializing main map:', error);
            }
        }

        // Initialize delivery tracking map if driver is assigned
        if (orderStatus === 'en_camino' && driverId) {
            const deliveryMapDiv = document.getElementById('deliveryMap');
            if (deliveryMapDiv) {
                try {
                    // Clear any existing delivery map instance
                    if (window.deliveryTrackingMap) {
                        window.deliveryTrackingMap.remove();
                        window.deliveryTrackingMap = null;
                    }

                    // Clear container content
                    deliveryMapDiv.innerHTML = '';

                    const deliveryMap = L.map('deliveryMap', {
                        center: [orderLat, orderLng],
                        zoom: 16,
                        zoomControl: true,
                        scrollWheelZoom: true,
                        dragging: true, // ✅ Habilitar arrastre del mapa desde cualquier lugar
                        touchZoom: true,
                        doubleClickZoom: true,
                        boxZoom: true,
                        keyboard: true,
                        keyboardPanDelta: 80
                    });
                    window.deliveryTrackingMap = deliveryMap; // Store reference globally

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '© OpenStreetMap',
                        crossOrigin: true
                    }).addTo(deliveryMap);

                    // Add order marker
                    L.marker([orderLat, orderLng]).addTo(deliveryMap)
                        .bindPopup('📍 Ubicación de Entrega');

                    setTimeout(function() {
                        if (window.deliveryTrackingMap) {
                            window.deliveryTrackingMap.invalidateSize();
                        }
                    }, 100);
                    console.log('Delivery tracking map initialized successfully');
                } catch (error) {
                    console.error('Error initializing delivery tracking map:', error);
                }
            }
        }
    } else {
        console.log('No valid coordinates found for maps');
    }
}

// Function to show order location in modal
function showOrderLocation() {
    // Get coordinates from data attributes
    const lat = parseFloat(document.getElementById('order-status-data')?.dataset.orderLat) || null;
    const lng = parseFloat(document.getElementById('order-status-data')?.dataset.orderLng) || null;

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        alert('No hay coordenadas disponibles para mostrar el mapa');
        return;
    }

    var modal = new bootstrap.Modal(document.getElementById('orderLocationModal'));
    modal.show();
    setTimeout(function() {
        var mapDiv = document.getElementById('orderLocationMapModal');
        if (mapDiv) {
            try {
                // Clear any existing modal map instance
                if (window.modalOrderMap) {
                    window.modalOrderMap.remove();
                    window.modalOrderMap = null;
                }

                // Clear container content
                mapDiv.innerHTML = '';

                var modalMap = L.map('orderLocationMapModal', {
                    center: [lat, lng],
                    zoom: 16,
                    zoomControl: true,
                    scrollWheelZoom: true,
                    dragging: true, // ✅ Habilitar arrastre del mapa en modal
                    touchZoom: true,
                    doubleClickZoom: true,
                    boxZoom: true,
                    keyboard: true,
                    keyboardPanDelta: 80
                });
                window.modalOrderMap = modalMap; // Store reference globally

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap',
                    crossOrigin: true
                }).addTo(modalMap);

                L.marker([lat, lng]).addTo(modalMap)
                    .bindPopup('📍 Ubicación de Entrega');

                setTimeout(function() {
                    if (window.modalOrderMap) {
                        window.modalOrderMap.invalidateSize();
                    }
                }, 300);
            } catch (error) {
                console.error('Error initializing modal map:', error);
            }
        }
    }, 300);
}

// Function to show notifications
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = 'position-fixed top-0 end-0 p-3';
        notificationContainer.style.zIndex = '9999';
        document.body.appendChild(notificationContainer);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Add to container
    notificationContainer.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize WebSocket if order is in transit
    const orderStatusData = document.getElementById('order-status-data');
    if (orderStatusData && orderStatusData.dataset.orderStatus === 'en_camino') {
        initWebSocket();
    }
    
    // Initialize order location maps
    setTimeout(initializeOrderMaps, 500);

    const orderStatus = document.getElementById('order-status-data').dataset.orderStatus;
    const repartidorId = document.getElementById('order-status-data').dataset.repartidorId;
    const deliveryMapDiv = document.getElementById('deliveryMap');
    const driverLocationStatus = document.getElementById('driver-location-status');
    const orderLat = parseFloat(document.getElementById('order-status-data').dataset.orderLat);
    const orderLng = parseFloat(document.getElementById('order-status-data').dataset.orderLng);
    const driverLat = parseFloat(document.getElementById('order-status-data').dataset.driverLat);
    const driverLng = parseFloat(document.getElementById('order-status-data').dataset.driverLng);

    console.log('Order tracking initialization:', {
        orderStatus,
        repartidorId,
        hasMapDiv: !!deliveryMapDiv,
        orderLat,
        orderLng,
        driverLat,
        driverLng
    });

    if (orderStatus === 'en_camino' && repartidorId && deliveryMapDiv) {
        console.log('Initializing real-time driver tracking...');

        // Prioridad: usar ubicación del repartidor si está disponible
        let initialLat, initialLng;

        if (!isNaN(driverLat) && !isNaN(driverLng)) {
            // Usar coordenadas reales del repartidor
            initialLat = driverLat;
            initialLng = driverLng;
            console.log('📍 Usando coordenadas reales del repartidor:', initialLat, initialLng);
            if (driverLocationStatus) {
                driverLocationStatus.innerHTML = `<i class="fas fa-map-marker-alt me-2"></i>Repartidor localizado: ${driverLat.toFixed(4)}, ${driverLng.toFixed(4)}`;
            }
        } else {
            // Fallback: centrar en la ubicación del cliente
            initialLat = orderLat;
            initialLng = orderLng;
            console.log('📍 Usando coordenadas del cliente como fallback:', initialLat, initialLng);
            if (driverLocationStatus) {
                driverLocationStatus.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Buscando ubicación del repartidor...';
            }
        }

        // Initialize map
        initMap(initialLat, initialLng);

        // Setup Socket.IO for real-time updates
        const socket = io();
        const userId = document.getElementById('app-config').dataset.userId;

        if (userId) {
            socket.emit('join-user', userId);
        }

        // Join order-specific room for driver updates
        const orderId = document.getElementById('order-status-data').dataset.orderId;
        socket.emit('join-order-chat', {
            orderId: orderId,
            userId: userId,
            userType: 'cliente'
        });

        // Also join the order room for GPS updates
        socket.emit('join-order-room', `order-${orderId}`);

        console.log('Joined order chat room:', orderId);
        console.log('Joined order GPS room:', orderId);

        // Listen for driver location updates
        socket.on('driver-location-update', (data) => {
            console.log('🚗 [CLIENTE] Driver location update received:', data);
            console.log('👤 [CLIENTE] Current repartidorId:', repartidorId, 'Data driverId:', data.driverId);
            console.log('🔌 [CLIENTE] Socket ID:', socket.id);

            if (data.driverId == repartidorId) {
                const { latitude, longitude } = data;
                console.log('✅ [CLIENTE] Updating driver marker to:', latitude, longitude);

                if (driverMarker) {
                    // Actualizar posición del marcador
                    driverMarker.setLatLng([latitude, longitude]);
                    console.log('📍 [CLIENTE] Driver marker moved to:', [latitude, longitude]);

                    // Centrar mapa en la nueva ubicación
                    if (map) {
                        map.panTo([latitude, longitude]);
                        console.log('🎯 [CLIENTE] Map centered on driver');
                    }

                    // Actualizar texto de estado
                    if (driverLocationStatus) {
                        driverLocationStatus.innerHTML = `<i class="fas fa-map-marker-alt me-2"></i>Repartidor en: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                        console.log('📝 [CLIENTE] Status text updated');
                    }

                    // Recalcular y actualizar la ruta desde la nueva posición
                    console.log('🔄 [CLIENTE] Recalculating route from new driver position...');
                    const orderLatLng = orderMarker.getLatLng();
                    calculateRoute(latitude, longitude, orderLatLng.lat, orderLatLng.lng).then(() => {
                        updateRouteLine();
                        console.log('✅ [CLIENTE] Route recalculated from new driver position');
                    });

                    console.log('✅ [CLIENTE] Driver marker and route updated successfully');
                } else {
                    console.log('❌ [CLIENTE] Driver marker not found, reinitializing map...');
                    initMap(latitude, longitude);
                }
            } else {
                console.log('❌ [CLIENTE] Driver ID mismatch - not updating');
            }
        });

        // Test Socket.IO connection
        socket.on('connect', () => {
            console.log('🔌 [CLIENTE] Socket.IO connected:', socket.id);
            console.log('🔌 [CLIENTE] Connected to server successfully');
        });

        socket.on('disconnect', () => {
            console.log('🔌 [CLIENTE] Socket.IO disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('🔌 [CLIENTE] Socket.IO connection error:', error);
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('🔌 [CLIENTE] Socket.IO reconnected after', attemptNumber, 'attempts');
        });

        // Real driver location updates (production ready)
        // The driver location will be updated when the actual driver sends GPS coordinates
        // from their mobile device via Socket.IO

        console.log('Real-time driver tracking initialized - waiting for GPS updates from driver device');

        // Listen for order status changes
        socket.on('order-status-changed', (data) => {
            console.log('Order status changed:', data);
            if (data.orderId == orderId && data.status !== 'en_camino') {
                alert(`El estado de tu pedido ha cambiado a: ${data.status.replace(/_/g, ' ').toUpperCase()}`);
                window.location.reload();
            }
        });

        // Update status every 30 seconds if no real-time updates
        setInterval(() => {
            if (driverLocationStatus && !driverLocationStatus.innerHTML.includes('Repartidor en:')) {
                driverLocationStatus.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Actualizando ubicación...';
            }
        }, 30000);

    } else {
        console.log('Map not shown - conditions not met:', {
            orderStatus,
            hasRepartidor: !!repartidorId,
            hasMapDiv: !!deliveryMapDiv
        });
    }

    // Initialize comprobante upload functionality
    initComprobanteUpload();
});
