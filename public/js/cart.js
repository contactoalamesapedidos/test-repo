// Funciones para manejar el carrito flotante
console.log('cart.js loaded and executing');

function toggleCartSidebar(event) {
    console.log('toggleCartSidebar called');
    if (event) {
        event.stopPropagation();
        console.log('Event propagation stopped');
    }
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    
    console.log('Sidebar element:', sidebar);
    console.log('Overlay element:', overlay);

    if (sidebar && overlay) {
        if (sidebar.classList.contains('show')) {
            console.log('Cart is show, closing it.');
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
            document.body.style.overflow = '';
            console.log('Sidebar show class removed:', sidebar.classList.contains('show'));
            console.log('Overlay show class removed:', overlay.classList.contains('show'));
        } else {
            console.log('Cart is not show, opening it.');
            sidebar.classList.add('show');
            overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
            console.log('Sidebar show class added:', sidebar.classList.contains('show'));
            console.log('Overlay show class added:', overlay.classList.contains('show'));
        }
    }
}

function closeCartSidebar() {
    console.log('closeCartSidebar called');
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// Función para actualizar la cantidad de un item en el carrito
async function updateCartItemQuantity(productId, change) {
    try {
        const response = await fetch('/cart/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId, change })
        });
        
        const data = await response.json();
        if (data.success) {
            updateCartUI(data.cart || []);
            updateCartCount(data.cartCount || 0);
        } else {
            showToast(data.message || 'Error actualizando el carrito', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error actualizando el carrito', 'error');
    }
}

// Función para eliminar un item del carrito
async function removeFromCart(productId) {
    try {
        const response = await fetch('/cart/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId })
        });
        
        const data = await response.json();
        if (data.success) {
            updateCartUI(data.cart || []);
            updateCartCount(data.cartCount || 0);
        } else {
            showToast(data.message || 'Error eliminando del carrito', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error eliminando del carrito', 'error');
    }
}

// Función para vaciar el carrito
async function clearCart() {
    if (!confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
        return;
    }
    
    try {
        const response = await fetch('/cart/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        if (data.success) {
            updateCartUI([]);
            updateCartCount(0);
            closeCartSidebar();
        } else {
            showToast(data.message || 'Error limpiando el carrito', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error limpiando el carrito', 'error');
    }
}

// Función para actualizar la UI del carrito
function updateCartUI(cart = null) {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartSummary = document.getElementById('cartSummary');
    
    if (!cartItemsContainer || !cartSummary) return;

    // Obtener los datos del carrito del servidor para asegurar que siempre estén actualizados
    fetch('/cart/data')
        .then(response => response.json())
        .then(data => {
            const currentCart = data.cart || [];
            const subtotal = data.subtotal || 0;
            const deliveryFee = data.deliveryFee || 0;
            const total = data.total || 0;

            // Actualizar lista de items
            if (Array.isArray(currentCart) && currentCart.length > 0) {
                cartItemsContainer.innerHTML = currentCart.map(item => {
                    // Asegurar que la ruta de la imagen sea correcta
                    const imagePath = item.imagen.startsWith('/') ? item.imagen : `/uploads/${item.imagen}`;
                    
                    return `
                        <div class="cart-item" data-product-id="${item.productId}">
                            <img src="${imagePath}" 
                                 alt="${item.name || 'Producto'}" 
                                 class="cart-item-image"
                                 onerror="this.src='/images/no-image.png'">
                            <div class="cart-item-details">
                                <h4>${item.name || 'Producto'}</h4>
                                <p class="cart-item-price">$${(item.price || 0).toFixed(2)}</p>
                                <div class="cart-item-quantity">
                                    <button onclick="updateCartItemQuantity(${item.productId}, -1)">-</button>
                                    <span>${item.quantity || 0}</span>
                                    <button onclick="updateCartItemQuantity(${item.productId}, 1)">+</button>
                                </div>
                            </div>
                            <button class="remove-item" onclick="removeFromCart(${item.productId})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                }).join('');

                cartSummary.innerHTML = `
                    <div class="cart-summary-item">
                        <span>Subtotal</span>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="cart-summary-item">
                        <span>Envío</span>
                        <span>$${deliveryFee.toFixed(2)}</span>
                    </div>
                    <div class="cart-summary-item total">
                        <span>Total</span>
                        <span>$${total.toFixed(2)}</span>
                    </div>
                    <a href="/orders/checkout" class="btn btn-primary w-100 mb-2">
                        <i class="fas fa-credit-card me-2"></i>
                        Proceder al Pago
                    </a>
                    <button onclick="clearCart()" class="btn btn-outline-danger w-100">
                        <i class="fas fa-trash me-2"></i>
                        Vaciar Carrito
                    </button>
                `;
            } else {
                cartItemsContainer.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
                        <h6>Tu carrito está vacío</h6>
                        <p class="text-muted small">Agrega productos de tus restaurantes favoritos</p>
                        <a href="/search" class="btn btn-primary btn-sm mt-2">
                            <i class="fas fa-utensils me-2"></i>
                            Ver Restaurantes
                        </a>
                    </div>
                `;
                cartSummary.innerHTML = '';
            }
            updateCartCount(currentCart.length); // Actualizar el contador del carrito
        })
        .catch(error => {
            console.error('Error obteniendo datos del carrito:', error);
            cartItemsContainer.innerHTML = `
                <div class="text-center py-4 text-danger">
                    <p>Error al cargar el carrito.</p>
                </div>
            `;
            cartSummary.innerHTML = '';
        });
}

// Función para actualizar el contador del carrito
function updateCartCount(count) {
    const cartBadge = document.querySelector('.cart-badge');
    if (cartBadge) {
        cartBadge.textContent = count;
        cartBadge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Cerrar el sidebar cuando se hace clic fuera de él
/*
document.addEventListener('click', (event) => {
    const sidebar = document.getElementById('cartSidebar');
    const cartButton = document.querySelector('.cart-button');
    
    // console.log('Click event target:', event.target);
    // console.log('Is sidebar active?', sidebar.classList.contains('active'));

    if (sidebar && cartButton) {
        // Si el clic no es dentro del sidebar y no es el botón del carrito
        if (!sidebar.contains(event.target) && !cartButton.contains(event.target) && sidebar.classList.contains('active')) {
            closeCartSidebar();
        }
    }
});
*/