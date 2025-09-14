document.addEventListener('DOMContentLoaded', () => {
    const detailContainer = document.createElement('div');
    detailContainer.id = 'order-detail-view';
    detailContainer.className = 'order-detail-view-container';
    detailContainer.style.display = 'none';

    document.body.appendChild(detailContainer);

    // Mapeo de estados a texto y color de badge
    const statusMap = {
        'pendiente': { text: 'Pendiente', color: 'warning' },
        'confirmado': { text: 'Confirmado', color: 'info' },
        'preparando': { text: 'Preparando', color: 'primary' },
        'en_camino': { text: 'En Camino', color: 'info' },
        'entregado': { text: 'Entregado', color: 'success' },
        'cancelado': { text: 'Cancelado', color: 'danger' },
        'pendiente_pago': { text: 'Pendiente de Pago', color: 'warning' }
    };

    // Mapeo de transiciones de estado a botones de acción
    const statusTransitions = {
        'pendiente': { next: 'confirmado', text: 'Aceptar', icon: 'fa-check', color: 'success' },
        'confirmado': { next: 'preparando', text: 'Preparar', icon: 'fa-hourglass-half', color: 'warning' },
        'preparando': { next: 'en_camino', text: 'En Camino', icon: 'fa-truck', color: 'primary' },
        'en_camino': { next: 'entregado', text: 'Entregado', icon: 'fa-check', color: 'success' }
    };

    // Escucha los clics en todo el documento para botones de acción
    document.addEventListener('click', async (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const orderId = button.dataset.orderId;

        if (action === 'show-details') {
            try {
                const response = await fetch(`/dashboard/orders/${orderId}/details`);
                if (!response.ok) throw new Error('Error al cargar detalles');
                const html = await response.text();
                
                detailContainer.innerHTML = html;
                detailContainer.style.display = 'flex';

                const closeButton = detailContainer.querySelector('#close-order-details');
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        detailContainer.style.display = 'none';
                        detailContainer.innerHTML = '';
                    });
                }

                // Cargar dinámicamente los scripts necesarios y luego inicializar el mapa
                setTimeout(() => {
                    const orderMapContainer = detailContainer.querySelector('#order-map');
                    if (orderMapContainer) {
                        console.log('Inicializando mapa de orden en detalles del pedido');

                        // Función para cargar scripts en secuencia
                        const loadScriptsSequentially = async () => {
                            const scripts = [
                                { src: '/socket.io/socket.io.js', check: () => typeof io !== 'undefined' },
                                { src: 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js', check: () => typeof L !== 'undefined' },
                                { src: '/js/dashboard/order-map.js', check: () => typeof initOrderMap === 'function' }
                            ];

                            for (const scriptInfo of scripts) {
                                if (!scriptInfo.check()) {
                                    console.log(`Cargando ${scriptInfo.src}...`);
                                    await new Promise((resolve, reject) => {
                                        const script = document.createElement('script');
                                        script.src = scriptInfo.src;
                                        script.onload = () => {
                                            console.log(`${scriptInfo.src} cargado exitosamente`);
                                            resolve();
                                        };
                                        script.onerror = () => {
                                            console.error(`Error al cargar ${scriptInfo.src}`);
                                            reject(new Error(`Failed to load ${scriptInfo.src}`));
                                        };
                                        document.head.appendChild(script);
                                    });
                                } else {
                                    console.log(`${scriptInfo.src} ya está disponible`);
                                }
                            }
                        };

                        // Cargar scripts y luego inicializar mapa
                        loadScriptsSequentially().then(() => {
                            console.log('Todos los scripts cargados, inicializando mapa...');
                            if (typeof initOrderMap === 'function') {
                                initOrderMap();
                            } else {
                                console.log('Función initOrderMap no disponible después de cargar todos los scripts');
                                initBasicOrderMap(orderMapContainer);
                            }
                        }).catch((error) => {
                            console.error('Error al cargar scripts:', error);
                            initBasicOrderMap(orderMapContainer);
                        });

                    } else {
                        console.log('Contenedor del mapa no encontrado');
                    }
                }, 300); // Reducir delay

            } catch (error) {
                console.error('Error:', error);
                detailContainer.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
            }
        }

        if (action === 'update-status') {
            const status = button.dataset.status;
            updateOrderStatus(orderId, status);
        }

        if (action === 'cancel-order') {
            if (confirm('¿Estás seguro de que quieres cancelar este pedido?')) {
                updateOrderStatus(orderId, 'cancelado');
            }
        }

        if (action === 'open-chat') {
            window.open(`/dashboard/orders/${orderId}/chat`, '_blank');
        }
    });

    detailContainer.addEventListener('click', (e) => {
        if (e.target.id === 'order-detail-view') {
            detailContainer.style.display = 'none';
            detailContainer.innerHTML = '';
        }
    });

    async function updateOrderStatus(orderId, newStatus) {
        try {
            const response = await fetch(`/dashboard/orders/${orderId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newStatus })
            });

            const result = await response.json();

            if (result.needsDriverSelection) {
                // Si el backend pide seleccionar un repartidor, mostrar el modal
                showDriverSelectionModal(orderId, result.drivers);
                return; // Detener la ejecución normal
            }

            if (result.success) {
                // Recargar la página para asegurar que todos los cambios se reflejen correctamente
                window.location.reload();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar el estado del pedido.');
        }
    }

    function showDriverSelectionModal(orderId, drivers) {
        // Eliminar modal existente si lo hay
        const existingModal = document.getElementById('driver-selection-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Separar repartidores propios e independientes
        const propios = drivers.filter(driver => driver.tipo === 'propio');
        const independientes = drivers.filter(driver => driver.tipo === 'independiente');

        // Estado inicial: mostrar solo propios
        let showIndependientes = false;

        function renderDriverList() {
            const driversToShow = showIndependientes ? drivers : propios;
            const hasIndependientes = independientes.length > 0;

            const driverListHTML = driversToShow.map(driver => {
                const tipoText = driver.tipo === 'propio' ? ' (Propio)' : ' (Independiente)';
                const statusText = driver.status === 'available' ? '' : ' (Offline)';
                const isDisabled = driver.status !== 'available';
                const buttonClass = isDisabled ? 'btn btn-sm btn-secondary' : 'btn btn-sm btn-primary';
                const buttonText = isDisabled ? 'No disponible' : 'Asignar';

                return `
                <li class="list-group-item d-flex justify-content-between align-items-center ${isDisabled ? 'text-muted' : ''}">
                    ${driver.nombre} ${driver.apellido}${tipoText}${statusText}
                    <button class="${buttonClass} assign-driver-btn" data-driver-id="${driver.id}" ${isDisabled ? 'disabled' : ''}>${buttonText}</button>
                </li>
            `}).join('');

            const toggleButtonHTML = hasIndependientes ? `
                <div class="text-center mt-3">
                    <button class="btn btn-outline-primary btn-sm" id="toggle-independientes">
                        ${showIndependientes ? 'Ocultar' : 'Ver'} Repartidores Independientes
                    </button>
                </div>
            ` : '';

            const modalBody = `
                ${driversToShow.length > 0 ? `<ul class="list-group">${driverListHTML}</ul>` : '<p class="text-center text-muted">No hay repartidores disponibles en este momento.</p>'}
                ${toggleButtonHTML}
            `;

            return modalBody;
        }

        // Crear el HTML del modal
        const modalTitle = 'Seleccionar Repartidor';
        const modalHTML = `
            <div class="modal fade" id="driver-selection-modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${modalTitle}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${renderDriverList()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Añadir el modal al body y mostrarlo
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modalElement = document.getElementById('driver-selection-modal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        // Función para actualizar la lista de repartidores
        function updateDriverList() {
            const modalBody = modalElement.querySelector('.modal-body');
            modalBody.innerHTML = renderDriverList();

            // Re-agregar event listeners después de actualizar el contenido
            attachEventListeners();
        }

        // Función para agregar event listeners
        function attachEventListeners() {
            // Event listeners para botones de asignar
            modalElement.querySelectorAll('.assign-driver-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const driverId = button.dataset.driverId;
                    // Cerrar el modal
                    modal.hide();
                    // Llamar a la función de actualización de estado, ahora con el repartidor_id
                    updateOrderStatusWithDriver(orderId, 'en_camino', driverId);
                });
            });

            // Event listener para el botón de toggle
            const toggleButton = modalElement.querySelector('#toggle-independientes');
            if (toggleButton) {
                toggleButton.addEventListener('click', () => {
                    showIndependientes = !showIndependientes;
                    updateDriverList();
                });
            }
        }

        // Agregar event listeners iniciales
        attachEventListeners();

        // Limpiar el modal del DOM cuando se oculta
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
        });
    }

    async function updateOrderStatusWithDriver(orderId, newStatus, driverId) {
        try {
            const response = await fetch(`/dashboard/orders/${orderId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newStatus, repartidor_id: driverId })
            });
            const result = await response.json();
            if (result.success) {
                // Recargar la página para ver el cambio reflejado
                window.location.reload();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al asignar el repartidor.');
        }
    }

    // Función fallback para inicializar mapa de seguimiento en modal
    function initTrackingMapInModal(container) {
        if (!container) return;

        const orderId = container.dataset.orderId;
        const driverId = container.dataset.driverId;
        const driverLat = parseFloat(container.dataset.driverLat) || null;
        const driverLng = parseFloat(container.dataset.driverLng) || null;
        const clienteLat = parseFloat(container.dataset.clienteLat);
        const clienteLng = parseFloat(container.dataset.clienteLng);
        const restauranteLat = parseFloat(container.dataset.restauranteLat) || null;
        const restauranteLng = parseFloat(container.dataset.restauranteLng) || null;

        console.log('Fallback: Initializing tracking map in modal with data:', {
            orderId, driverId, driverLat, driverLng, clienteLat, clienteLng, restauranteLat, restauranteLng
        });

        // Determinar centro inicial
        let centerLat = clienteLat;
        let centerLng = clienteLng;
        let zoomLevel = 14;

        if (driverLat && driverLng && !isNaN(driverLat) && !isNaN(driverLng)) {
            centerLat = driverLat;
            centerLng = driverLng;
            zoomLevel = 16;
        }

        // Inicializar mapa
        const map = L.map(container, {
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

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        const markers = [];

        // Marcador del cliente
        if (!isNaN(clienteLat) && !isNaN(clienteLng)) {
            const clientIcon = L.divIcon({
                html: `<div style="background-color: #dc3545; border: 2px solid #fff; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><span style="font-size: 16px; color: white;">🏠</span></div>`,
                className: 'custom-client-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 30],
                popupAnchor: [0, -30]
            });
            const clientMarker = L.marker([clienteLat, clienteLng], { icon: clientIcon })
                .addTo(map)
                .bindPopup('📍 Ubicación de Entrega');
            markers.push(clientMarker);
        }

        // Marcador del restaurante
        if (restauranteLat && restauranteLng && !isNaN(restauranteLat) && !isNaN(restauranteLng)) {
            const restaurantIcon = L.divIcon({
                html: `<div style="background-color: #28a745; border: 2px solid #fff; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><span style="font-size: 16px; color: white;">🏪</span></div>`,
                className: 'custom-restaurant-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 30],
                popupAnchor: [0, -30]
            });
            const restaurantMarker = L.marker([restauranteLat, restauranteLng], { icon: restaurantIcon })
                .addTo(map)
                .bindPopup('🏪 Restaurante');
            markers.push(restaurantMarker);
        }

        // Marcador del repartidor
        if (driverLat && driverLng && !isNaN(driverLat) && !isNaN(driverLng)) {
            const driverIcon = L.divIcon({
                html: `<div style="background-color: #007bff; border: 2px solid #fff; border-radius: 50% 50% 50% 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3); transform: rotate(-45deg);"><span style="font-size: 16px; color: white; transform: rotate(45deg);">🏍️</span></div>`,
                className: 'custom-driver-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 30],
                popupAnchor: [0, -30]
            });
            const driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon })
                .addTo(map)
                .bindPopup('🏍️ Repartidor');
            markers.push(driverMarker);
        }

        // Ajustar vista
        if (markers.length > 1) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds(), { padding: [30, 30] });
        }

        // Forzar actualización
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }

    // Función fallback para inicializar mapa de entrega simple en modal
    function initDeliveryMapInModal(container) {
        if (!container) return;

        const lat = parseFloat(container.dataset.lat);
        const lng = parseFloat(container.dataset.lng);
        const restauranteLat = parseFloat(container.dataset.restauranteLat) || null;
        const restauranteLng = parseFloat(container.dataset.restauranteLng) || null;

        if (isNaN(lat) || isNaN(lng)) {
            console.log('Invalid coordinates for delivery map');
            return;
        }

        console.log('Fallback: Initializing delivery map in modal');

        const map = L.map(container, {
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
        }).addTo(map);

        // Marcador de entrega
        const deliveryIcon = L.divIcon({
            html: `<div style="background-color: #dc3545; border: 2px solid #fff; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><span style="font-size: 16px; color: white;">🏠</span></div>`,
            className: 'custom-delivery-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });

        L.marker([lat, lng], { icon: deliveryIcon })
            .addTo(map)
            .bindPopup('📍 Ubicación de Entrega');

        // Marcador del restaurante si está disponible
        if (restauranteLat && restauranteLng && !isNaN(restauranteLat) && !isNaN(restauranteLng)) {
            const restaurantIcon = L.divIcon({
                html: `<div style="background-color: #28a745; border: 2px solid #fff; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><span style="font-size: 16px; color: white;">🏪</span></div>`,
                className: 'custom-restaurant-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 30],
                popupAnchor: [0, -30]
            });

            L.marker([restauranteLat, restauranteLng], { icon: restaurantIcon })
                .addTo(map)
                .bindPopup('🏪 Restaurante');

            // Línea de ruta
            L.polyline([
                [restauranteLat, restauranteLng],
                [lat, lng]
            ], {
                color: '#007bff',
                weight: 3,
                opacity: 0.7,
                dashArray: '5, 10'
            }).addTo(map)
            .bindPopup('🚗 Ruta estimada: Restaurante → Entrega');
        }

        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }

    // Función básica de inicialización de mapa como último recurso
    function initBasicOrderMap(container) {
        if (!container) return;

        console.log('Inicializando mapa básico de respaldo');

        const lat = parseFloat(container.dataset.clienteLat) || -34.6037;
        const lng = parseFloat(container.dataset.clienteLng) || -58.3816;

        const map = L.map(container, {
            center: [lat, lng],
            zoom: 14,
            zoomControl: true,
            scrollWheelZoom: true,
            dragging: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Marcador básico
        L.marker([lat, lng]).addTo(map).bindPopup('📍 Ubicación');

        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
});
