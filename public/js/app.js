// Confirma antes de cancelar/rechazar pedido desde cualquier parte del dashboard
window.confirmCancelOrder = function(orderId, fromTable) {
  if (confirm('¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer.')) {
    if (fromTable) {
      window.updateOrderStatusFromTable(orderId, 'cancelado');
    } else {
      window.updateOrderStatus(orderId, 'cancelado');
    }
  }
};

// Aplica background-image usando el atributo data-bg
function applyDataBgBackgrounds() {
  try {
    const elements = document.querySelectorAll('[data-bg]');
    elements.forEach(el => {
      const bg = el.getAttribute('data-bg');
      if (bg) {
        // Si no es una url absoluta ni ya incluye url("...")
        const isAbsolute = bg.startsWith('http://') || bg.startsWith('https://');
        const url = isAbsolute || bg.startsWith('/') ? bg : ('/uploads/' + bg);
        el.style.backgroundImage = `url("${url}")`;
        el.style.backgroundSize = el.style.backgroundSize || 'cover';
        el.style.backgroundPosition = el.style.backgroundPosition || 'center';
      }
    });
  } catch (e) {
    console.error('Error aplicando data-bg:', e);
  }
}

// A la Mesa - Main JavaScript (Optimizado)

// Global variables
window.cart = {
  items: [],
  count: 0,
  subtotal: 0,
  deliveryFee: 0,
  total: 0
};

// Initialize app
window.currentUser = null; // Global variable for user data

document.addEventListener('DOMContentLoaded', async function() {
  window.currentUser = getUserData(); // Get user data early
  await loadCartData();
  await initializeApp();
  initializeSocket();
  initializeAllCartEventListeners();
  initializeQuantityControls();
  // Forzar actualización del contador del carrito tras 500ms
  setTimeout(() => {
    updateCartUI();
  }, 500);
});

// Inicializar controles de cantidad
function initializeQuantityControls() {
  // Asegurarse de que las funciones existan antes de usarlas
  window.increaseQuantity = increaseQuantity;
  window.decreaseQuantity = decreaseQuantity;
  window.updateCartData = updateCartData;
  window.showToast = showToast;

  // Agregar eventos a los botones usando event delegation
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('minus-btn')) {
      e.preventDefault();
      const productId = e.target.closest('.cart-item')?.dataset.productoId || e.target.getAttribute('data-product-id');
      if (productId) decreaseQuantity(productId);
    }
    
    if (e.target.classList.contains('plus-btn')) {
      e.preventDefault();
      const productId = e.target.closest('.cart-item')?.dataset.productoId || e.target.getAttribute('data-product-id');
      if (productId) increaseQuantity(productId);
    }
  });
}

// Initialize main app functionality
async function initializeApp() {
  // Renderizar el sidebar del carrito después de cargar los datos
  await renderCartSidebarWithEjs();

  // Asegurarse de que el sidebar no se muestre al cargar la página
  const cartSidebar = document.getElementById('cartSidebar');
  const cartOverlay = document.getElementById('cartOverlay');
  
  if (cartSidebar) cartSidebar.classList.remove('show');
  if (cartOverlay) cartOverlay.classList.remove('show');
  document.body.style.overflow = '';
  document.body.classList.remove('cart-open');

  // Asegurarse de que el sidebar de usuario no se muestre al cargar la página
  const userMenuSidebar = document.getElementById('userMenuSidebar');
  const userMenuOverlay = document.getElementById('userMenuOverlay');
  if (userMenuSidebar) userMenuSidebar.classList.remove('show');
  if (userMenuOverlay) userMenuOverlay.classList.remove('show');

  // Añadir un retraso para asegurarse de que cualquier script que intente mostrar el sidebar sea anulado
  setTimeout(() => {
    if (cartSidebar) cartSidebar.classList.remove('show');
    if (cartOverlay) cartOverlay.classList.remove('show');
    document.body.style.overflow = '';
    document.body.classList.remove('cart-open');
    if (userMenuSidebar) userMenuSidebar.classList.remove('show');
    if (userMenuOverlay) userMenuOverlay.classList.remove('show');
  }, 500);

  // Initialize tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl);
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
      }
    });
  });

  // Aplicar backgrounds desde data-bg (banner, etc.)
  applyDataBgBackgrounds();

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
}

// Socket.IO initialization
function initializeSocket() {
  if (typeof io !== 'undefined') {
    window.socket = io();
    
    window.socket.on('connect', function() {
      console.log('Conectado al servidor');
      
      // Join user room if logged in
      if (window.currentUser) {
        window.socket.emit('join-user', window.currentUser.id);
        
        if (window.currentUser.tipo_usuario === 'restaurante') {
          window.socket.emit('join-restaurant', window.currentUser.restaurante_id);
        }
      }
    });

    window.socket.on('new-order-notification', function(data) {
      showNotification('Nuevo pedido recibido', 'info');
      playNotificationSound();
    });

    window.socket.on('order-status-changed', function(data) {
      showNotification(`Tu pedido está ${getStatusText(data.status)}`, 'success');
      updateOrderStatus(data.orderId, data.status);
    });

    window.socket.on('disconnect', function() {
      console.log('Desconectado del servidor');
    });
  }
}

