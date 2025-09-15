document.addEventListener('DOMContentLoaded', () => {
    const cartContainer = document.querySelector('.cart-items');
    const subtotalElement = document.querySelector('.card-body strong:nth-of-type(1)');
    const deliveryFeeElement = document.querySelector('.card-body strong:nth-of-type(2)');
    const totalElement = document.querySelector('.card-body strong.text-orange');
    const clearCartBtn = document.querySelector('.clear-cart-btn');
    const cartEmptyMessage = document.querySelector('.text-center.py-5');

    // Función para obtener el token CSRF
    function getCsrfToken() {
        const tokenInput = document.getElementById('csrfToken');
        return tokenInput ? tokenInput.value : '';
    }

    // Función para mostrar notificaciones (si no existe ya)
    if (typeof showNotification === 'undefined') {
        window.showNotification = function(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `toast align-items-center text-white bg-${type} border-0 position-fixed bottom-0 end-0 m-3`;
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            
            const toastBody = document.createElement('div');
            toastBody.className = 'toast-body';
            toastBody.textContent = message;
            
            toast.appendChild(toastBody);
            document.body.appendChild(toast);
            
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
            
            toast.addEventListener('hidden.bs.toast', () => {
                document.body.removeChild(toast);
            });
        };
    }

    // Función para actualizar la UI del carrito
    function updateCartUI(data) {
        if (data.cartCount === 0) {
            cartContainer.innerHTML = ''; // Limpiar items
            document.querySelector('.restaurant-info').style.display = 'none';
            document.querySelector('.clear-cart-btn').style.display = 'none';
            document.querySelector('.proceed-checkout-btn').style.display = 'none';
            cartEmptyMessage.style.display = 'block';
            subtotalElement.textContent = '$0.00';
            deliveryFeeElement.textContent = '$0.00';
            totalElement.textContent = '$0.00';
        } else {
            subtotalElement.textContent = `$${data.subtotal.toFixed(2)}`;
            deliveryFeeElement.textContent = `$${data.deliveryFee.toFixed(2)}`;
            totalElement.textContent = `$${data.total.toFixed(2)}`;
        }
    }

    // Manejar cambios de cantidad
    if (cartContainer) {
        cartContainer.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.classList.contains('cart-qty-btn')) {
                const productId = target.dataset.productoId;
                const action = target.dataset.action;
                const change = action === 'increment' ? 1 : -1;

                try {
                    const response = await fetch('/cart/update', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-csrf-token': getCsrfToken()
                        },
                        body: JSON.stringify({ productId, change })
                    });
                    const data = await response.json();

                    if (data.success) {
                        const itemElement = target.closest('.cart-item');
                        if (data.newQuantity > 0) {
                            itemElement.querySelector('span').textContent = data.newQuantity;
                            itemElement.querySelector('.price strong').textContent = `$${data.newPrice.toFixed(2)}`;
                        } else {
                            itemElement.remove();
                        }
                        updateCartUI(data);
                    } else {
                        // showNotification(data.message, 'error');
                    }
                } catch (error) {
                    console.error('Error actualizando cantidad:', error);
                    showNotification('Ocurrió un error al actualizar la cantidad. Por favor, intenta de nuevo.', 'error');
                }
            } else if (target.classList.contains('remove-item-btn') || target.closest('.remove-item-btn')) {
                const productId = target.closest('.remove-item-btn').dataset.productoId;
                
                try {
                    const response = await fetch('/cart/remove', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-csrf-token': getCsrfToken()
                        },
                        body: JSON.stringify({ productId })
                    });
                    const data = await response.json();

                    if (data.success) {
                        target.closest('.cart-item').remove();
                        updateCartUI(data);
                        showNotification('Producto eliminado del carrito', 'success');
                    } else {
                        showNotification(data.message, 'error');
                    }
                } catch (error) {
                    console.error('Error eliminando producto:', error);
                    showNotification('Error de conexión al eliminar el producto', 'error');
                }
            }
        });
    }

    // Manejar vaciar carrito
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', async () => {
            if (!confirm('¿Estás seguro de que quieres vaciar tu carrito?')) {
                return;
            }
            try {
                const response = await fetch('/cart/clear', {
                    method: 'POST',
                    headers: {
                        'x-csrf-token': getCsrfToken()
                    }
                });
                const data = await response.json();

                if (data.success) {
                    updateCartUI({ cartCount: 0 }); // Forzar actualización a carrito vacío
                    showNotification('Carrito vaciado exitosamente', 'success');
                } else {
                    showNotification(data.message, 'error');
                }
            } catch (error) {
                console.error('Error vaciando carrito:', error);
                showNotification('Error de conexión al vaciar el carrito', 'error');
            }
        });
    }
});
