document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    let map = null;
    let routingControl = null;
    let driverId = null;
    let assignedOrders = [];
    let driverMarker = null; // Marker for the driver's current location

    const OPENROUTE_API_KEY = window.OPENROUTE_API_KEY; // Get API key from global variable

    // Initialize map
    function initMap(latitude, longitude) {
        if (map) {
            map.remove();
        }
        map = L.map('map').setView([latitude, longitude], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Add or update driver's current location marker
        if (driverMarker) {
            driverMarker.setLatLng([latitude, longitude]);
        } else {
            driverMarker = L.marker([latitude, longitude]).addTo(map)
                .bindPopup('Tu ubicación actual')
                .openPopup();
        }
    }

    // Update driver status on UI
    function updateDriverStatusUI(status) {
        const statusElement = document.getElementById('driver-status');
        statusElement.textContent = status.replace(/_/g, ' ').toUpperCase();
        statusElement.className = 'badge';
        switch (status) {
            case 'available':
                statusElement.classList.add('bg-success');
                break;
            case 'on_delivery':
                statusElement.classList.add('bg-warning');
                break;
            case 'offline':
                statusElement.classList.add('bg-danger');
                break;
        }
        // Update radio buttons
        document.querySelectorAll('input[name="driverStatus"]').forEach(radio => {
            radio.checked = (radio.value === status);
        });
    }

    // Fetch initial driver data
    async function fetchDriverData() {
        try {
            const response = await fetch('/api/drivers/me');
            const data = await response.json();
            if (data.success) {
                driverId = data.driver.user_id;
                updateDriverStatusUI(data.driver.status);
                if (data.driver.current_latitude && data.driver.current_longitude) {
                    initMap(data.driver.current_latitude, data.driver.current_longitude);
                } else {
                    // Default location if none is set (e.g., center of Buenos Aires)
                    initMap(-34.6037, -58.3816);
                }
                socket.emit('join-user', driverId); // Join user-specific room
                fetchAssignedOrders();
            } else {
                console.error('Error fetching driver data:', data.message);
                alert('Error al cargar datos del repartidor: ' + data.message);
            }
        } catch (error) {
            console.error('Error fetching driver data:', error);
            alert('Error de conexión al cargar datos del repartidor.');
        }
    }

    // Fetch assigned orders
    async function fetchAssignedOrders() {
        try {
            const response = await fetch('/api/drivers/me/orders');
            const data = await response.json();
            if (data.success) {
                assignedOrders = data.orders;
                renderAssignedOrders();
                updateMapRoutes();
            } else {
                console.error('Error fetching assigned orders:', data.message);
            }
        } catch (error) {
            console.error('Error fetching assigned orders:', error);
        }
    }

    // Render assigned orders in the list
    function renderAssignedOrders() {
        const listElement = document.getElementById('assigned-orders-list');
        listElement.innerHTML = '';
        if (assignedOrders.length === 0) {
            listElement.innerHTML = '<p class="text-muted">No hay pedidos asignados.</p>';
            return;
        }

        assignedOrders.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'card mb-3';
            orderCard.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">Pedido #${order.numero_pedido}</h5>
                    <p class="card-text"><strong>Cliente:</strong> ${order.cliente_nombre} ${order.cliente_apellido}</p>
                    <p class="card-text"><strong>Dirección de Entrega:</strong> ${order.direccion_entrega}</p>
                    <p class="card-text"><strong>Restaurante:</strong> ${order.restaurante_nombre} (${order.restaurante_direccion})</p>
                    <p class="card-text"><strong>Estado:</strong> <span class="badge bg-primary">${order.delivery_status.replace(/_/g, ' ').toUpperCase()}</span></p>
                    <button class="btn btn-sm btn-success me-2 pickup-btn" data-order-id="${order.id}" ${order.delivery_status === 'assigned' ? '' : 'disabled'}>Recogido</button>
                    <button class="btn btn-sm btn-info deliver-btn" data-order-id="${order.id}" ${order.delivery_status === 'picked_up' || order.delivery_status === 'on_the_way' ? '' : 'disabled'}>Entregado</button>
                </div>
            `;
            listElement.appendChild(orderCard);
        });

        // Add event listeners for buttons
        document.querySelectorAll('.pickup-btn').forEach(button => {
            button.addEventListener('click', (e) => updateOrderStatus(e.target.dataset.orderId, 'pickup'));
        });
        document.querySelectorAll('.deliver-btn').forEach(button => {
            button.addEventListener('click', (e) => updateOrderStatus(e.target.dataset.orderId, 'deliver'));
        });
    }

    // Update order status (pickup/deliver)
    async function updateOrderStatus(orderId, action) {
        try {
            const response = await fetch(`/api/drivers/orders/${orderId}/${action}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (data.success) {
                alert(`Pedido ${orderId} marcado como ${action === 'pickup' ? 'recogido' : 'entregado'}.`);
                fetchAssignedOrders(); // Refresh orders
            } else {
                alert('Error al actualizar estado del pedido: ' + data.message);
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Error de conexión al actualizar estado del pedido.');
        }
    }

    // Update map with routes for assigned orders
    function updateMapRoutes() {
        if (!map) return;

        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null; // Reset routing control
        }

        if (assignedOrders.length === 0) {
            return;
        }

        const waypoints = [];
        const markers = [];

        // Add current driver location as the first waypoint
        if (driverMarker) {
            const currentLatLng = driverMarker.getLatLng();
            waypoints.push(L.latLng(currentLatLng.lat, currentLatLng.lng));
        }

        // Add restaurant pickup locations and delivery locations
        assignedOrders.forEach(order => {
            // Pickup location (restaurant)
            if (order.restaurante_latitud && order.restaurante_longitud) {
                const pickupLatLng = L.latLng(order.restaurante_latitud, order.restaurante_longitud);
                waypoints.push(pickupLatLng);
                markers.push(L.marker(pickupLatLng).bindPopup(`Recoger Pedido #${order.numero_pedido} en ${order.restaurante_nombre}`));
            }
            // Delivery location (customer)
            if (order.latitud_entrega && order.longitud_entrega) {
                const deliveryLatLng = L.latLng(order.latitud_entrega, order.longitud_entrega);
                waypoints.push(deliveryLatLng);
                markers.push(L.marker(deliveryLatLng).bindPopup(`Entregar Pedido #${order.numero_pedido} a ${order.cliente_nombre}`));
            }
        });

        // Clear existing markers (except driver marker)
        map.eachLayer(function (layer) {
            if (layer instanceof L.Marker && layer !== driverMarker) {
                map.removeLayer(layer);
            }
        });

        // Add new markers to map
        markers.forEach(marker => marker.addTo(map));

        if (waypoints.length < 2) {
            console.warn('Not enough waypoints to draw a route.');
            return;
        }

        // Initialize routing control
        routingControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: true,
            geocoder: L.Control.Geocoder.nominatim(),
            router: L.Routing.openrouteservice(OPENROUTE_API_KEY, {
                serviceUrl: 'https://api.openrouteservice.org/v2/directions/'
            }),
            lineOptions: {
                styles: [{
                    color: 'blue',
                    weight: 5
                }]
            },
            altLineOptions: {
                styles: [{
                    color: 'black',
                    weight: 5,
                    opacity: 0.2
                }]
            },
            showAlternatives: false,
            fitSelectedRoutes: true
        }).addTo(map);

        // Fit map to routes
        routingControl.on('routesfound', function (e) {
            const routes = e.routes;
            if (routes.length > 0) {
                const bounds = L.latLngBounds(routes[0].coordinates);
                map.fitBounds(bounds);
            }
        });
    }

    // Function to get and send driver's current location
    function sendDriverLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                if (driverId) {
                    try {
                        await fetch('/api/drivers/me/location', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ latitude, longitude })
                        });
                        // Update driver marker on map
                        if (driverMarker) {
                            driverMarker.setLatLng([latitude, longitude]);
                        } else {
                            initMap(latitude, longitude);
                        }
                        // Re-render routes if necessary (e.g., if driver moves significantly)
                        // updateMapRoutes(); // This might be too frequent, consider throttling
                    } catch (error) {
                        console.error('Error sending location:', error);
                    }
                }
            }, (error) => {
                console.error('Error getting geolocation:', error);
            }, {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            });
        }
    }

    // Event listeners for status buttons
    document.querySelectorAll('input[name="driverStatus"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const newStatus = e.target.value;
            try {
                const response = await fetch('/api/drivers/me/status', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: newStatus })
                });
                const data = await response.json();
                if (data.success) {
                    updateDriverStatusUI(newStatus);
                    alert('Estado actualizado a ' + newStatus);
                } else {
                    alert('Error al actualizar estado: ' + data.message);
                }
            } catch (error) {
                console.error('Error updating driver status:', error);
                alert('Error de conexión al actualizar estado.');
            }
        });
    });

    // Socket.IO listeners
    socket.on('newOrderAssigned', (data) => {
        alert(`¡Nuevo pedido asignado! Pedido #${data.orderId}`);
        fetchAssignedOrders(); // Refresh orders
    });

    socket.on('orderStatusUpdate', (data) => {
        // This might be for client, but good to have for driver too
        console.log(`Order ${data.orderId} status updated to ${data.status}`);
        fetchAssignedOrders(); // Refresh orders
    });

    // Initial data fetch
    fetchDriverData();

    // Send location every 10 seconds
    setInterval(sendDriverLocation, 10000);
});