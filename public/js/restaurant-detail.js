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
        const btn = this;
        const productId = btn.getAttribute('data-product-id');
        console.log('Clic en botón agregar al carrito, ID:', productId);

        if (productId && typeof window.addToCart === 'function') {
            // Usar la función global de app.js que maneja todo el flujo
            // (actualización de UI, confirmación de cambio de restaurante, etc.)
            window.addToCart(productId, 1);
        } else {
            console.error('Product ID no encontrado o la función global addToCart no está disponible.');
            if (typeof showToast === 'function') showToast('Error al agregar el producto.', 'error');
        }
    }
    
    // Asignar el manejador de eventos a cada botón, evitando múltiples registros
    addToCartButtons.forEach(btn => {
        if (!btn.dataset.listenerAdded) {
            btn.addEventListener('click', handleAddToCartClick);
            btn.dataset.listenerAdded = 'true';
        }
    });
}

// Lógica para ocultar/mostrar solo un producto específico por ID y guardar en la base de datos
function setupMenuVisibilityToggle() {
    const toggle = document.getElementById('toggleMenuVisibility');
    const firstProduct = document.querySelector('.product-item');
    if (!toggle || !firstProduct) return;
    const productId = firstProduct.getAttribute('data-product-id');
    if (!productId) return;

    // Obtener visibilidad inicial desde el backend (opcional, si ya viene en el HTML)
    // Aquí asumimos que el producto está visible si el div está visible

    toggle.checked = firstProduct.style.display !== 'none';

    toggle.addEventListener('change', async function() {
        const visible = this.checked;
        try {
            const res = await fetch(`/products/${productId}/visibility`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visible })
            });
            const data = await res.json();
            if (data.success) {
                firstProduct.style.display = visible ? '' : 'none';
            } else {
                alert('Error actualizando visibilidad: ' + (data.message || '')); 
                // Revertir el switch si falla
                toggle.checked = !visible;
            }
        } catch (err) {
            alert('Error de red al actualizar visibilidad');
            toggle.checked = !visible;
        }
    });
}

// Inicializar los botones al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
    console.log('Document ready, initializing...');
    initializeAddToCartButtons();
    setupMenuVisibilityToggle();

    const productSearchInput = document.getElementById('productSearch');
    if (productSearchInput) {
        productSearchInput.addEventListener('input', () => {
            const searchTerm = productSearchInput.value.toLowerCase().trim();
            const categories = document.querySelectorAll('.menu-category');

            categories.forEach(category => {
                const products = category.querySelectorAll('.product-item');
                let categoryHasVisibleProducts = false;

                products.forEach(product => {
                    const productName = product.dataset.name.toLowerCase();
                    const productDescription = product.dataset.description.toLowerCase();
                    const isVisible = productName.includes(searchTerm) || productDescription.includes(searchTerm);
                    
                    // Solo cambiar el estilo si el producto no está oculto por el admin
                    if (product.style.display !== 'none' || isVisible) {
                         product.style.display = isVisible ? '' : 'none';
                    }
                   
                    if (isVisible) {
                        categoryHasVisibleProducts = true;
                    }
                });

                // Mostrar u ocultar el título de la categoría
                const categoryTitle = category.querySelector('.category-title');
                if (categoryTitle) {
                    category.style.display = categoryHasVisibleProducts ? '' : 'none';
                }
            });
        });
    }
});
