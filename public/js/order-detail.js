document.addEventListener('DOMContentLoaded', () => {
    // Function to show order location on map
    window.showOrderLocation = function(lat, lng) {
        var modal = new bootstrap.Modal(document.getElementById('orderLocationModal'));
        modal.show();
        setTimeout(function() {
            var mapDiv = document.getElementById('orderLocationMap');
            mapDiv.innerHTML = ''; // Clear previous map
            var map = L.map('orderLocationMap').setView([lat, lng], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap',
                crossOrigin: true
            }).addTo(map);
            L.marker([lat, lng]).addTo(map);
            setTimeout(function() { map.invalidateSize(); }, 300);
        }, 300);
    };

    // Add event listener to the chat button
    const openClientChatBtn = document.getElementById('openClientChatBtn');
    if (openClientChatBtn) {
        openClientChatBtn.addEventListener('click', () => {
            const orderId = openClientChatBtn.dataset.orderId;
            window.open(`/orders/${orderId}/chat`, '_blank');
        });
    }

    // Add event listeners for action buttons
    const cancelBtn = document.getElementById('cancelOrderBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            cancelOrder(cancelBtn.dataset.orderId);
        });
    }

    const deliveredBtn = document.getElementById('markAsDeliveredBtn');
    if (deliveredBtn) {
        deliveredBtn.addEventListener('click', () => {
            markAsDelivered(deliveredBtn.dataset.orderId);
        });
    }

    // Manejo de subida de comprobante (transferencia)
    const comprobanteForm = document.getElementById('comprobanteForm');
    if (comprobanteForm) {
        comprobanteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const submitBtn = comprobanteForm.querySelector('button[type="submit"]');
                const fileInput = document.getElementById('comprobante');
                const orderIdInput = comprobanteForm.querySelector('input[name="orderId"]');
                const orderId = orderIdInput ? orderIdInput.value : null;
                if (!orderId) {
                    showNotification('Pedido inválido para subir comprobante', 'danger');
                    return;
                }
                if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                    showNotification('Selecciona un archivo para subir', 'warning');
                    return;
                }
                // Deshabilitar mientras sube
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = 'Subiendo...';
                }

                const formData = new FormData();
                formData.append('comprobante', fileInput.files[0]);

                const resp = await fetch(`/orders/${orderId}/upload-comprobante`, {
                    method: 'POST',
                    body: formData
                });
                const data = await resp.json().catch(() => ({ success: false, message: 'Respuesta inválida del servidor' }));

                if (!data.success) {
                    showNotification(data.message || 'Error al subir el comprobante', 'danger');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'Enviar Comprobante';
                    }
                    return;
                }

                // Éxito: ocultar formulario y mostrar vista previa
                const container = comprobanteForm.parentElement; // div p-3 bg-light rounded
                if (container) {
                    comprobanteForm.style.display = 'none';

                    const fileName = data.comprobante_url;
                    const fileUrl = `/uploads/comprobantes/${fileName}`;

                    const previewWrapper = document.createElement('div');
                    previewWrapper.className = 'mt-3';
                    previewWrapper.innerHTML = `
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title mb-3">Comprobante de Pago Subido</h6>
                                <div class="d-flex align-items-center">
                                    <a href="${fileUrl}" target="_blank" class="me-3">
                                        ${renderComprobantePreview(fileUrl)}
                                    </a>
                                    <div class="ms-3">
                                        <p class="mb-1">
                                            <i class="fas fa-file-image text-primary me-2"></i>
                                            <strong>Archivo:</strong> ${escapeHtml(fileName)}
                                        </p>
                                        <p class="mb-0">
                                            <i class="fas fa-external-link-alt text-info me-2"></i>
                                            <a href="${fileUrl}" target="_blank" class="text-decoration-none">Ver en ventana nueva</a>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                    container.appendChild(previewWrapper);
                }

                showNotification('Comprobante subido correctamente', 'success');
            } catch (err) {
                console.error('Error subiendo comprobante:', err);
                showNotification('Error de conexión al subir el comprobante', 'danger');
            }
        });
    }
});

function cancelOrder(orderId) {
    if (!confirm('¿Estás seguro de que quieres cancelar este pedido?')) {
        return;
    }

    fetch(`/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Pedido cancelado exitosamente', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification(data.message || 'Error al cancelar el pedido', 'error');
        }
    })
    .catch(error => {
        console.error('Error al cancelar pedido:', error);
        showNotification('Error de conexión al cancelar el pedido', 'error');
    });
}

function markAsDelivered(orderId) {
    if (!confirm('¿Confirmas que has recibido tu pedido?')) {
        return;
    }

    fetch(`/orders/${orderId}/mark-delivered`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Pedido marcado como entregado exitosamente', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification(data.message || 'Error al marcar como entregado', 'error');
        }
    })
    .catch(error => {
        console.error('Error al marcar como entregado:', error);
        showNotification('Error de conexión al marcar como entregado', 'error');
    });
}

// Función para mostrar notificaciones (si no existe ya)
if (typeof showNotification === 'undefined') {
    window.showNotification = function(message, type = 'info') {
        const toast = document.createElement('div');
        const bg = type === 'danger' ? 'bg-danger' : (type === 'warning' ? 'bg-warning' : (type === 'success' ? 'bg-success' : `bg-${type}`));
        toast.className = `toast align-items-center text-white ${bg} border-0 position-fixed bottom-0 end-0 m-3`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        const toastBody = document.createElement('div');
        toastBody.className = 'toast-body';
        toastBody.textContent = message;
        
        toast.appendChild(toastBody);
        document.body.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
    };
}