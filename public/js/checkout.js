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
function showNotification(message, type = 'info', size = 'normal') {
  const toast = document.createElement('div');
  const isLarge = size === 'large';

  // Clases base para el toast
  let toastClasses = `toast align-items-center text-white bg-${type} border-0 position-fixed`;

  // Posicionamiento y tamaño según el parámetro size
  if (isLarge) {
    // Para ubicación confirmada: abajo a la derecha, más pequeño, no se auto-oculta
    toastClasses += ' bottom-0 end-0 m-3';
    toast.style.minWidth = '300px';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '9999';
  } else {
    toastClasses += ' bottom-0 end-0 m-3';
  }

  toast.className = toastClasses;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  // Contenido del toast con icono apropiado
  const iconClass = type === 'success' ? 'fas fa-check-circle' :
                   type === 'error' ? 'fas fa-exclamation-triangle' :
                   type === 'warning' ? 'fas fa-exclamation-circle' :
                   'fas fa-info-circle';

  toast.innerHTML = `
      <div class="d-flex">
          <div class="toast-icon me-2">
              <i class="${iconClass} fs-5"></i>
          </div>
          <div class="toast-body flex-grow-1">
              <strong>${message}</strong>
          </div>
          <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast"></button>
      </div>
  `;

  document.body.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, {
    autohide: !isLarge, // Los toasts grandes no se auto-ocultan
    delay: isLarge ? 0 : 3000 // Los grandes no tienen delay de auto-ocultamiento
  });
  bsToast.show();

  toast.addEventListener('hidden.bs.toast', () => {
      document.body.removeChild(toast);
  });
}

// Función para geocodificación inversa usando Nominatim (gratuita)
async function reverseGeocode(lat, lng) {
    try {
        console.log('Realizando geocodificación inversa para:', lat, lng);

        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: {
                'User-Agent': 'A-La-Mesa-App/1.0'
            }
        });

        if (!response.ok) {
            throw new Error('Error en la geocodificación inversa');
        }

        const data = await response.json();
        console.log('Respuesta de geocodificación:', data);

        if (data && data.display_name) {
            // Formatear la dirección de manera más legible para Argentina
            return formatArgentinianAddress(data);
        } else {
            throw new Error('No se pudo obtener la dirección');
        }
    } catch (error) {
        console.error('Error en geocodificación inversa:', error);
        return null;
    }
}

