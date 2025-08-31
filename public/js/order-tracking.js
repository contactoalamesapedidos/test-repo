let map = null;
let driverMarker = null;

function initMap(lat, lng) {
    if (map) {
        map.remove();
    }
    map = L.map('deliveryMap').setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    driverMarker = L.marker([lat, lng]).addTo(map)
        .bindPopup('Ubicación del Repartidor')
        .openPopup();
}

document.addEventListener('DOMContentLoaded', () => {
    const orderStatus = document.getElementById('order-status-data').dataset.orderStatus;
    const repartidorId = document.getElementById('order-status-data').dataset.repartidorId;
    const deliveryMapDiv = document.getElementById('deliveryMap');
    const driverLocationStatus = document.getElementById('driver-location-status');
    const orderLat = parseFloat(document.getElementById('order-status-data').dataset.orderLat);
    const orderLng = parseFloat(document.getElementById('order-status-data').dataset.orderLng);

    if (orderStatus === 'en_camino' && repartidorId && deliveryMapDiv) {
        // Inicializar mapa con la ubicación de entrega del pedido como centro inicial
        initMap(orderLat, orderLng);

        const socket = io();
        const userId = document.getElementById('app-config').dataset.userId;
        if (userId) {
            socket.emit('join-user', userId); // Unirse a la sala del cliente
        }

        socket.on('driverLocationUpdate', (data) => {
            if (data.driverId == repartidorId) {
                const { latitude, longitude } = data;
                if (driverMarker) {
                    driverMarker.setLatLng([latitude, longitude]);
                    map.panTo([latitude, longitude]);
                    driverLocationStatus.textContent = `Repartidor en: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                } else {
                    initMap(latitude, longitude);
                }
            }
        });

        socket.on('orderStatusUpdate', (data) => {
            if (data.orderId == document.getElementById('order-status-data').dataset.orderId && data.status !== 'en_camino') {
                alert(`El estado de tu pedido ha cambiado a: ${data.status.replace(/_/g, ' ').toUpperCase()}`);
                window.location.reload(); // Recargar la página para reflejar el nuevo estado
            }
        });
    } else if (deliveryMapDiv) {
        deliveryMapDiv.style.display = 'none'; // Ocultar el mapa si no está en camino
    }
});