// Cart management
function loadCartData() {
  return new Promise((resolve, reject) => {
    fetch('/cart/data')
      .then(response => response.json())
      .then(data => {
        // Mapear correctamente los datos recibidos
        window.cart.items = data.cart || [];
        window.cart.count = data.cartCount || 0;
        window.cart.cartCount = data.cartCount || 0;
        window.cart.subtotal = parseFloat(data.subtotal) || 0;
        window.cart.deliveryFee = parseFloat(data.deliveryFee) || 0;
        window.cart.total = parseFloat(data.total) || 0;
        
        // Actualizar UI inmediatamente
        updateCartUI();
        
        // Luego actualizar el DOM de manera más detallada
        setTimeout(() => {
          updateCartDOM();
        }, 100);
        
        resolve();
      })
      .catch(error => {
        console.error('Error loading cart:', error);
        reject(error);
      });
  });
}

// --- CLIENT-SIDE EJS RENDERING FOR CART SIDEBAR ---

// Cargar EJS por CDN si no está presente
defineEjsIfNeeded();

function defineEjsIfNeeded() {
  if (!window.ejs) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/ejs@3.1.9/ejs.min.js';
    script.onload = () => { console.log('EJS cargado en el cliente'); };
    document.head.appendChild(script);
  }
}

// Espera a que EJS esté disponible en window.ejs
async function waitForEjs() {
  let tries = 0;
  while (!window.ejs && tries < 20) {
    await new Promise(res => setTimeout(res, 100));
    tries++;
  }
  if (!window.ejs) throw new Error('EJS no está disponible en el cliente');
}

window.updateCartDOM = renderCartSidebarWithEjs;

// Reinicializar eventos del carrito después de actualizar el DOM
function reinitializeCartEvents() {
  console.log('🔄 Reinicializando eventos del carrito...');
  
  // Botones de cerrar carrito (múltiples selectores para mayor compatibilidad)
  const closeButtons = document.querySelectorAll('.cart-close-btn, .btn-close, #cartSidebarClose');
  closeButtons.forEach(btn => {
    // Remover listeners previos para evitar duplicados
    btn.removeEventListener('click', closeCartSidebar);
    btn.addEventListener('click', closeCartSidebar);
  });

  // Botones de cantidad
  const qtyButtons = document.querySelectorAll('.cart-qty-btn');
  qtyButtons.forEach(btn => {
    // Verificar si ya tiene el listener para evitar duplicados
    if (!btn.dataset.hasQuantityListener) {
      btn.dataset.hasQuantityListener = 'true';
      btn.addEventListener('click', handleQuantityClick);
    }
  });
  
  // Función para manejar clics en botones de cantidad
  function handleQuantityClick() {
    const action = this.getAttribute('data-action');
    const productId = this.getAttribute('data-producto-id');
    if (action && productId) {
      updateCartItemQuantity(productId, action === 'increment' ? 1 : -1, this);
    }
  }

  // Botones de eliminar producto
  const removeButtons = document.querySelectorAll('.remove-item-btn');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const productId = this.getAttribute('data-producto-id');
      if (productId) {
        removeFromCart(productId);
      }
    });
  });

  // Botón de vaciar carrito
  const clearCartButtons = document.querySelectorAll('.clear-cart-btn');
  clearCartButtons.forEach(btn => {
    btn.addEventListener('click', clearCart);
  });
  
  // Reinicializar el overlay del carrito
  const overlay = document.getElementById('cartOverlay');
  if (overlay) {
    overlay.removeEventListener('click', function(e) {
      if (e.target === overlay) {
        closeCartSidebar();
      }
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        closeCartSidebar();
      }
    });
  }
}

