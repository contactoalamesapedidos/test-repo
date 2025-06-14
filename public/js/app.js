// A la Mesa - Main JavaScript

// Global variables
const alamesa = {
  socket: null,
  cart: {
    items: [],
    total: 0,
    count: 0
  }
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
  loadCartData();
  initializeSocket();
});

// Initialize main app functionality
function initializeApp() {
  // Initialize tooltips
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize popovers
  var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });

  // Initialize geolocation
  initializeGeolocation();

  // Add loading states to forms
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function() {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
      }
    });
  });

  // Add smooth scrolling to anchor links
  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  anchorLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      if (href && href !== '#') {
        const target = document.querySelector(href);
        if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Handle navbar collapse on mobile
  const navbarToggler = document.querySelector('.navbar-toggler');
  const navbarCollapse = document.querySelector('.navbar-collapse');
  
  if (navbarToggler && navbarCollapse) {
    document.addEventListener('click', function(e) {
      if (!navbarToggler.contains(e.target) && !navbarCollapse.contains(e.target)) {
        if (navbarCollapse.classList.contains('show')) {
          navbarToggler.click();
        }
      }
    });
  }

  // Handle cart button click
  const cartButton = document.querySelector('.cart-button');
  if (cartButton) {
    cartButton.addEventListener('click', function(event) {
      console.log('Cart button clicked in app.js');
      toggleCartSidebar(event);
    });
  }
}

// Socket.IO initialization
function initializeSocket() {
  if (typeof io !== 'undefined') {
    alamesa.socket = io();
    
    alamesa.socket.on('connect', function() {
      console.log('Conectado al servidor');
      
      // Join user room if logged in
      const user = getUserData();
      if (user) {
        alamesa.socket.emit('join-user', user.id);
        
        if (user.tipo_usuario === 'restaurante') {
          alamesa.socket.emit('join-restaurant', user.restaurante_id);
        }
      }
    });

    alamesa.socket.on('new-order-notification', function(data) {
      showNotification('Nuevo pedido recibido', 'info');
      playNotificationSound();
    });

    alamesa.socket.on('order-status-changed', function(data) {
      showNotification(`Tu pedido está ${getStatusText(data.status)}`, 'success');
      updateOrderStatus(data.orderId, data.status);
    });

    alamesa.socket.on('disconnect', function() {
      console.log('Desconectado del servidor');
    });
  }
}

// Cart management
function loadCartData() {
  fetch('/cart/data')
    .then(response => response.json())
    .then(data => {
      alamesa.cart = data;
      updateCartUI();
    })
    .catch(error => {
      console.error('Error loading cart:', error);
    });
}

function addToCart(productId, quantity = 1, specialInstructions = '') {
  const data = {
    productId: productId,
    quantity: quantity,
    specialInstructions: specialInstructions
  };

  fetch('/cart/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification(data.message, 'success');
      loadCartData();
    } else {
      if (data.needsClearCart) {
        showClearCartConfirmation(data.newRestaurant, productId, quantity, specialInstructions);
      } else {
        showNotification(data.message, 'error');
      }
    }
  })
  .catch(error => {
    console.error('Error adding to cart:', error);
    showNotification('Error agregando al carrito', 'error');
  });
}

function updateCartItem(productId, quantity) {
  const data = {
    productId: productId,
    quantity: quantity
  };

  fetch('/cart/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      loadCartData();
    } else {
      showNotification(data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error updating cart:', error);
    showNotification('Error actualizando el carrito', 'error');
  });
}

function removeFromCart(productId) {
  const data = {
    productId: productId
  };

  fetch('/cart/remove', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification(data.message, 'success');
      loadCartData();
    } else {
      showNotification(data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error removing from cart:', error);
    showNotification('Error eliminando del carrito', 'error');
  });
}

function clearCart() {
  fetch('/cart/clear', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification(data.message, 'success');
      loadCartData();
    } else {
      showNotification('Error limpiando el carrito', 'error');
    }
  })
  .catch(error => {
    console.error('Error clearing cart:', error);
    showNotification('Error limpiando el carrito', 'error');
  });
}