// Función para formatear direcciones argentinas de manera más legible
function formatArgentinianAddress(data) {
    const address = data.address || {};
    const displayName = data.display_name || '';

    console.log('Formateando dirección:', { address, displayName });

    // PRIMERO INTENTAR USAR EL DISPLAY_NAME CON FORMATO MUY SIMPLE
    if (displayName) {
        // Limpiar el display_name de manera muy agresiva
        let cleanAddress = displayName
            .replace(', Argentina', '') // Remover país
            .replace(/, Buenos Aires$/, '') // Remover provincia completa
            .replace(/, Autonomous City of Buenos Aires$/, '') // Remover variante de provincia
            .replace(/, [A-Z]\d{4}[A-Z]{2}/g, '') // Remover códigos postales B2720CJN
            .replace(/, \d{4}/g, '') // Remover códigos postales normales
            .replace(/, Bs As/g, '') // Remover abreviatura de provincia
            .replace(/, [A-Z][^,]*[A-Z]\s*\d+/g, '') // Remover state_district (ej: "Partido de La Plata 1")
            .replace(/, Partido de [^,]+/g, '') // Remover "Partido de ..."
            .trim();

        // Remover barrios/localidades comunes que no son necesarios
        const barriosAEliminar = [
            'Belgrano', 'Centenario', 'San Nicolás', 'Monserrat', 'Constitución',
            'Retiro', 'Recoleta', 'Palermo', 'Almagro', 'Caballito', 'Flores',
            'Parque Chacabuco', 'Villa Crespo', 'Villa del Parque', 'Agronomía',
            'Villa Pueyrredón', 'Villa Urquiza', 'Coghlan', 'Saavedra', 'Núñez',
            'Belgrano R', 'Colegiales', 'Balvanera', 'San Cristóbal', 'La Boca',
            'Barracas', 'Parque Patricios', 'Nueva Pompeya', 'Villa Soldati',
            'Villa Riachuelo', 'Villa Lugano', 'Liniers', 'Mataderos', 'Parque Avellaneda',
            'Villa Real', 'Monte Castro', 'Versalles', 'Floresta', 'Vélez Sársfield',
            'Villa Luro', 'Villa General Mitre', 'Villa Devoto', 'Villa del Parque',
            'Villa Santa Rita', 'Paternal', 'Villa Ortúzar', 'Puerto Madero'
        ];

        // Remover barrios/localidades
        for (const barrio of barriosAEliminar) {
            cleanAddress = cleanAddress.replace(new RegExp(`, ${barrio}`, 'gi'), '');
            cleanAddress = cleanAddress.replace(new RegExp(`${barrio}, `, 'gi'), '');
        }

        // Función para reorganizar dirección con número correctamente
        function reorganizeAddressWithNumber(addressText) {
            if (!addressText) return addressText;

            // Buscar patrón: número + coma + calle (al principio) - FORMATO CORRECTO: calle número
            const numberFirstPattern = /^(\d{1,4})\s*,\s*(.+)/;
            const match = addressText.match(numberFirstPattern);

            if (match) {
                const number = match[1];
                const street = match[2];
                // Reorganizar para que quede: calle + número
                return `${street.trim()} ${number}`;
            }

            return addressText;
        }

        cleanAddress = reorganizeAddressWithNumber(cleanAddress);
        console.log('Dirección reorganizada:', cleanAddress);

        // Limpiar espacios múltiples y comas
        cleanAddress = cleanAddress
            .replace(/\s+/g, ' ') // Espacios múltiples → espacio simple
            .replace(/,\s*,/g, ',') // Comas múltiples → coma simple
            .replace(/^,|,$/g, '') // Remover comas al inicio/final
            .trim();

        // Si la dirección tiene buena longitud y contiene calle + número, usarla
        if (cleanAddress && cleanAddress.length >= 5 && /\d/.test(cleanAddress)) {
            console.log('Usando dirección simplificada:', cleanAddress);
            return cleanAddress.trim();
        }
    }

    // SI EL DISPLAY_NAME NO FUNCIONA, USAR FORMATO road + house_number + town + state
    console.log('Display_name no es confiable, usando formato road + house_number + town + state');

    let houseNumber = address.house_number || '';
    let road = address.road || address.pedestrian || address.path || '';
    const city = address.city || address.town || address.village || '';
    const state = address.state || '';

    console.log('Componentes antes de procesar:', { houseNumber, road, city, state });

    // Si no hay house_number pero hay road, intentar extraer número del road
    if (!houseNumber && road) {
        const numberMatch = road.match(/(\d{1,4})\s*$/);
        if (numberMatch) {
            houseNumber = numberMatch[1];
            road = road.replace(/\s+\d{1,4}\s*$/, '').trim();
            console.log('Número extraído del road:', { houseNumber, road });
        }
    }

    // Si aún no hay house_number, intentar extraer del display_name
    if (!houseNumber && displayName) {
        const numberMatch = displayName.match(/(\d{1,4})\s*,/);
        if (numberMatch) {
            houseNumber = numberMatch[1];
            console.log('Número extraído del display_name:', houseNumber);
        }
    }

    let formattedAddress = '';

    // CONSTRUIR CON house_number AL PRINCIPIO: house_number + road + city + state
    if (houseNumber) {
        formattedAddress = houseNumber;
        console.log('Agregado house_number al principio:', formattedAddress);
    }

    // Agregar road con espacio si existe
    if (road) {
        if (formattedAddress) {
            formattedAddress += ` ${road}`;
        } else {
            formattedAddress = road;
        }
        console.log('Agregado road:', formattedAddress);
    }

    // Agregar ciudad (town) con coma si existe y no es Buenos Aires
    if (city && city !== 'Buenos Aires' && city !== 'Autonomous City of Buenos Aires') {
        formattedAddress += `, ${city}`;
        console.log('Agregada ciudad:', formattedAddress);
    }

    // Agregar provincia (state) con coma si existe y no es Buenos Aires
    if (state && state !== 'Buenos Aires' && state !== 'Autonomous City of Buenos Aires') {
        formattedAddress += `, ${state}`;
        console.log('Agregado state:', formattedAddress);
    }

    // Si aún no tenemos dirección, usar display_name original limpio
    if (!formattedAddress || formattedAddress.length < 5) {
        console.log('Componentes fallaron, usando display_name original limpio');
        return displayName ? displayName.replace(', Argentina', '').trim() : 'Dirección no disponible';
    }

    console.log('Dirección formateada final:', formattedAddress);
    return formattedAddress.trim();
}