// Renderizar el sidebar del carrito usando HTML directo
async function renderCartSidebarWithEjs() {
  try {
    let cartSidebar = document.getElementById('cartSidebar');
    if (!cartSidebar) {
      console.error('No se encontró el sidebar del carrito en el DOM');
      return;
    }

    // Obtener datos del carrito
    const dataRes = await fetch('/cart/data');
    if (!dataRes.ok) throw new Error('No se pudo obtener los datos del carrito');
    const cartData = await dataRes.json();
    const cart = cartData.cart || [];
    const subtotal = cartData.subtotal || 0;
    const deliveryFee = cartData.deliveryFee || 0;
    const total = cartData.total || 0;
    const cartCount = cartData.cartCount || 0;

    let cartItemsHtml = '';
    if (cart.length === 0) {
      cartItemsHtml = `
        <div class="text-center py-5">
          <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
          <h5>Tu carrito está vacío</h5>
          <p class="text-muted">Agrega productos de tus restaurantes favoritos</p>
          <a href="/restaurants" class="btn btn-orange mt-3">
            <i class="fas fa-utensils me-2"></i>
            Ver Restaurantes
          </a>
        </div>
      `;
    } else {
      cartItemsHtml = `
        <div class="cart-items">
          ${cart.map(item => {
            const nombre = item.nombre || item.name || 'Producto';
            const imagen = item.imagen || item.image || '/images/defaults/product.jpeg';
            const precio = typeof item.precio !== 'undefined' ? item.precio : (typeof item.price !== 'undefined' ? item.price : 0);
            const cantidad = item.cantidad || item.quantity || 0;
            return `
              <div class="cart-item-row">
                <div class="cart-item-img-container d-flex align-items-center justify-content-center" style="width:48px; height:48px; min-width:48px; min-height:48px; max-width:48px; max-height:48px;">
                  <img src="${imagen.startsWith('/uploads/') ? imagen : imagen.startsWith('/') ? imagen : '/uploads/' + imagen}"
                       alt="${nombre}" class="cart-item-image" style="width:44px; height:44px; object-fit:cover; border-radius:8px; display:block;"
                       onerror="this.onerror=null;this.src='/images/defaults/product.jpeg';">
                </div>
                <div class="cart-item-main">
                  <div class="cart-item-title-row d-flex align-items-center">
                    <div class="cart-item-name">${nombre}</div>
                  </div>
                  <div class="cart-item-controls-row d-flex justify-content-between align-items-center mt-2">
                    <div class="quantity-controls d-flex align-items-center">
                      <button class="cart-qty-btn" data-action="decrement" data-producto-id="${item.producto_id}">
                        <i class="fas fa-minus"></i>
                      </button>
                      <span class="btn-quantity-text">${cantidad}</span>
                      <button class="cart-qty-btn" data-action="increment" data-producto-id="${item.producto_id}">
                        <i class="fas fa-plus"></i>
                      </button>
                      <button class="remove-item-btn" data-producto-id="${item.producto_id}">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                    <div class="d-flex flex-column align-items-end">
                      <div class="cart-item-price">$${(precio * cantidad).toFixed(2)}</div>
                      <div class="cart-item-unit small text-muted">$${precio.toFixed(2)} c/u</div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const cartHtml = `
      <div class="cart-sidebar-header">
        <h3>
          <i class="fas fa-shopping-cart me-2"></i>
          Tu Carrito (${cartCount})
        </h3>
        <button type="button" class="btn-close cart-close-btn" onclick="closeCartSidebar()"></button>
      </div>
      <div class="cart-sidebar-body">
        ${cartItemsHtml}
        ${cart.length > 0 ? `
          <div class="cart-summary">
            <div class="cart-summary-item">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div class="cart-summary-item">
              <span>Envío:</span>
              <span>${deliveryFee.toFixed(2)}</span>
            </div>
            <div class="cart-summary-item total">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
          <div class="cart-actions">
            <button id="checkoutButton" class="btn btn-pagar w-100" onclick="window.location.href='/orders/checkout'">
              <i class="fas fa-credit-card me-2"></i>
              Proceder al Pago
            </button>
            <button id="clearCartButton" class="btn btn-vaciar w-100" onclick="clearCart()">
              <i class="fas fa-trash me-2"></i>
              Vaciar Carrito
            </button>
            ${cart.length > 0 && cart[0].restaurante_id ? `
              <a href="/restaurants/${cart[0].restaurante_id}" class="btn btn-outline-secondary w-100 mt-2">
                <i class="fas fa-store me-2"></i>Ver más productos de este restaurante
              </a>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;

    cartSidebar.innerHTML = cartHtml;
    updateCartUI();
    reinitializeCartEvents();
  } catch (error) {
    console.error('Error renderizando el carrito:', error);
    let cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) {
      cartSidebar.innerHTML = `
        <div class="cart-sidebar-header">
          <h5 class="mb-0">
            <i class="fas fa-shopping-cart me-2"></i>
            Tu Carrito
            <button type="button" class="btn-close float-end cart-close-btn" onclick="closeCartSidebar()"></button>
          </h5>
        </div>
        <div class="cart-sidebar-body">
          <div class="text-center py-5">
            <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
            <h5>Error cargando el carrito</h5>
            <p class="text-muted">Hubo un problema al cargar los datos del carrito</p>
            <button class="btn btn-orange mt-3" onclick="location.reload()">
              <i class="fas fa-refresh me-2"></i>
              Recargar Página
            </button>
          </div>
        </div>
      `;
      reinitializeCartEvents();
    }
    showToast('Error actualizando el carrito', 'error');
  }
}

// Add to cart without page reload
function addToCart(productId, quantity = 1, specialInstructions = '') {
  // Preparar datos para el carrito sin obtener datos previos del producto
  const data = {
    productId: productId,
    quantity: quantity,
    specialInstructions: specialInstructions
  };

  // Variable para controlar si ya se mostró un toast para esta acción
  const currentTime = Date.now();
  if (!window.lastToastTime || currentTime - window.lastToastTime > 1000) {
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
        showToast(data.message, 'success');
        window.lastToastTime = currentTime;
        // Actualizar los datos del carrito y renderizar el sidebar
        loadCartData().then(() => {
          console.log('Datos del carrito actualizados:', window.cart);
          renderCartSidebarWithEjs().then(() => {
            // NO mostrar automáticamente el carrito al agregar productos
            // Solo actualizar los datos para que estén disponibles cuando el usuario abra el carrito
            console.log('Carrito actualizado, pero no se muestra automáticamente');
          });
        });
      } else {
        if (data.needsClearCart) {
          showClearCartConfirmation(data.newRestaurant, productId, quantity, specialInstructions);
        } else {
          showToast(data.message, 'error');
          window.lastToastTime = currentTime;
        }
      }
    })
    .catch(error => {
      console.error('Error adding to cart:', error);
      showToast('Error agregando al carrito', 'error');
    });
  } else {
    console.log('Toast ya mostrado recientemente, ignorando addToCart para producto:', productId);
  }
}

// Remove from cart with page reload
function removeFromCart(productId) {
  fetch('/cart/remove', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId: productId })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showToast('Producto eliminado del carrito', 'success');
      // Actualizar el carrito en tiempo real sin recargar la página
      renderCartSidebarWithEjs();
    } else {
      showToast('Error eliminando el producto', 'error');
    }
  })
  .catch(error => {
    console.error('Error removing from cart:', error);
    showToast('Error eliminando el producto', 'error');
  });
}

// Clear cart with updated UI
function clearCart() {
  fetch('/cart/clear', {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showToast('Carrito vaciado', 'success');
      window.cart.items = [];
      window.cart.count = 0;
      window.cart.subtotal = 0;
      window.cart.deliveryFee = 0;
      window.cart.total = 0;
      updateCartUI();
      updateCartDOM();
    } else {
      showToast('Error vaciando el carrito', 'error');
    }
  })
  .catch(error => {
    console.error('Error clearing cart:', error);
    showToast('Error vaciando el carrito', 'error');
  });
}

function updateCartUI() {
  // Usar el valor de cartCount del backend si está disponible
  const cartCount = window.cart.cartCount !== undefined ? window.cart.cartCount : window.cart.count;
  const cartCountElements = document.querySelectorAll('[data-cart-count]');
  console.log('Cart count elements encontrados:', cartCountElements.length);
  cartCountElements.forEach(element => {
    element.textContent = cartCount;
    console.log('Actualizando badge:', element, 'con valor:', cartCount);
    if (cartCount > 0) {
      element.classList.remove('d-none');
      element.style.display = 'flex';
    } else {
      element.classList.add('d-none');
      element.style.display = 'none';
    }
  });

  // Update cart totals
  const subtotalElements = document.querySelectorAll('[data-cart-subtotal]');
  subtotalElements.forEach(element => {
    element.textContent = formatPrice(window.cart.subtotal);
  });

  // Update delivery fee
  const deliveryFeeElements = document.querySelectorAll('[data-cart-delivery-fee]');
  deliveryFeeElements.forEach(element => {
    element.textContent = formatPrice(window.cart.deliveryFee);
  });

  const totalElements = document.querySelectorAll('[data-cart-total]');
  totalElements.forEach(element => {
    element.textContent = formatPrice(window.cart.total);
  });

  // Update cart dropdown
  updateCartDropdown();
}

function updateCartDropdown() {
  const cartDropdown = document.getElementById('cart-dropdown');
  if (!cartDropdown) return;

  if (!window.cart.items || window.cart.items.length === 0) {
    cartDropdown.innerHTML = `
      <div class="p-3 text-center text-muted">
        <i class="fas fa-shopping-cart fs-1 mb-2"></i>
        <p>Tu carrito está vacío</p>
      </div>
    `;
  } else {
    let html = '';
    window.cart.items.forEach(item => {
      const itemPrice = item.price || item.precio || 0;
      const itemQuantity = item.quantity || item.cantidad || 0;
      html += `
        <div class="cart-item d-flex align-items-center p-2">
          <img src="${item.imagen.startsWith('/uploads/') ? item.imagen : '/uploads/' + (item.imagen || 'no-image.png')}" 
               alt="${item.name}" class="rounded me-2" width="40" height="40">
          <div class="flex-grow-1">
            <h6 class="mb-0 small">${item.name}</h6>
            <small class="text-muted">$${itemPrice.toFixed(2)} x ${itemQuantity}</small>
          </div>
          <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${item.producto_id})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
    });
    
    html += `
      <div class="p-2 border-top">
        <div class="d-flex justify-content-between mb-2">
          <div>
            <strong>Subtotal:</strong>
            <br>
            <span class="text-muted">$${(window.cart.subtotal || 0).toFixed(2)}</span>
          </div>
          <small class="text-muted ms-2">(ver total en carrito)</small>
        </div>
        <div class="d-grid gap-2">
          <a href="/cart" class="btn btn-primary">Ver Carrito</a>
          <button class="btn btn-danger btn-delete-cart" onclick="clearCart()">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    
    cartDropdown.innerHTML = html;
  }
}

// Notifications
function showToast(message, type = 'success', size = 'normal') {
  // Remove any existing toasts
  const existingToast = document.querySelector('.custom-toast-container');
  if (existingToast) {
    existingToast.remove();
  }

  const toastContainer = document.createElement('div');
  toastContainer.className = 'custom-toast-container';

  const toast = document.createElement('div');
  const isLarge = size === 'large';

  // Clases base para el toast
  let toastClasses = `toast align-items-center text-white bg-${type} border-0`;

  // Posicionamiento y tamaño según el parámetro size
  if (isLarge) {
    // Para ubicación confirmada: abajo a la derecha, más pequeño, no se auto-oculta
    toastClasses += ' bottom-0 end-0 m-3';
    toast.style.minWidth = '300px';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '9999';
  }

  toast.className = toastClasses;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  const toastBody = document.createElement('div');
  toastBody.className = 'd-flex';

  // Contenido del toast con icono apropiado
  const iconClass = type === 'success' ? 'fas fa-check-circle' :
                   type === 'error' ? 'fas fa-exclamation-triangle' :
                   type === 'warning' ? 'fas fa-exclamation-circle' :
                   'fas fa-info-circle';

  toastBody.innerHTML = `
      <div class="toast-icon me-2">
          <i class="${iconClass} fs-5"></i>
      </div>
      <div class="toast-body flex-grow-1">
          <strong>${message}</strong>
      </div>
      <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast"></button>
  `;

  toast.appendChild(toastBody);
  toastContainer.appendChild(toast);
  document.body.appendChild(toastContainer);

  // Los toasts grandes no se auto-ocultan
  const bsToast = new bootstrap.Toast(toast, {
    autohide: !isLarge,
    delay: isLarge ? 0 : 3000
  });
  bsToast.show();

  if (!isLarge) {
    setTimeout(() => {
      bsToast.hide();
    }, 3000);
  }

  const closeButton = toast.querySelector('.btn-close');
  closeButton.addEventListener('click', () => {
    bsToast.hide();
  });

  toast.addEventListener('hidden.bs.toast', () => {
    toastContainer.remove();
  });
}

// Función para mostrar notificaciones (alias de showToast para compatibilidad)
function showNotification(message, type = 'success') {
  showToast(message, type);
}

// Funciones para manejar cantidad
function increaseQuantity(productId) {
  console.log('Aumentando cantidad para producto:', productId);
  updateCartItemQuantity(productId, 1);
}

function decreaseQuantity(productId) {
  console.log('Disminuyendo cantidad para producto:', productId);
  updateCartItemQuantity(productId, -1);
}

// --- FUNCIONES DE SIDEBAR Y CANTIDAD DEL CARRITO UNIFICADAS ---

// Flag para evitar múltiples ejecuciones simultáneas
let isCartToggleInProgress = false;

// Alternar la visibilidad del sidebar del carrito
async function toggleCartSidebar(event) {
  if (event) {
    event.preventDefault();
  }
  
  // Evitar múltiples ejecuciones simultáneas
  if (isCartToggleInProgress) {
    console.log('Cart toggle already in progress, ignoring');
    return;
  }
  
  isCartToggleInProgress = true;
  
  const overlay = document.getElementById('cartOverlay');
  const sidebar = document.getElementById('cartSidebar');
  
  if (!overlay) {
    console.error('No se encontró el overlay del carrito');
    isCartToggleInProgress = false;
    return;
  }

  try {
    // Si el sidebar está abierto, cerrarlo
    if (sidebar && sidebar.classList.contains('show')) {
      console.log('Cerrando carrito');
      closeCartSidebar();
    } else {
      // Si el sidebar está cerrado, abrirlo
      console.log('Abriendo carrito');
      if (sidebar) {
        await renderCartSidebarWithEjs();
        sidebar.classList.add('show');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('cart-open');
      } else {
        // Si no existe el sidebar, renderizarlo y mostrarlo
        await renderCartSidebarWithEjs();
        const newSidebar = document.getElementById('cartSidebar');
        if (newSidebar) {
          newSidebar.classList.add('show');
          overlay.classList.add('show');
          document.body.style.overflow = 'hidden';
          document.body.classList.add('cart-open');
        }
      }
    }
  } catch (error) {
    console.error('Error in toggleCartSidebar:', error);
  } finally {
    // Resetear el flag después de un pequeño delay
    setTimeout(() => {
      isCartToggleInProgress = false;
    }, 100);
  }
}

// Cerrar el sidebar del carrito
function closeCartSidebar() {
  console.log('closeCartSidebar called');
  
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  
  if (sidebar) {
    sidebar.classList.remove('show');
  }
  
  if (overlay) {
    overlay.classList.remove('show');
  }
  
  document.body.style.overflow = '';
  document.body.classList.remove('cart-open');
}

// Cambiar la cantidad de un producto en el carrito (usado por los botones +/-)
async function updateCartItemQuantity(productId, change, btnElem) {
  try {
    if (btnElem) {
      btnElem.disabled = true;
      btnElem.classList.add('pulse-anim');
    }
    
    const response = await fetch('/cart/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, change })
    });
    
    const data = await response.json();
    
    if (btnElem) {
      btnElem.disabled = false;
      btnElem.classList.remove('pulse-anim');
      btnElem.closest('.cart-item, .row, .d-flex')?.classList.add('added-flash');
      setTimeout(() => {
        btnElem.closest('.cart-item, .row, .d-flex')?.classList.remove('added-flash');
      }, 700);
    }
    
    if (data.success) {
      console.log('✅ Respuesta exitosa del servidor:', data);
      showToast('Cantidad actualizada', 'success');
      // Actualizar el carrito en tiempo real sin recargar la página
      await renderCartSidebarWithEjs();
    } else {
      showToast(data.message || 'Error actualizando el carrito', 'error');
    }
  } catch (error) {
    if (btnElem) {
      btnElem.disabled = false;
      btnElem.classList.remove('pulse-anim');
    }
    console.error('Error en updateCartItemQuantity:', error);
    showToast('Error actualizando el carrito', 'error');
  }
}

// Función para actualizar la interfaz de un item específico del carrito
function updateCartItemUI(productId, newQuantity, newPrice) {
  console.log('🔄 Actualizando UI del item:', { productId, newQuantity, newPrice });
  
  // Buscar el elemento del carrito en la página actual
  const cartItems = document.querySelectorAll('.cart-item');
  let cartItem = null;
  
  for (const item of cartItems) {
    const button = item.querySelector(`[data-producto-id="${productId}"]`);
    if (button) {
      cartItem = item;
      break;
    }
  }
  
  if (!cartItem) {
    console.log('❌ No se encontró el cart-item para productId:', productId);
    return;
  }
  
  // Actualizar la cantidad
  const quantitySpan = cartItem.querySelector('.mx-2');
  if (quantitySpan) {
    console.log('✅ Actualizando cantidad de', quantitySpan.textContent, 'a', newQuantity);
    quantitySpan.textContent = newQuantity;
  } else {
    console.log('❌ No se encontró el span de cantidad');
  }
  
  // Actualizar el precio total del item
  const priceElement = cartItem.querySelector('.price strong');
  if (priceElement) {
    console.log('✅ Actualizando precio de', priceElement.textContent, 'a', `$${newPrice.toFixed(2)}`);
    priceElement.textContent = `$${newPrice.toFixed(2)}`;
  } else {
    console.log('❌ No se encontró el elemento de precio');
  }
  
  // Si la cantidad es 0, remover el item visualmente
  if (newQuantity <= 0) {
    console.log('🗑️ Eliminando item con cantidad 0');
    cartItem.style.opacity = '0.5';
    setTimeout(() => {
      cartItem.remove();
      // Si no quedan items, recargar la página
      const remainingItems = document.querySelectorAll('.cart-item');
      if (remainingItems.length === 0) {
        location.reload();
      }
    }, 300);
  }
}

// Función para actualizar los totales del carrito
function updateCartTotals(subtotal, deliveryFee, total) {
  // Actualizar subtotal
  const subtotalElement = document.querySelector('.d-flex.justify-content-between.mb-2:first-child strong');
  if (subtotalElement) {
    subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
  }
  
  // Actualizar total
  const totalElement = document.querySelector('.d-flex.justify-content-between.mb-3 strong');
  if (totalElement) {
    totalElement.textContent = `$${total.toFixed(2)}`;
  }
}

// Hacer globales las funciones para acceso desde HTML (asegurar que esté antes de cualquier uso en HTML)
window.toggleCartSidebar = toggleCartSidebar;
window.closeCartSidebar = closeCartSidebar;
window.updateCartItemQuantity = updateCartItemQuantity;
window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.addToCart = addToCart;
window.showToast = showToast;
window.showNotification = showNotification;
window.toggleUserMenu = toggleUserMenu;
window.closeUserMenu = closeUserMenu;

// Listeners para cerrar el sidebar con overlay o Escape
function initializeCartSidebarEvents() {
  // Event listener para el overlay del carrito
  const overlay = document.getElementById('cartOverlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      // Solo cerrar si se hace clic directamente en el overlay, no en el sidebar
      if (e.target === overlay) {
        closeCartSidebar();
      }
    });
  }
  
  // Event listener para cerrar con Escape
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closeCartSidebar();
    }
  });
  
  // Event listener para el botón de cerrar del sidebar
  const closeBtn = document.getElementById('cartSidebarClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeCartSidebar);
  }
}



// Función para actualizar los datos del carrito
function updateCartData() {
  console.log('Actualizando carrito con datos:', window.cart.items);
  const data = {
    items: window.cart.items
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
    console.log('Respuesta del servidor:', data);
    if (data.success) {
      loadCartData();
    } else {
      console.error('Error en respuesta del servidor:', data);
      showToast('Error actualizando el carrito', 'error');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    showToast('Error actualizando el carrito', 'error');
  });
}

// Función para mostrar confirmación de limpiar carrito
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
  const userScript = document.getElementById('user-data-script');
  if (userScript) {
    try {
      const userData = JSON.parse(userScript.textContent); // <-- usar textContent, no dataset.user
      console.log('DEBUG: getUserData - User data from script tag:', userData);
      return userData;
    } catch (e) {
      console.error('Error parsing user data from script tag:', e);
      return null;
    }
  }
  console.log('DEBUG: getUserData - No script with id user-data-script found.');
  return null;
}

function getStatusText(status) {
  const statusTexts = {
    'pending': 'pendiente',
    'confirmed': 'confirmado',
    'preparing': 'en preparación',
    'ready': 'listo para entregar',
    'en_camino': 'en camino',
    'entregado': 'entregado',
    'cancelado': 'cancelado'
  };
  return statusTexts[status] || status;
}

function updateOrderStatus(orderId, status) {
  const orderElement = document.querySelector(`[data-order-id="${orderId}"]`);
  if (orderElement) {
    const statusBadge = orderElement.querySelector('.order-status');
    if (statusBadge) {
      statusBadge.textContent = getStatusText(status);
      statusBadge.className = `badge order-status status-${status}`;
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
            }
          }
        }
        resolve(address);
      })
      .catch(error => {
        reject(error);
      });
  });
}

function updateLocationDisplay(address) {
  const locationDisplay = document.getElementById('currentLocation');
  if (locationDisplay) {
    locationDisplay.textContent = address;
  }
}

function saveLocation(address, latitude, longitude) {
  // Implementa la lógica para guardar la ubicación en el servidor o en localStorage
}

function loadSavedLocation() {
  // Implementa la lógica para cargar la ubicación guardada desde localStorage
}

// Alternar la visibilidad del menú de usuario móvil
function toggleUserMenu(event) {
  console.log('toggleUserMenu ejecutado');
  
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  const overlay = document.getElementById('userMenuOverlay');
  const sidebar = document.getElementById('userMenuSidebar');
  const container = document.querySelector('.user-menu-container');
  
  if (!overlay || !sidebar || !container) {
    console.error('No se encontró el menú de usuario (overlay, sidebar o container)');
    return;
  }

  console.log('Estado inicial: container.classList.contains(\'show\')', container.classList.contains('show'));
  console.log('Estado inicial: overlay.classList.contains(\'show\')', overlay.classList.contains('show'));
  console.log('Estado inicial: sidebar.classList.contains(\'show\')', sidebar.classList.contains('show'));

  // Si ya está abierto, ciérralo
  if (container.classList.contains('show')) {
    console.log('Cerrando menú de usuario desde toggleUserMenu');
    closeUserMenu();
    return;
  }

  console.log('Abriendo menú de usuario');
  
  // Renderizar el contenido antes de mostrar
  renderUserMenuSidebar();
  
  // Mostrar overlay, sidebar y container
  container.classList.add('show');
  overlay.classList.add('show');
  sidebar.classList.add('show');
  document.body.style.overflow = 'hidden';

  // Asegurarse de que el user-menu-body también se muestre
  const userMenuBody = document.querySelector('.user-menu-body');
  if (userMenuBody) {
    userMenuBody.classList.add('show');
  }
  
  console.log('Estado final: container.classList.contains(\'show\')', container.classList.contains('show'));
  console.log('Estado final: overlay.classList.contains(\'show\')', overlay.classList.contains('show'));
  console.log('Estado final: sidebar.classList.contains(\'show\')', sidebar.classList.contains('show'));
  console.log('Menú de usuario abierto');
}

// Cerrar el menú de usuario móvil
function closeUserMenu() {
  console.log('closeUserMenu ejecutado');
  
  const sidebar = document.getElementById('userMenuSidebar');
  const overlay = document.getElementById('userMenuOverlay');
  const container = document.querySelector('.user-menu-container');
  
  if (sidebar && overlay && container) {
    console.log('Cerrando menú de usuario');
    
    // Remover clases de show
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
    container.classList.remove('show');

    // Asegurarse de que el user-menu-body también se oculte
    const userMenuBody = document.querySelector('.user-menu-body');
    if (userMenuBody) {
      userMenuBody.classList.remove('show');
    }
    
    // Restaurar overflow del body
    document.body.style.overflow = '';
    
    console.log('Estado final: container.classList.contains(\'show\')', container.classList.contains('show'));
    console.log('Estado final: overlay.classList.contains(\'show\')', overlay.classList.contains('show'));
    console.log('Estado final: sidebar.classList.contains(\'show\')', sidebar.classList.contains('show'));

    // Limpiar estilos inline después de la animación
    setTimeout(() => {
      if (sidebar && !sidebar.classList.contains('show')) {
        sidebar.style = '';
        console.log('Menú de usuario cerrado completamente');
      }
    }, 350);
  }
}

// Renderizar el contenido del menú de usuario
function renderUserMenuSidebar() {
  const sidebar = document.getElementById('userMenuSidebar');
  if (!sidebar) return;

  // Obtener datos del usuario desde el script data-user
  const userScript = document.getElementById('user-data-script');
  let user = null;
  let isAuthenticated = false;
  
  if (userScript) {
    try {
      user = JSON.parse(userScript.textContent); // <-- usar textContent, no dataset.user
      isAuthenticated = user && user.id;
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
  }

  let menuContent = '';
  
  if (isAuthenticated && user) {
    // Usuario autenticado
    menuContent = `
      <div class="user-menu-header">
        <button class="user-menu-close" onclick="closeUserMenu()">
          <i class="fas fa-times"></i>
        </button>
        <h5><i class="fas fa-user me-2"></i>${user.nombre || 'Usuario'}</h5>
        <p>${user.email || ''}</p>
      </div>
      <div class="user-menu-body">
        ${user.tipo_usuario === 'admin' ? `
          <a href="/admin/dashboard" class="user-menu-item">
            <i class="fas fa-tools"></i>
            Panel Admin
          </a>
        ` : ''}
        ${user.tipo_usuario === 'restaurante' ? `
          <a href="/dashboard" class="user-menu-item">
            <i class="fas fa-store"></i>
            Mi Restaurante
          </a>
        ` : ''}
        <a href="/auth/profile" class="user-menu-item">
          <i class="fas fa-user"></i>
          Mi Perfil
        </a>
        <a href="/orders/history" class="user-menu-item">
          <i class="fas fa-list"></i>
          Mis Pedidos
        </a>
        <div class="user-menu-divider"></div>
        <form action="/auth/logout" method="GET" class="d-inline">
          <button type="submit" class="user-menu-item danger w-100 text-start border-0 bg-transparent">
            <i class="fas fa-sign-out-alt"></i>
            Cerrar Sesión
          </button>
        </form>
      </div>
    `;
  } else {
    // Usuario no autenticado
    menuContent = `
      <div class="user-menu-header">
        <button class="user-menu-close" onclick="closeUserMenu()">
          <i class="fas fa-times"></i>
        </button>
        <h5><i class="fas fa-user me-2"></i>Mi Cuenta</h5>
        <p>Inicia sesión o regístrate</p>
      </div>
      <div class="user-menu-body">
        <a href="/auth/login" class="user-menu-item">
          <i class="fas fa-sign-in-alt"></i>
          Ingresar
        </a>
        <a href="/auth/register" class="user-menu-item">
          <i class="fas fa-user-plus"></i>
          Registrarse
        </a>
      </div>
    `;
  }
  
  sidebar.innerHTML = menuContent;
}

// Función centralizada para inicializar todos los event listeners del carrito
function initializeAllCartEventListeners() {
  console.log('Initializing all cart event listeners');
  
  // Remover todos los event listeners previos para evitar duplicados
  const allCartElements = document.querySelectorAll('.cart-icon-container, #cartSidebarToggle, a[href="/cart"]');
  allCartElements.forEach(element => {
    // Clonar el elemento para remover todos los event listeners
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
  });
  
  // Asignar event listeners al carrito del header (si existe)
  const cartSidebarToggle = document.getElementById('cartSidebarToggle');
  if (cartSidebarToggle) {
    cartSidebarToggle.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Header cart clicked');
      toggleCartSidebar(e);
    });
  }
  
  // Asignar event listeners a todos los iconos del carrito (incluyendo móvil)
  const cartIconContainers = document.querySelectorAll('.cart-icon-container');
  cartIconContainers.forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Cart icon clicked');
      toggleCartSidebar(e);
    });
  });
  
  // Asignar event listeners a enlaces del carrito
  const cartLinks = document.querySelectorAll('a[href="/cart"]');
  cartLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Cart link clicked');
      toggleCartSidebar(e);
    });
  });
  
  // Inicializar eventos del sidebar
  initializeCartSidebarEvents();
}

// Dashboard Mobile Overlay Menu functions
function setupDashboardMobileOverlay() {
  const moreBtn = document.getElementById('dashboardMoreBtn');
  const overlayMenu = document.getElementById('dashboardMobileOverlayMenu');
  const closeBtn = document.getElementById('closeDashboardOverlayBtn');

  if (moreBtn && overlayMenu && closeBtn) {
    moreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      overlayMenu.classList.add('show');
      document.body.classList.add('overlay-open');
    });

    closeBtn.addEventListener('click', () => {
      overlayMenu.classList.remove('show');
      document.body.classList.remove('overlay-open');
    });

    // Close when clicking outside (on the overlay itself)
    overlayMenu.addEventListener('click', (e) => {
      if (e.target === overlayMenu) {
        overlayMenu.classList.remove('show');
        document.body.classList.remove('overlay-open');
      }
    });
  }
}
document.addEventListener('DOMContentLoaded', setupDashboardMobileOverlay);

// Sidebar móvil admin (funciona en /admin* y /dashboard*)
function setupAdminSidebarMobile() {
    const triggers = document.querySelectorAll('.admin-sidebar-mobile-trigger');
    const sidebar = document.getElementById('adminSidebarMobile');
    const overlay = document.getElementById('adminSidebarMobileOverlay');
    const closeBtn = document.querySelector('.close-admin-sidebar-mobile');

    triggers.forEach(trigger => {
        if (trigger && sidebar && overlay) {
            trigger.addEventListener('click', function(e) {
                e.preventDefault();
                sidebar.classList.add('open');
                overlay.classList.add('open');
                sidebar.style.display = 'block';
                overlay.style.display = 'block';
            });
        }
    });
    if (closeBtn && sidebar && overlay) {
        closeBtn.addEventListener('click', function() {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
            setTimeout(() => {
                sidebar.style.display = 'none';
                overlay.style.display = 'none';
            }, 300);
        });
    }
    if (overlay && sidebar) {
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
            setTimeout(() => {
                sidebar.style.display = 'none';
                overlay.style.display = 'none';
            }, 300);
        });
    }
}
document.addEventListener('DOMContentLoaded', setupAdminSidebarMobile);
