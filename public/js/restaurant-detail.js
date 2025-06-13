// Restaurant detail page functionality
console.log('Restaurant detail script loaded');

// Función para inicializar los botones de agregar al carrito
function initializeAddToCartButtons() {
    console.log('Initializing add to cart buttons...');
    
    // Verificar que Bootstrap esté disponible
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap no está cargado');
        return;
    }
    
    // Verificar si los botones existen en el DOM
    const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');
    console.log('Found buttons:', addToCartButtons.length);
    
    // Verificar el HTML de los botones
    addToCartButtons.forEach((btn, index) => {
        console.log(`Botón ${index + 1} HTML:`, btn.outerHTML);
        console.log(`Botón ${index + 1} atributos:`, {
            productId: btn.getAttribute('data-product-id'),
            productName: btn.getAttribute('data-product-name'),
            productPrice: btn.getAttribute('data-product-price'),
            restaurantId: btn.getAttribute('data-restaurant-id')
        });
    });
    
    if (addToCartButtons.length === 0) {
        console.error('No se encontraron botones de agregar al carrito');
        return;
    }
    
    // Función para manejar el clic en el botón
    function handleAddToCartClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const btn = this;
        console.log('Botón clickeado:', {
            productId: btn.getAttribute('data-product-id'),
            productName: btn.getAttribute('data-product-name'),
            productPrice: btn.getAttribute('data-product-price'),
            restaurantId: btn.getAttribute('data-restaurant-id')
        });
        
        const productId = btn.getAttribute('data-product-id');
        if (!productId) {
            console.error('El botón no tiene productId');
            return;
        }
        
        // Hacer la petición directamente
        fetch('/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId: productId,
                quantity: 1
            })
        })
        .then(response => {
            console.log('Response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Response data:', data);
            if (data.success) {
                showToast('Producto agregado al carrito', 'success');
                // Actualizar el contador del carrito
                updateCartCount(data.cartCount);
                // Actualizar el resumen del carrito
                updateCartSummary(data);
            } else {
                showToast(data.message || 'Error agregando producto', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Error agregando producto al carrito', 'error');
        });
    }
    
    // Agregar el evento click a cada botón
    addToCartButtons.forEach((btn, index) => {
        // Remover cualquier evento existente
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Agregar el nuevo evento
        newBtn.addEventListener('click', handleAddToCartClick);
        console.log(`Evento click agregado al botón ${index + 1}`);
    });
}

// Función para actualizar el contador del carrito
function updateCartCount(count) {
    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(badge => {
        badge.textContent = count || 0;
        badge.style.display = count > 0 ? 'flex' : 'none';
    });
}

// Función para actualizar el resumen del carrito
function updateCartSummary(data) {
    const cartSummary = document.getElementById('cartSummary');
    if (!cartSummary) return;
    
    if (data.cartCount > 0) {
        cartSummary.classList.remove('d-none');
        const cartTotal = document.getElementById('cartTotal');
        if (cartTotal) {
            cartTotal.textContent = data.cartTotal || 0;
        }
        
        // Actualizar los items del carrito
        fetch('/cart/data')
            .then(response => response.json())
            .then(cartData => {
                const cartItems = document.getElementById('cartItems');
                if (!cartItems) return;
                
                cartItems.innerHTML = '';
                if (cartData.cart && cartData.cart.length > 0) {
                    cartData.cart.forEach(item => {
                        cartItems.innerHTML += `
                            <div class="cart-item d-flex justify-content-between mb-2">
                                <span>${item.name} x${item.quantity}</span>
                                <span>$${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        `;
                    });
                }
            })
            .catch(error => {
                console.error('Error fetching cart data:', error);
            });
    } else {
        cartSummary.classList.add('d-none');
    }
}

// Función para mostrar notificaciones
function showToast(message, type = 'info') {
    console.log('Showing toast:', { message, type });
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(container);
    }
    
    container.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAddToCartButtons);
} else {
    initializeAddToCartButtons();
} 