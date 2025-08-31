// Función para cancelar automáticamente pedidos pendientes de pago
function cancelPendingPayments() {
  fetch('/dashboard/orders/cancel-pending-payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success && data.cancelledCount > 0) {
      console.log(`Pedidos cancelados: ${data.cancelledCount}`);
      // Si estamos en la página de pedidos, recargar para mostrar los cambios
      if (window.location.pathname.includes('/dashboard/orders')) {
        window.location.reload();
      }
    }
  })
  .catch(error => {
    console.error('Error cancelando pedidos pendientes de pago:', error);
  });
}

// Ejecutar la función cada 5 minutos
setInterval(cancelPendingPayments, 5 * 60 * 1000);

// Ejecutar una vez al cargar la página
document.addEventListener('DOMContentLoaded', function() {
  // Esperar un poco antes de ejecutar la primera vez
  setTimeout(cancelPendingPayments, 10000); // 10 segundos después de cargar
});
