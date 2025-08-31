// Función para cargar el SDK de MercadoPago
function loadMercadoPagoSDK() {
    if (typeof MercadoPago !== 'undefined') {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve();
        script.onerror = () => {
            console.error('Error cargando el SDK de MercadoPago');
            showNotification('Error cargando el sistema de pagos', 'error');
            reject(new Error('Error cargando el SDK de MercadoPago'));
        };
        document.head.appendChild(script);
    });
}

let mp = null;
let currentOrder = null;
let mercadoPagoReady = null;

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type} border-0 position-fixed bottom-0 end-0 m-3`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  
  toast.innerHTML = `
      <div class="d-flex">
          <div class="toast-body">
              ${message}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
  `;
  
  document.body.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
  
  toast.addEventListener('hidden.bs.toast', () => {
      document.body.removeChild(toast);
  });
}

// Función para actualizar el total con descuento del 5% para efectivo y transferencia
function updateTotalWithDiscount() {
  const selectedPaymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
  const totalElement = document.querySelector('.price-breakdown strong:last-child');
  
  if (!totalElement || !selectedPaymentMethod) return;
  
  // Obtener el total original
  const originalTotal = totalData;
  
  // Verificar si hay un elemento de descuento existente
  let discountRow = document.querySelector('.discount-row');
  
  // Si el método de pago es efectivo o transferencia, aplicar descuento
  if (selectedPaymentMethod === 'efectivo' || selectedPaymentMethod === 'transferencia') {
    const discount = originalTotal * 0.05;
    const discountedTotal = originalTotal - discount;
    
    // Crear o actualizar la fila de descuento
    if (!discountRow) {
      discountRow = document.createElement('div');
      discountRow.className = 'discount-row d-flex justify-content-between mb-2 text-success';
      
      const priceBreakdown = document.querySelector('.price-breakdown');
      const hrElement = priceBreakdown.querySelector('hr');
      
      priceBreakdown.insertBefore(discountRow, hrElement);
    }
    
    discountRow.innerHTML = `
      <span>Descuento (5%):</span>
      <span>-$${discount.toFixed(2)}</span>
    `;
    
    // Actualizar el total mostrado
    totalElement.textContent = `$${discountedTotal.toFixed(2)}`;
  } else {
    // Si no hay descuento, eliminar la fila de descuento si existe
    if (discountRow) {
      discountRow.remove();
    }
    
    // Restaurar el total original
    totalElement.textContent = `$${originalTotal.toFixed(2)}`;
  }
}

let cartData, subtotalData, deliveryFeeData, totalData, userData;

try {
    const cartDataElement = document.getElementById('cart-data');
    if (cartDataElement) {
        const data = JSON.parse(cartDataElement.textContent);
        cartData = data.cart;
        subtotalData = data.subtotal;
        deliveryFeeData = data.deliveryFee;
        totalData = data.total;
        userData = data.user;
    }
} catch (error) {
    console.error('Error parsing cart data:', error);
}

async function confirmOrder() {
    console.log('confirmOrder function called.');
    const deliveryAddressInput = document.getElementById('deliveryAddress');
    const confirmBtn = document.getElementById('confirmOrderBtn');

    // Resetear estados de validación previos
    deliveryAddressInput.classList.remove('is-invalid');
    document.getElementById('deliveryAddressError').textContent = '';

    const specialInstructions = document.getElementById('specialInstructions').value.trim();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

    let isValid = true;

    // Validación de Dirección de Entrega
    if (!deliveryAddressInput.value.trim()) {
        deliveryAddressInput.classList.add('is-invalid');
        document.getElementById('deliveryAddressError').textContent = 'Por favor, ingresa una dirección de entrega.';
        isValid = false;
    } else { // Added else block to clear previous error if address is now valid
        deliveryAddressInput.classList.remove('is-invalid');
        document.getElementById('deliveryAddressError').textContent = '';
    }

    if (!isValid) {
        showNotification('Por favor, ingresa una dirección de entrega.', 'error'); // Changed message
        return;
    }

    // Obtener lat/lng confirmados si corresponde
    let latitude = '';
    let longitude = '';
    const betterLocationCheckbox = document.getElementById('betterLocationCheckbox');
    if (betterLocationCheckbox && betterLocationCheckbox.checked && typeof window.lastConfirmed === 'object' && window.lastConfirmed) {
        latitude = window.lastConfirmed[0];
        longitude = window.lastConfirmed[1];
    }

    // Crear form data
    const formData = new FormData();
    formData.append('direccion', deliveryAddressInput.value.trim());
    formData.append('ciudad', userData ? userData.ciudad : '');
    formData.append('instrucciones', specialInstructions);
    formData.append('metodo_pago', paymentMethod);
    if (latitude && longitude) {
        formData.append('latitude', latitude);
        formData.append('longitude', longitude);
    }
    formData.append('cart', JSON.stringify(cartData));
    formData.append('subtotal', subtotalData);
    formData.append('deliveryFee', deliveryFeeData);
    
    // Enviar el total con descuento si aplica
    let finalTotal = totalData;
    if (paymentMethod === 'efectivo' || paymentMethod === 'transferencia') {
        // El descuento se aplicará en el backend, pero enviamos el total original
        console.log('Enviando pedido con método de pago elegible para descuento:', paymentMethod);
    }
    formData.append('total', finalTotal);

    // Deshabilitar botón y mostrar carga
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

    try {
        if (paymentMethod === 'mercadopago') {
            await mercadoPagoReady;
        }

        const orderResponse = await fetch('/orders/create', {
            method: 'POST',
            body: formData
        });

        console.log('Preference response status:', orderResponse.status); // Add this log
        const orderData = await orderResponse.json();
        console.log('Respuesta del backend:', orderData); // Debug

        if (!orderData.success) {
            throw new Error(orderData.message || 'Error creando el pedido');
        }

        if (!orderData.orderId) {
            throw new Error('No se recibió el ID del pedido');
        }

        // Handle payment based on method
        if (paymentMethod === 'mercadopago') {
            if (!mp) {
                throw new Error('El sistema de pagos no está disponible');
            }
            processMercadoPagoPayment(orderData.orderId);
        } else {
            // For cash or transfer, just redirect to success/detail page
            window.location.href = `/orders/${orderData.orderId}`;
        }
    } catch (error) {
        console.error('Error confirming order:', error);
        showNotification(error.message || 'Error confirmando el pedido', 'error');
    } finally {
        // Re-enable button
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-check me-2"></i>Confirmar Pedido';
    }
}

async function processMercadoPagoPayment(orderId) {
    console.log('Processing MercadoPago payment for orderId:', orderId);
    try {
        const preferenceResponse = await fetch('/payments/create-preference', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                orderId: orderId
            })
        });

        console.log('Preference response status:', preferenceResponse.status); // Add this log
        const preferenceData = await preferenceResponse.json();
        console.log('Respuesta de preferencia:', preferenceData); // Debug

        if (!preferenceData.success) {
            throw new Error(preferenceData.message || 'Error creando preferencia de pago');
        }

        // Open MercadoPago checkout
        const checkout = mp.checkout({
            preference: {
                id: preferenceData.preferenceId
            },
            autoOpen: true
        });

        
    } catch (error) {
        console.error('Error processing MercadoPago payment:', error);
        showNotification(error.message || 'Error procesando el pago', 'error');
    }
}

// Update delivery cost based on address
document.getElementById('deliveryAddress').addEventListener('blur', function() {
    const address = this.value.trim();
    if (address) {
        // This could be enhanced to calculate delivery cost based on distance
        console.log('Address updated:', address);
    }
});


// Leaflet Map Logic
document.addEventListener('DOMContentLoaded', function() {
    if (cartData && cartData.length > 0) {
        const restaurantId = cartData[0].restaurante_id;
        mercadoPagoReady = loadMercadoPagoSDK()
            .then(() => {
                console.log('MercadoPago SDK loaded.');
                console.log('Fetching public key for restaurant...');
                return fetch(`/payments/public-key/${restaurantId}`);
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error al obtener la clave pública del restaurante.');
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                console.log('Public Key received:', data.publicKey);
                mp = new MercadoPago(data.publicKey);
                console.log('MercadoPago instance created.');
            })
            .catch(error => {
                console.error('Error inicializando MercadoPago:', error);
                showNotification(error.message || 'No se pudo inicializar el sistema de pagos.', 'error');
                // Disable the MercadoPago option
                const mpRadio = document.getElementById('mercadopago');
                if (mpRadio) {
                    mpRadio.disabled = true;
                    mpRadio.parentElement.classList.add('disabled');
                }
            });
    }
    
    // Inicializar los radio buttons de método de pago para mostrar el descuento
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    if (paymentMethods.length > 0) {
        paymentMethods.forEach(method => {
            method.addEventListener('change', updateTotalWithDiscount);
        });
        // Aplicar descuento inicial si el método seleccionado es efectivo o transferencia
        updateTotalWithDiscount();
    }
    
    console.log('DOM Content Loaded - checkout.js script running.');
    var checkbox = document.getElementById('betterLocationCheckbox');
    var mapContainer = document.getElementById('leafletMapContainer');
    var mapDiv = document.getElementById('leafletMap');
    var latInput = document.getElementById('latitude');
    var lngInput = document.getElementById('longitude');
    var confirmBtn = document.getElementById('confirmMapLocationBtn');
    var map = null;
    var lastCenter = [-33.883333333333, -61.1];
    var marker = null;
    var lastConfirmed = null;
    window.lastConfirmed = lastConfirmed;
    var editingLocation = false;

    function showMapAndInit() {
        mapContainer.style.display = 'block';
        setTimeout(function() {
            if (!map) {
                map = L.map('leafletMap').setView(lastCenter, 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap',
                    crossOrigin: true
                }).addTo(map);
                // Centrar en ubicación real si es posible
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function(pos) {
                        var lat = pos.coords.latitude;
                        var lng = pos.coords.longitude;
                        map.setView([lat, lng], 16);
                        lastCenter = [lat, lng];
                        setTimeout(function() { map.invalidateSize(); }, 200);
                    }, function() {
                        setTimeout(function() { map.invalidateSize(); }, 200);
                    });
                } else {
                    setTimeout(function() { map.invalidateSize(); }, 200);
                }
                map.on('move', function() {
                    var center = map.getCenter();
                    lastCenter = [center.lat, center.lng];
                });
            } else {
                setTimeout(function() { map.invalidateSize(); }, 200);
            }
            // Si ya hay una ubicación confirmada, mostrar el marcador
            if (lastConfirmed) {
                if (!marker) {
                    marker = L.marker(lastConfirmed).addTo(map);
                } else {
                    marker.setLatLng(lastConfirmed);
                }
            } else if (marker) {
                map.removeLayer(marker);
                marker = null;
            }
        }, 200);
    }
    function hideMap() {
        mapContainer.style.display = 'none';
        latInput.value = '';
        lngInput.value = '';
    }
    checkbox.addEventListener('change', function() {
        if (checkbox.checked) {
            showMapAndInit();
        } else {
            hideMap();
        }
    });
    confirmBtn.addEventListener('click', function() {
        if (map) {
            if (!editingLocation) {
                var center = map.getCenter();
                latInput.value = center.lat;
                lngInput.value = center.lng;
                lastConfirmed = [center.lat, center.lng];
                window.lastConfirmed = lastConfirmed;
                if (!marker) {
                    marker = L.marker(lastConfirmed).addTo(map);
                } else {
                    marker.setLatLng(lastConfirmed);
                }
                // Ocultar el marcador del centro visual
                var markerCenterDiv = document.getElementById('mapMarkerCenter');
                if (markerCenterDiv) markerCenterDiv.style.display = 'none';
                confirmBtn.classList.remove('btn-success');
                confirmBtn.classList.add('btn-warning');
                confirmBtn.textContent = 'Editar ubicación';
                editingLocation = true;
            } else {
                // Volver a modo edición
                var markerCenterDiv = document.getElementById('mapMarkerCenter');
                if (markerCenterDiv) markerCenterDiv.style.display = '';
                if (marker) {
                    map.removeLayer(marker);
                    marker = null;
                }
                confirmBtn.classList.remove('btn-warning');
                confirmBtn.classList.add('btn-success');
                confirmBtn.textContent = 'Confirmar ubicación';
                editingLocation = false;
            }
        }
    });

    const confirmOrderButton = document.getElementById('confirmOrderBtn');
    console.log('confirmOrderButton element:', confirmOrderButton); // Debug log
    if (confirmOrderButton) {
        confirmOrderButton.addEventListener('click', confirmOrder);
    }
});
