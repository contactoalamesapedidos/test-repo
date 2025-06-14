// Restaurant detail page functionality
console.log('=== RESTAURANT DETAIL SCRIPT LOADING ===');
console.log('Script path:', document.currentScript?.src);
console.log('Document ready state:', document.readyState);

// Variables globales para el modal
let currentProduct = null;
let modalInstance = null;

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
        const productId = btn.getAttribute('data-product-id');
        const productName = btn.getAttribute('data-product-name');
        const productPrice = parseFloat(btn.getAttribute('data-product-price'));
        const productImage = btn.closest('.product-card').querySelector('.product-image').src;
        const productDescription = btn.closest('.product-card').querySelector('.card-text').textContent;

        if (!productId) {
            console.error('El botón no tiene productId');
            return;
        }

        // Añadir el producto directamente al carrito
        updateCart(productId, 1); // Añadir 1 unidad por defecto

        // Opcional: Mostrar un mensaje de éxito o abrir el sidebar del carrito
        // showToast('Producto agregado al carrito', 'success');
        // toggleCartSidebar(); // Si quieres que el sidebar se abra automáticamente
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

// Función para actualizar el carrito
function updateCart(productId, quantity) {
    fetch('/cart/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, quantity })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Actualizar el contador del carrito
            const cartBadge = document.querySelector('.cart-badge');
            if (cartBadge) {
                cartBadge.textContent = data.cartCount;
                cartBadge.style.display = data.cartCount > 0 ? 'flex' : 'none';
            }
            
            // Mostrar mensaje de éxito
            showToast('Producto agregado al carrito', 'success');
            
            // Actualizar la UI del carrito y abrir el sidebar
            updateCartUI(); // Llama a updateCartUI sin argumentos para que obtenga los datos del servidor
            toggleCartSidebar();
        } else {
            showToast(data.message || 'Error agregando al carrito', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error agregando al carrito', 'error');
    });
}

// Función para inicializar el modal del carrito
function initializeCartModal() {
    console.log('Inicializando modal del carrito...');
    const modalElement = document.getElementById('addToCartModal');
    if (!modalElement) {
        console.error('Modal element not found');
        return;
    }
    console.log('Modal element encontrado:', modalElement);

    try {
        modalInstance = new bootstrap.Modal(modalElement);
        console.log('Modal instance creada:', modalInstance);

        // Inicializar controles de cantidad
        const decreaseBtn = document.getElementById('decreaseQty');
        const increaseBtn = document.getElementById('increaseQty');
        const quantityInput = document.getElementById('productQuantity');
        const totalPriceElement = document.getElementById('totalPrice');

        console.log('Controles encontrados:', {
            decreaseBtn: !!decreaseBtn,
            increaseBtn: !!increaseBtn,
            quantityInput: !!quantityInput,
            totalPriceElement: !!totalPriceElement
        });

        if (decreaseBtn && increaseBtn && quantityInput) {
            decreaseBtn.addEventListener('click', () => {
                const currentQty = parseInt(quantityInput.value);
                if (currentQty > 1) {
                    quantityInput.value = currentQty - 1;
                    updateTotalPrice();
                }
            });

            increaseBtn.addEventListener('click', () => {
                const currentQty = parseInt(quantityInput.value);
                quantityInput.value = currentQty + 1;
                updateTotalPrice();
            });

            quantityInput.addEventListener('change', () => {
                if (parseInt(quantityInput.value) < 1) {
                    quantityInput.value = 1;
                }
                updateTotalPrice();
            });
        }

        // Función para actualizar el precio total
        function updateTotalPrice() {
            if (currentProduct && totalPriceElement) {
                const quantity = parseInt(quantityInput.value);
                const total = currentProduct.price * quantity;
                totalPriceElement.textContent = total.toFixed(2);
            }
        }

        // Botón de confirmar agregar al carrito
        const confirmButton = document.getElementById('confirmAddToCart');
        if (confirmButton) {
            console.log('Botón de confirmar encontrado');
            confirmButton.addEventListener('click', () => {
                if (currentProduct) {
                    const quantity = parseInt(quantityInput.value);
                    addToCart(currentProduct.id, quantity);
                    modalInstance.hide();
                }
            });
        } else {
            console.error('Botón de confirmar no encontrado');
        }
    } catch (error) {
        console.error('Error inicializando modal:', error);
    }
}

// Función para mostrar el modal con los datos del producto
function showAddToCartModal(product) {
    console.log('Mostrando modal para producto:', product);
    currentProduct = product;
    
    // Actualizar contenido del modal
    const modalProductImage = document.getElementById('modalProductImage');
    const modalProductName = document.getElementById('modalProductName');
    const modalProductDescription = document.getElementById('modalProductDescription');
    const quantityInput = document.getElementById('productQuantity');
    const totalPriceElement = document.getElementById('totalPrice');

    console.log('Elementos del modal encontrados:', {
        modalProductImage: !!modalProductImage,
        modalProductName: !!modalProductName,
        modalProductDescription: !!modalProductDescription,
        quantityInput: !!quantityInput,
        totalPriceElement: !!totalPriceElement
    });

    if (modalProductImage) modalProductImage.src = product.image;
    if (modalProductName) modalProductName.textContent = product.name;
    if (modalProductDescription) modalProductDescription.textContent = product.description;
    if (quantityInput) quantityInput.value = 1;
    if (totalPriceElement) totalPriceElement.textContent = product.price.toFixed(2);

    // Mostrar el modal
    if (modalInstance) {
        console.log('Mostrando modal instance');
        modalInstance.show();
    } else {
        console.error('Modal instance no disponible');
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, inicializando...');
    initializeAddToCartButtons();
    initializeCartModal();
});