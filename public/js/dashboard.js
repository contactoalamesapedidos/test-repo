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

 