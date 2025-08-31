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

                const mapContainer = detailContainer.querySelector('#order-map');
                if (mapContainer) {
                    const lat = parseFloat(mapContainer.dataset.lat);
                    const lng = parseFloat(mapContainer.dataset.lng);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        const map = L.map(mapContainer).setView([lat, lng], 15);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        }).addTo(map);
                        L.marker([lat, lng]).addTo(map);
                    }
                }

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

            if (result.success) {
                // Actualizar la UI directamente
                const orderCardMobile = document.querySelector(`.order-card-mobile[data-order-id="${orderId}"]`);
                const orderTableRow = document.querySelector(`.table-orders-dashboard tbody tr[data-order-id="${orderId}"]`);

                // Función auxiliar para actualizar el badge de estado
                const updateStatusBadge = (badgeElement, status) => {
                    if (badgeElement) {
                        // Remover clases bg- existentes
                        badgeElement.classList.remove('bg-warning', 'bg-info', 'bg-primary', 'bg-success', 'bg-danger', 'bg-secondary');
                        // Añadir la nueva clase y texto
                        badgeElement.classList.add(`bg-${statusMap[status].color}`);
                        badgeElement.textContent = statusMap[status].text;
                    }
                };

                // Función auxiliar para crear un botón de acción
                const createActionButton = (action, orderId, status, text, icon, color) => {
                    const button = document.createElement('button');
                    button.className = `btn btn-sm btn-${color} btn-action-text`;
                    button.dataset.action = action;
                    button.dataset.orderId = orderId;
                    button.dataset.status = status;
                    button.title = `${text} Pedido`;
                    button.innerHTML = `<i class="fas ${icon}"></i> ${text}`;
                    return button;
                };

                // Actualizar vista móvil
                if (orderCardMobile) {
                    const statusBadge = orderCardMobile.querySelector('.order-badge');
                    updateStatusBadge(statusBadge, newStatus);

                    const actionsContainer = orderCardMobile.querySelector('.order-status-actions > div:last-child');
                    if (actionsContainer) {
                        actionsContainer.innerHTML = ''; // Limpiar botones existentes

                        const transition = statusTransitions[newStatus];
                        if (transition) {
                            actionsContainer.appendChild(createActionButton('update-status', orderId, transition.next, transition.text, transition.icon, transition.color));
                        }
                        if (newStatus === 'pendiente') {
                            actionsContainer.appendChild(createActionButton('cancel-order', orderId, 'cancelado', 'Rechazar', 'fa-times', 'danger'));
                        }
                    }
                }

                // Actualizar vista de escritorio
                if (orderTableRow) {
                    const statusBadge = orderTableRow.querySelector('td:nth-child(5) .badge');
                    updateStatusBadge(statusBadge, newStatus);

                    const actionsContainer = orderTableRow.querySelector('td:nth-child(6) .btn-group');
                    if (actionsContainer) {
                        actionsContainer.innerHTML = ''; // Limpiar botones existentes

                        // Re-crear botones básicos (Ver, Chat)
                        const viewButton = document.createElement('button');
                        viewButton.className = 'btn btn-sm btn-primary';
                        viewButton.dataset.action = 'show-details';
                        viewButton.dataset.orderId = orderId;
                        viewButton.title = 'Ver Detalles';
                        viewButton.innerHTML = '<i class="fas fa-eye"></i> Ver';
                        actionsContainer.appendChild(viewButton);

                        const chatButton = document.createElement('button');
                        chatButton.className = 'btn btn-sm btn-info';
                        chatButton.dataset.action = 'open-chat';
                        chatButton.dataset.orderId = orderId;
                        chatButton.title = 'Abrir Chat';
                        chatButton.innerHTML = '<i class="fas fa-comment"></i> Chat';
                        actionsContainer.appendChild(chatButton);

                        const transition = statusTransitions[newStatus];
                        if (transition) {
                            actionsContainer.appendChild(createActionButton('update-status', orderId, transition.next, transition.text, transition.icon, transition.color));
                        }
                        if (newStatus === 'pendiente') {
                            actionsContainer.appendChild(createActionButton('cancel-order', orderId, 'cancelado', 'Cancelar', 'fa-times', 'outline-danger'));
                        }
                    }
                }

                showNotification(result.message || 'Estado del pedido actualizado', 'success');

            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar el estado del pedido.');
        }
    }
});