// Variable para rastrear si la dirección actual fue generada automáticamente
let isAutoGeneratedAddress = false;

// Función para actualizar la dirección en el campo de entrada
function updateAddressField(address) {
    const addressInput = document.getElementById('deliveryAddress');
    if (addressInput && address) {
        // Solo actualizar si el campo está vacío o contiene una dirección generada automáticamente
        const currentValue = addressInput.value.trim();

        if (!currentValue || isAutoGeneratedAddress) {
            addressInput.value = address;
            isAutoGeneratedAddress = true; // Marcar como generada automáticamente
            console.log('Dirección actualizada automáticamente:', address);
            showNotification('Dirección actualizada automáticamente desde el mapa', 'success');
        } else {
            // Si ya hay una dirección escrita por el usuario, mostrar sugerencia
            console.log('Dirección sugerida (no aplicada):', address);
            showNotification('Dirección sugerida: ' + address.substring(0, 50) + '...', 'info');
        }
    }
}

// Función para manejar cuando el usuario comienza a escribir manualmente
function handleManualAddressInput() {
    const addressInput = document.getElementById('deliveryAddress');
    if (addressInput) {
        addressInput.addEventListener('input', function() {
            // Si el usuario está escribiendo, marcar que ya no es una dirección automática
            if (this.value.trim() && isAutoGeneratedAddress) {
                isAutoGeneratedAddress = false;
                console.log('Usuario comenzó a editar la dirección manualmente');
            }
        });
    }
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
  
  // Check if the restaurant offers cash/transfer discount
  const offersCashDiscount = restaurantData && restaurantData.ofrece_descuento_efectivo;

  // Si el método de pago es efectivo o transferencia Y el restaurante ofrece el descuento, aplicar descuento
  if (offersCashDiscount && (selectedPaymentMethod === 'efectivo' || selectedPaymentMethod === 'transferencia')) {
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
      <span>-${discount.toFixed(2)}</span>
    `;
    
    // Actualizar el total mostrado
    totalElement.textContent = `${discountedTotal.toFixed(2)}`;
  } else {
    // Si no hay descuento o el restaurante no lo ofrece, eliminar la fila de descuento si existe
    if (discountRow) {
      discountRow.remove();
    }
    
    // Restaurar el total original
    totalElement.textContent = `${originalTotal.toFixed(2)}`;
  }
}

let cartData, subtotalData, deliveryFeeData, totalData, userData, restaurantData; // Add restaurantData

function loadCartData() {
    try {
        const cartDataElement = document.getElementById('cart-data');
        if (cartDataElement && cartDataElement.textContent.trim()) {
            const data = JSON.parse(cartDataElement.textContent);
            cartData = data.cart;
            subtotalData = data.subtotal;
            deliveryFeeData = data.deliveryFee;
            totalData = data.total;
            userData = data.user;
            restaurantData = data.restaurant; // Retrieve restaurant data
            console.log('Cart data loaded successfully:', { cartData, subtotalData, totalData, restaurantData });
        } else {
            console.error('Cart data element not found or empty');
        }
    } catch (error) {
        console.error('Error parsing cart data:', error);
    }
}

// Variable global para controlar si la ubicación está confirmada
let locationConfirmed = false;

async function confirmOrder() {
    console.log('confirmOrder function called.');

    // Verificar si la ubicación está confirmada
    if (!locationConfirmed) {
        showNotification('Por favor, confirma tu ubicación en el mapa antes de continuar.', 'warning');
        // Hacer scroll al mapa
        const mapContainer = document.getElementById('leafletMapContainer');
        if (mapContainer) {
            mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    // Ensure cart data is loaded - try to load it if not already loaded
    if (!cartData || !Array.isArray(cartData) || cartData.length === 0) {
        console.log('Cart data not loaded, attempting to load...');
        loadCartData();

        // Wait a bit for data to load
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!cartData || !Array.isArray(cartData) || cartData.length === 0) {
            console.error('Cart data still not loaded or empty:', cartData);
            showNotification('Error: Los datos del carrito no están disponibles. Por favor, recarga la página.', 'error');
            return;
        }
    }

    const deliveryAddressInput = document.getElementById('deliveryAddress');
    const confirmBtn = document.getElementById('confirmOrderBtn');

    // Resetear estados de validación previos
    deliveryAddressInput.classList.remove('is-invalid');
    document.getElementById('deliveryAddressError').textContent = '';

    const specialInstructions = document.getElementById('specialInstructions').value.trim();
    const paymentMethodElement = document.querySelector('input[name="paymentMethod"]:checked');
    const paymentMethod = paymentMethodElement ? paymentMethodElement.value : '';

    console.log('Payment method element:', paymentMethodElement);
    console.log('Payment method value:', paymentMethod);

    let isValid = true;

    // Validación de Dirección de Entrega
    if (!deliveryAddressInput.value.trim()) {
        deliveryAddressInput.classList.add('is-invalid');
        document.getElementById('deliveryAddressError').textContent = 'Por favor, ingresa una dirección de entrega.';
        isValid = false;
    } else {
        deliveryAddressInput.classList.remove('is-invalid');
        document.getElementById('deliveryAddressError').textContent = '';
    }

    if (!isValid) {
        showNotification('Por favor, ingresa una dirección de entrega.', 'error');
        return;
    }

    // Obtener lat/lng del mapa (ya confirmado)
    let latitude = '';
    let longitude = '';
    if (typeof window.lastConfirmed === 'object' && window.lastConfirmed && Array.isArray(window.lastConfirmed) && window.lastConfirmed.length === 2) {
        latitude = parseFloat(window.lastConfirmed[0]);
        longitude = parseFloat(window.lastConfirmed[1]);
        console.log('📍 Usando coordenadas confirmadas del mapa:', latitude, longitude);
    } else {
        console.error('❌ Error: No hay coordenadas disponibles');
        showNotification('Error interno. Por favor, recarga la página.', 'error');
        return;
    }

    // Proceder con el pedido
    proceedWithOrder(deliveryAddressInput, confirmBtn, specialInstructions, paymentMethod, latitude, longitude);
}

// Función para confirmar ubicación
function confirmLocation() {
    console.log('Confirmando ubicación...');

    // Verificar que haya coordenadas válidas
    if (typeof window.lastConfirmed !== 'object' || !window.lastConfirmed || !Array.isArray(window.lastConfirmed) || window.lastConfirmed.length !== 2) {
        showNotification('Por favor, ajusta tu ubicación en el mapa antes de confirmar.', 'warning');
        return;
    }

    const latitude = parseFloat(window.lastConfirmed[0]);
    const longitude = parseFloat(window.lastConfirmed[1]);

    // Validar coordenadas
    if (isNaN(latitude) || isNaN(longitude) ||
        latitude < -90 || latitude > 90 ||
        longitude < -180 || longitude > 180) {
        showNotification('Las coordenadas del mapa no son válidas. Por favor, ajusta la ubicación.', 'error');
        return;
    }

    // Marcar como confirmado
    locationConfirmed = true;

    // Actualizar UI
    const confirmLocationBtn = document.getElementById('confirmLocationBtn');
    const confirmOrderBtn = document.getElementById('confirmOrderBtn');

    if (confirmLocationBtn) {
        confirmLocationBtn.disabled = true;
        confirmLocationBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i> Ubicación Confirmada';
        confirmLocationBtn.classList.remove('btn-success');
        confirmLocationBtn.classList.add('btn-secondary');
    }

    if (confirmOrderBtn) {
        confirmOrderBtn.disabled = false;
        confirmOrderBtn.innerHTML = '<i class="fas fa-check me-2"></i> Confirmar Pedido';
    }

    // Mostrar mensaje de éxito GRANDE
    const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
    showNotification(`Ubicación confirmada: ${deliveryAddress}`, 'success', 'large');

    console.log('Ubicación confirmada correctamente');
}

// Función separada para procesar el pedido después de la confirmación
async function proceedWithOrder(deliveryAddressInput, orderBtn, specialInstructions, paymentMethod, latitude, longitude) {

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

    // Debug: Log all form data
    console.log('Form data being sent:');
    for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
    }

    // Deshabilitar botón y mostrar carga
    orderBtn.disabled = true;
    orderBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

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
        orderBtn.disabled = false;
        orderBtn.innerHTML = '<i class="fas fa-check me-2"></i>Confirmar Pedido';
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
    // Load cart data first
    loadCartData();

    // Inicializar el manejo de entrada manual de dirección
    handleManualAddressInput();

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
                    throw new Error('El restaurante no tiene configurado MercadoPago para recibir pagos.');
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error('El restaurante no tiene configurado MercadoPago para recibir pagos.');
                }
                console.log('Public Key received:', data.publicKey);
                mp = new MercadoPago(data.publicKey);
                console.log('MercadoPago instance created with restaurant-specific key.');
            })
            .catch(error => {
                console.error('Error inicializando MercadoPago:', error);
                showNotification('El restaurante no tiene configurado MercadoPago. Los pagos no estarán disponibles.', 'warning');
                // Disable the MercadoPago option
                const mpRadio = document.getElementById('mercadopago');
                if (mpRadio) {
                    mpRadio.disabled = true;
                    mpRadio.parentElement.classList.add('disabled');
                    mpRadio.nextElementSibling.textContent += ' (No disponible - Restaurante sin configurar)';
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
    var mapContainer = document.getElementById('leafletMapContainer');
    var mapDiv = document.getElementById('leafletMap');
    var latInput = document.getElementById('latitude');
    var lngInput = document.getElementById('longitude');
    var map = null;
    var lastCenter = [-33.883333333333, -61.1];
    var marker = null;
    var lastConfirmed = null;
    window.lastConfirmed = lastConfirmed;

    // Asegurar que lastConfirmed esté disponible globalmente
    console.log('Inicializando window.lastConfirmed:', window.lastConfirmed);

    function showMapAndInit() {
        console.log('Inicializando mapa...');
        mapContainer.style.display = 'block';

        // Verificar que Leaflet esté disponible
        function checkLeafletAndInit(retryCount = 0) {
            const maxRetries = 10;

            if (typeof L === 'undefined') {
                if (retryCount < maxRetries) {
                    console.log(`Leaflet no disponible, reintentando... (${retryCount + 1}/${maxRetries})`);
                    setTimeout(() => checkLeafletAndInit(retryCount + 1), 500);
                } else {
                    console.error('Leaflet no se cargó después de varios intentos');
                    showNotification('Error cargando el mapa. Por favor, recarga la página.', 'error');
                    // Ocultar loading y mostrar mensaje de error
                    const loadingDiv = document.getElementById('mapLoading');
                    if (loadingDiv) {
                        loadingDiv.innerHTML = `
                            <div class="text-center">
                                <i class="fas fa-exclamation-triangle text-warning fs-2 mb-2"></i>
                                <div class="text-muted">Error al cargar el mapa</div>
                                <button class="btn btn-sm btn-outline-primary mt-2" onclick="location.reload()">Recargar página</button>
                            </div>
                        `;
                    }
                }
                return;
            }

            // Leaflet está disponible, proceder con la inicialización
            initializeMap();
        }

        // El loading se ocultará automáticamente cuando el mapa esté listo (map.whenReady)

        // Iniciar verificación de Leaflet
        checkLeafletAndInit();
    }

    function initializeMap() {
        setTimeout(function() {
            try {
                console.log('Creando instancia del mapa...');
                if (!map) {
                    // Verificar que el contenedor del mapa existe
                    const mapDiv = document.getElementById('leafletMap');
                    if (!mapDiv) {
                        console.error('Contenedor del mapa no encontrado');
                        return;
                    }

                    // Crear mapa con configuración básica
                    map = L.map('leafletMap', {
                        center: lastCenter,
                        zoom: 13,
                        zoomControl: true,
                        scrollWheelZoom: true
                    });

                    console.log('Mapa creado, agregando capa de tiles...');

                    // Agregar capa de tiles con mejor configuración
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        minZoom: 3,
                        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                        crossOrigin: true
                    }).addTo(map);

                    // Ocultar loading cuando el mapa esté listo
                    map.whenReady(function() {
                        console.log('Mapa completamente cargado y listo');
                        const loadingDiv = document.getElementById('mapLoading');
                        if (loadingDiv) {
                            loadingDiv.style.display = 'none';
                            console.log('Loading indicator hidden - map ready');
                        }
                    });

                    console.log('Capa de tiles agregada, configurando ubicación...');

                    // Intentar obtener ubicación del usuario
                    if (navigator.geolocation) {
                        console.log('Intentando obtener geolocalización...');
                        navigator.geolocation.getCurrentPosition(
                            function(pos) {
                                const lat = pos.coords.latitude;
                                const lng = pos.coords.longitude;
                                console.log('Ubicación obtenida:', lat, lng);

                                lastCenter = [lat, lng];
                                map.setView([lat, lng], 16);

                        // Crear marcador
                        createDraggableMarker([lat, lng]);

                        // Realizar geocodificación inversa para la ubicación obtenida
                        reverseGeocode(lat, lng).then(address => {
                            if (address) {
                                updateAddressField(address);
                            }
                        }).catch(error => {
                            console.error('Error obteniendo dirección de geolocalización:', error);
                        });

                        setTimeout(function() { map.invalidateSize(); }, 200);
                            },
                            function(error) {
                                console.warn('Error obteniendo ubicación:', error);
                                // Usar ubicación por defecto
                                createDraggableMarker(lastCenter);
                                setTimeout(function() { map.invalidateSize(); }, 200);
                            },
                            {
                                enableHighAccuracy: true,
                                timeout: 10000,
                                maximumAge: 300000
                            }
                        );
                    } else {
                        console.log('Geolocalización no soportada, usando ubicación por defecto');
                        createDraggableMarker(lastCenter);
                        setTimeout(function() { map.invalidateSize(); }, 200);
                    }

                    console.log('Mapa inicializado correctamente');
                } else {
                    console.log('Mapa ya existe, invalidando tamaño...');
                    setTimeout(function() { map.invalidateSize(); }, 200);
                }
            } catch (error) {
                console.error('Error inicializando mapa:', error);
                showNotification('Error cargando el mapa. Por favor, recarga la página.', 'error');
            }
        }, 300);
    }

    function createDraggableMarker(position) {
        console.log('Creando marcador arrastrable en:', position);

        if (marker) {
            map.removeLayer(marker);
        }

        marker = L.marker(position, {
            draggable: true,
            icon: L.icon({
                iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
                shadowSize: [41, 41]
            })
        }).addTo(map);

        // Actualizar coordenadas iniciales
        latInput.value = position[0];
        lngInput.value = position[1];
        window.lastConfirmed = position;

        // Habilitar el botón de confirmar ubicación cuando hay coordenadas
        const confirmLocationBtn = document.getElementById('confirmLocationBtn');
        if (confirmLocationBtn && confirmLocationBtn.disabled) {
            confirmLocationBtn.disabled = false;
        }

        // Configurar eventos del marcador
        marker.on('dragend', async function(event) {
            const newPosition = marker.getLatLng();
            latInput.value = newPosition.lat;
            lngInput.value = newPosition.lng;
            window.lastConfirmed = [newPosition.lat, newPosition.lng];
            console.log('Marcador movido a:', newPosition);

            // Realizar geocodificación inversa para obtener la dirección
            try {
                const address = await reverseGeocode(newPosition.lat, newPosition.lng);
                if (address) {
                    updateAddressField(address);
                }
            } catch (error) {
                console.error('Error obteniendo dirección:', error);
                showNotification('No se pudo obtener la dirección automáticamente.', 'warning');
            }

            showNotification('Ubicación actualizada arrastrando el marcador.', 'success');

            // Resetear confirmación si se mueve el marcador
            if (locationConfirmed) {
                locationConfirmed = false;
                const confirmLocationBtn = document.getElementById('confirmLocationBtn');
                const confirmOrderBtn = document.getElementById('confirmOrderBtn');

                if (confirmLocationBtn) {
                    confirmLocationBtn.disabled = false;
                    confirmLocationBtn.innerHTML = '<i class="fas fa-check me-2"></i> Confirmar Ubicación';
                    confirmLocationBtn.classList.remove('btn-secondary');
                    confirmLocationBtn.classList.add('btn-success');
                }

                if (confirmOrderBtn) {
                    confirmOrderBtn.disabled = true;
                }
            }
        });

        marker.on('drag', function(event) {
            const newPosition = marker.getLatLng();
            latInput.value = newPosition.lat;
            lngInput.value = newPosition.lng;
            window.lastConfirmed = [newPosition.lat, newPosition.lng];
        });

        console.log('Marcador creado correctamente');
    }

    // Get Current Location Button Logic
    const getCurrentLocationBtn = document.getElementById('getCurrentLocationBtn');
    if (getCurrentLocationBtn) {
        getCurrentLocationBtn.addEventListener('click', function() {
            if (navigator.geolocation) {
                // Mostrar indicador de carga
                getCurrentLocationBtn.disabled = true;
                getCurrentLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Obteniendo...';

                navigator.geolocation.getCurrentPosition(function(position) {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    if (map && marker) {
                        // Centrar mapa en la ubicación actual
                        map.setView([lat, lng], 16);

                        // Mover el marcador existente a la nueva ubicación
                        marker.setLatLng([lat, lng]);

                        // Actualizar coordenadas
                        latInput.value = lat;
                        lngInput.value = lng;
                        window.lastConfirmed = [lat, lng];

                        // Realizar geocodificación inversa para la ubicación obtenida
                        reverseGeocode(lat, lng).then(address => {
                            if (address) {
                                updateAddressField(address);
                            }
                        }).catch(error => {
                            console.error('Error obteniendo dirección de ubicación actual:', error);
                        });

                        showNotification('Ubicación actual obtenida y marcador posicionado.', 'success');
                    } else {
                        showNotification('El mapa no está inicializado correctamente.', 'error');
                    }

                    // Restaurar botón
                    getCurrentLocationBtn.disabled = false;
                    getCurrentLocationBtn.innerHTML = '<i class="fas fa-crosshairs me-1"></i> Usar Mi Ubicación Actual';

                }, function(error) {
                    console.error('Error getting current location:', error);
                    let errorMessage = 'No se pudo obtener la ubicación actual.';
                    if (error.code === error.PERMISSION_DENIED) {
                        errorMessage += ' Permiso denegado. Por favor, habilita los servicios de ubicación.';
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        errorMessage += ' Información de ubicación no disponible.';
                    } else if (error.code === error.TIMEOUT) {
                        errorMessage += ' La solicitud para obtener la ubicación ha caducado.';
                    }
                    showNotification(errorMessage, 'error');

                    // Restaurar botón
                    getCurrentLocationBtn.disabled = false;
                    getCurrentLocationBtn.innerHTML = '<i class="fas fa-crosshairs me-1"></i> Usar Mi Ubicación Actual';
                }, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutos
                });
            } else {
                showNotification('Tu navegador no soporta la geolocalización.', 'error');
            }
        });
    }

    showMapAndInit();
});

const confirmOrderButton = document.getElementById('confirmOrderBtn');
console.log('confirmOrderButton element:', confirmOrderButton); // Debug log
if (confirmOrderButton) {
    confirmOrderButton.addEventListener('click', confirmOrder);
    // Deshabilitar inicialmente el botón de confirmar pedido
    confirmOrderButton.disabled = true;
}

// Event listener para el botón de confirmar ubicación
const confirmLocationButton = document.getElementById('confirmLocationBtn');
console.log('confirmLocationButton element:', confirmLocationButton); // Debug log
if (confirmLocationButton) {
    confirmLocationButton.addEventListener('click', confirmLocation);
}
