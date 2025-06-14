// Función para cambiar el estado del restaurante
function toggleRestaurantStatus() {
    const statusElement = document.querySelector('[data-restaurant-status]');
    const isActive = statusElement.dataset.restaurantStatus === 'true';
    const accion = isActive ? 'desactivar' : 'activar';
    
    fetch('/dashboard/toggle-status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accion: accion })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            console.error('Error:', data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
} 