function updateCartUI() {
  // Update cart badge
  const cartBadges = document.querySelectorAll('.cart-badge');
  cartBadges.forEach(badge => {
    if (alamesa.cart.count > 0) {
      badge.textContent = alamesa.cart.count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  });

  // Update cart dropdown if exists
  const cartDropdown = document.getElementById('cart-dropdown');
  if (cartDropdown) {
    updateCartDropdown();
  }
}

function updateCartDropdown() {
  const cartDropdown = document.getElementById('cart-dropdown');
  if (!cartDropdown) return;

  if (alamesa.cart.items.length === 0) {
    cartDropdown.innerHTML = `
      <div class="p-3 text-center text-muted">
        <i class="fas fa-shopping-cart fs-1 mb-2"></i>
        <p>Tu carrito está vacío</p>
      </div>
    `;
  } else {
    let html = '';
    alamesa.cart.items.forEach(item => {
      html += `
        <div class="cart-item d-flex align-items-center p-2">
          <img src="${item.imagen || '/images/no-image.png'}" 
               alt="${item.name}" class="rounded me-2" width="40" height="40">
          <div class="flex-grow-1">
            <h6 class="mb-0 small">${item.name}</h6>
            <small class="text-muted">$${item.price} x ${item.quantity}</small>
          </div>
          <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${item.productId})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
    });
    
    html += `
      <div class="p-2 border-top">
        <div class="d-flex justify-content-between mb-2">
          <strong>Total: $${alamesa.cart.total.toFixed(2)}</strong>
        </div>
        <a href="/cart" class="btn btn-primary w-100">Ver Carrito</a>
      </div>
    `;
    
    cartDropdown.innerHTML = html;
  }
}

// Notifications
function showNotification(message, type = 'info') {
  const toast = document.getElementById('liveToast');
  if (!toast) return;

  const toastBody = toast.querySelector('.toast-body');
  const toastHeader = toast.querySelector('.toast-header');
  
  // Update content
  toastBody.textContent = message;
  
  // Update style based on type
  toast.className = 'toast';
  toastHeader.className = 'toast-header';
  
  switch (type) {
    case 'success':
      toast.classList.add('text-bg-success');
      break;
    case 'error':
      toast.classList.add('text-bg-danger');
      break;
    case 'warning':
      toast.classList.add('text-bg-warning');
      break;
    default:
      toast.classList.add('text-bg-info');
  }

  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
}

function showClearCartConfirmation(newRestaurant, productId, quantity, specialInstructions) {
  const confirmed = confirm(
    `Tu carrito contiene productos de otro restaurante. ¿Quieres limpiarlo y agregar productos de ${newRestaurant}?`
  );
  
  if (confirmed) {
    clearCart();
    setTimeout(() => {
      addToCart(productId, quantity, specialInstructions);
    }, 500);
  }
}

// Utility functions
function formatPrice(price) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(price);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getUserData() {
  const userScript = document.querySelector('script[data-user]');
  if (userScript) {
    try {
      return JSON.parse(userScript.dataset.user);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function getStatusText(status) {
  const statusTexts = {
    'pending': 'pendiente',
    'confirmed': 'confirmado',
    'preparing': 'en preparación',
    'ready': 'listo para entregar',
    'en_camino': 'en camino',
    'delivered': 'entregado',
    'cancelled': 'cancelado'
  };
  return statusTexts[status] || status;
}

function updateOrderStatus(orderId, status) {
  const orderElement = document.querySelector(`[data-order-id="${orderId}"]`);
  if (orderElement) {
    const statusBadge = orderElement.querySelector('.order-status');
    if (statusBadge) {
      statusBadge.textContent = getStatusText(status);
      statusBadge.className = `badge status-${status}`;
    }
  }
}

function playNotificationSound() {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => {
      // Ignore audio errors
    });
  } catch (e) {
    // Ignore audio errors
  }
}

// Loading states
function showLoading(element) {
  if (element) {
    element.classList.add('loading');
  }
}

function hideLoading(element) {
  if (element) {
    element.classList.remove('loading');
  }
}

// Form validation
function validateForm(form) {
  const inputs = form.querySelectorAll('[required]');
  let isValid = true;
  
  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.classList.add('is-invalid');
      isValid = false;
    } else {
      input.classList.remove('is-invalid');
    }
  });
  
  return isValid;
}

// Search functionality
function performSearch(query, category = '') {
  const url = new URL('/search', window.location.origin);
  if (query) url.searchParams.set('q', query);
  if (category) url.searchParams.set('category', category);
  
  window.location.href = url.toString();
}

// Image lazy loading
function initLazyLoading() {
  const images = document.querySelectorAll('img[data-src]');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  } else {
    // Fallback for older browsers
    images.forEach(img => {
      img.src = img.dataset.src;
    });
  }
}

// Initialize lazy loading when DOM is ready
document.addEventListener('DOMContentLoaded', initLazyLoading);

// Geolocation functionality
function initializeGeolocation() {
  const locationBtn = document.getElementById('getLocationBtn');
  const locationInput = document.getElementById('userLocation');
  const locationDisplay = document.getElementById('currentLocation');
  
  if (locationBtn) {
    locationBtn.addEventListener('click', getCurrentLocation);
  }
  
  // Try to get location automatically on page load
  if (locationInput && !locationInput.value.trim()) {
    getCurrentLocationSilent();
  }
  
  // Load saved location from localStorage
  loadSavedLocation();
}

function getCurrentLocation() {
  const locationBtn = document.getElementById('getLocationBtn');
  const locationInput = document.getElementById('userLocation');
  
  if (!navigator.geolocation) {
    showNotification('Tu navegador no soporta geolocalización', 'error');
    return;
  }
  
  // Show loading state
  if (locationBtn) {
    locationBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Obteniendo ubicación...';
    locationBtn.disabled = true;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      
      // Get address from coordinates
      reverseGeocode(latitude, longitude)
        .then(address => {
          if (locationInput) {
            locationInput.value = address;
          }
          updateLocationDisplay(address);
          saveLocation(address, latitude, longitude);
          showNotification('Ubicación obtenida correctamente', 'success');
        })
        .catch(error => {
          console.error('Error getting address:', error);
          if (locationInput) {
            locationInput.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          }
          saveLocation(locationInput.value, latitude, longitude);
          showNotification('Ubicación obtenida (sin dirección)', 'warning');
        })
        .finally(() => {
          if (locationBtn) {
            locationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Usar mi ubicación';
            locationBtn.disabled = false;
          }
        });
    },
    (error) => {
      console.error('Geolocation error:', error);
      
      let errorMessage = 'Error obteniendo ubicación';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permiso de ubicación denegado. Por favor, actívalo en tu navegador.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Ubicación no disponible';
          break;
        case error.TIMEOUT:
          errorMessage = 'Tiempo de espera agotado obteniendo ubicación';
          break;
      }
      
      showNotification(errorMessage, 'error');
      
      if (locationBtn) {
        locationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Usar mi ubicación';
        locationBtn.disabled = false;
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    }
  );
}

function getCurrentLocationSilent() {
  if (!navigator.geolocation) return;
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      
      reverseGeocode(latitude, longitude)
        .then(address => {
          const locationInput = document.getElementById('userLocation');
          if (locationInput && !locationInput.value.trim()) {
            locationInput.value = address;
            updateLocationDisplay(address);
            saveLocation(address, latitude, longitude);
          }
        })
        .catch(error => {
          console.log('Silent geolocation failed:', error);
        });
    },
    (error) => {
      console.log('Silent geolocation error:', error);
    },
    {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 600000 // 10 minutes
    }
  );
}

function reverseGeocode(latitude, longitude) {
  return new Promise((resolve, reject) => {
    // Using OpenStreetMap Nominatim API (free)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    
    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data && data.display_name) {
          // Format the address nicely
          let address = '';
          const addr = data.address;
          
          if (addr) {
            const street = addr.road || addr.pedestrian || addr.footway || '';
            const houseNumber = addr.house_number || '';
            const neighbourhood = addr.neighbourhood || addr.suburb || '';
            const city = addr.city || addr.town || addr.village || '';
            
            if (street) {
              address = `${street}${houseNumber ? ' ' + houseNumber : ''}`;
              if (neighbourhood && neighbourhood !== city) {
                address += `, ${neighbourhood}`;
              }
              if (city) {
                address += `, ${city}`;
              }
            } else {
              address = data.display_name;
            }
          } else {
            address = data.display_name;
          }
          
          resolve(address);
        } else {
          reject('No address found');
        }
      })
      .catch(reject);
  });
}

function updateLocationDisplay(address) {
  const locationDisplay = document.getElementById('currentLocation');
  if (locationDisplay) {
    locationDisplay.innerHTML = `
      <i class="fas fa-map-marker-alt text-primary me-2"></i>
      <span>${address}</span>
    `;
    locationDisplay.style.display = 'block';
  }
}

function saveLocation(address, latitude = null, longitude = null) {
  const locationData = {
    address: address,
    latitude: latitude,
    longitude: longitude,
    timestamp: Date.now()
  };
  
  localStorage.setItem('alamesa_location', JSON.stringify(locationData));
}

function loadSavedLocation() {
  const saved = localStorage.getItem('alamesa_location');
  if (!saved) return;
  
  try {
    const locationData = JSON.parse(saved);
    const locationInput = document.getElementById('userLocation');
    
    // Check if location is not too old (24 hours)
    const isOld = Date.now() - locationData.timestamp > 24 * 60 * 60 * 1000;
    
    if (locationInput && !locationInput.value.trim() && !isOld) {
      locationInput.value = locationData.address;
      updateLocationDisplay(locationData.address);
    }
  } catch (error) {
    console.error('Error loading saved location:', error);
  }
}

function clearSavedLocation() {
  localStorage.removeItem('alamesa_location');
  const locationInput = document.getElementById('userLocation');
  const locationDisplay = document.getElementById('currentLocation');
  
  if (locationInput) {
    locationInput.value = '';
  }
  
  if (locationDisplay) {
    locationDisplay.style.display = 'none';
  }
}

// Address autocomplete functionality
function initializeAddressAutocomplete() {
  const addressInputs = document.querySelectorAll('.address-autocomplete');
  
  addressInputs.forEach(input => {
    let timeout;
    
    input.addEventListener('input', function() {
      clearTimeout(timeout);
      
      timeout = setTimeout(() => {
        const query = this.value.trim();
        if (query.length > 3) {
          searchAddresses(query, this);
        }
      }, 300);
    });
  });
}

function searchAddresses(query, inputElement) {
  // Using OpenStreetMap Nominatim for address search
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=ar&q=${encodeURIComponent(query)}`;
  
  fetch(url)
    .then(response => response.json())
    .then(data => {
      showAddressSuggestions(data, inputElement);
    })
    .catch(error => {
      console.error('Error searching addresses:', error);
    });
}

function showAddressSuggestions(addresses, inputElement) {
  // Remove existing suggestions
  const existingSuggestions = document.querySelector('.address-suggestions');
  if (existingSuggestions) {
    existingSuggestions.remove();
  }
  
  if (!addresses || addresses.length === 0) return;
  
  const suggestions = document.createElement('div');
  suggestions.className = 'address-suggestions list-group position-absolute w-100';
  suggestions.style.zIndex = '1000';
  suggestions.style.maxHeight = '200px';
  suggestions.style.overflowY = 'auto';
  
  addresses.forEach(address => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'list-group-item list-group-item-action';
    item.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="fas fa-map-marker-alt text-muted me-2"></i>
        <span>${address.display_name}</span>
      </div>
    `;
    
    item.addEventListener('click', () => {
      inputElement.value = address.display_name;
      suggestions.remove();
      
      // Save coordinates if available
      if (address.lat && address.lon) {
        saveLocation(address.display_name, parseFloat(address.lat), parseFloat(address.lon));
      }
    });
    
    suggestions.appendChild(item);
  });
  
  // Position suggestions
  const inputRect = inputElement.getBoundingClientRect();
  const parent = inputElement.parentElement;
  parent.style.position = 'relative';
  parent.appendChild(suggestions);
  
  // Close suggestions when clicking outside
  document.addEventListener('click', function closeSuggestions(e) {
    if (!suggestions.contains(e.target) && e.target !== inputElement) {
      suggestions.remove();
      document.removeEventListener('click', closeSuggestions);
    }
  });
}

// Initialize address autocomplete on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  initializeAddressAutocomplete();
});

// Función para manejar imágenes por defecto
function handleDefaultImage(imgElement, type = 'restaurant') {
    const defaultImages = {
        restaurant: '/images/no-image.png',
        product: '/images/no-image.png',
        category: '/images/no-image.png',
        user: '/images/no-image.png'
    };

    // Si la imagen no existe o falla, usar el placeholder
    imgElement.onerror = function() {
        console.log(`Error cargando imagen: ${this.src}`);
        this.onerror = null; // Prevenir loop infinito
        this.src = defaultImages[type];
    };

    // Solo validar si la imagen es null o undefined
    if (!imgElement.src || 
        imgElement.src.endsWith('null') || 
        imgElement.src.endsWith('undefined')) {
        console.log(`Imagen inválida: ${imgElement.src}`);
        imgElement.src = defaultImages[type];
    }
}

// Inicializar manejo de imágenes por defecto
document.addEventListener('DOMContentLoaded', function() {
    // Manejar imágenes de restaurantes
    document.querySelectorAll('.restaurant-image, .restaurant-logo, .restaurant-banner').forEach(img => {
        handleDefaultImage(img, 'restaurant');
    });

    // Manejar imágenes de productos
    document.querySelectorAll('.product-image').forEach(img => {
        handleDefaultImage(img, 'product');
    });

    // Manejar imágenes de categorías
    document.querySelectorAll('.category-image').forEach(img => {
        handleDefaultImage(img, 'category');
    });

    // Manejar imágenes de usuarios
    document.querySelectorAll('.user-image, .profile-image').forEach(img => {
        handleDefaultImage(img, 'user');
    });
});

// Export global functions
window.alamesa = alamesa;
window.addToCart = addToCart;
window.updateCartItem = updateCartItem;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.showNotification = showNotification;
window.formatPrice = formatPrice;
window.formatDate = formatDate;
window.performSearch = performSearch;
window.getCurrentLocation = getCurrentLocation;
window.clearSavedLocation = clearSavedLocation;
