// Funciones para el manejo de productos
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar tooltips de Bootstrap
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Manejar el formulario de productos
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validación básica del formulario
            const nombre = this.querySelector('#nombre').value.trim();
            const descripcion = this.querySelector('#descripcion').value.trim();
            const precio = this.querySelector('#precio').value;
            const categoria_id = this.querySelector('#categoria_id').value;
            
            if (!nombre) {
                showNotification('Por favor ingresa el nombre del producto', 'error');
                this.querySelector('#nombre').focus();
                return;
            }
            
            if (!descripcion) {
                showNotification('Por favor ingresa la descripción del producto', 'error');
                this.querySelector('#descripcion').focus();
                return;
            }
            
            if (!precio || isNaN(precio) || parseFloat(precio) < 0) {
                showNotification('Por favor ingresa un precio válido', 'error');
                this.querySelector('#precio').focus();
                return;
            }
            
            if (!categoria_id) {
                showNotification('Por favor selecciona una categoría', 'error');
                this.querySelector('#categoria_id').focus();
                return;
            }
            
            try {
                const formData = new FormData(this);
                const submitBtn = this.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
                
                const response = await fetch('/dashboard/products/save', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                if (!data.success) {
                    if (data.errors) {
                        // Si hay errores específicos de validación
                        const errorMessages = data.errors.map(err => err.msg).join('\n');
                        throw new Error(errorMessages);
                    }
                    throw new Error(data.message || 'Error guardando el producto');
                }
                
                // Cerrar modal y recargar página
                const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
                modal.hide();
                showNotification('Producto guardado exitosamente', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                showNotification(error.message || 'Error guardando el producto', 'error');
            } finally {
                const submitBtn = productForm.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Guardar Producto';
            }
        });
    }

    // Preview de imagen
    const imageInput = document.getElementById('imagen');
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const preview = document.getElementById('imagePreview');
            const previewImg = preview.querySelector('img');
            
            if (file) {
                // Validar tamaño (5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showNotification('La imagen no debe superar los 5MB', 'error');
                    this.value = '';
                    preview.style.display = 'none';
                    return;
                }
                
                // Validar tipo
                if (!file.type.startsWith('image/')) {
                    showNotification('Por favor selecciona una imagen válida', 'error');
                    this.value = '';
                    preview.style.display = 'none';
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    preview.style.display = 'block';
                }
                reader.readAsDataURL(file);
            } else {
                preview.style.display = 'none';
            }
        });
    }

    // Manejar edición de productos
    const editButtons = document.querySelectorAll('.edit-product');
    editButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const productId = this.dataset.id;
            try {
                const response = await fetch(`/dashboard/products/${productId}`);
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message);
                }
                
                const product = data.product;
                const form = document.getElementById('productForm');
                const modal = document.getElementById('productModal');
                
                // Llenar el formulario con los datos del producto
                form.querySelector('#nombre').value = product.nombre;
                form.querySelector('#descripcion').value = product.descripcion;
                form.querySelector('#precio').value = product.precio;
                form.querySelector('#categoria_id').value = product.categoria_id;
                form.querySelector('#ingredientes').value = product.ingredientes || '';
                form.querySelector('#disponible').checked = product.disponible === 1;
                
                // Agregar el ID del producto como campo oculto
                let productIdInput = form.querySelector('input[name="product_id"]');
                if (!productIdInput) {
                    productIdInput = document.createElement('input');
                    productIdInput.type = 'hidden';
                    productIdInput.name = 'product_id';
                    form.appendChild(productIdInput);
                }
                productIdInput.value = productId;
                
                // Actualizar título del modal
                modal.querySelector('.modal-title').textContent = 'Editar Producto';
                
                // Mostrar imagen actual si existe
                const preview = document.getElementById('imagePreview');
                const previewImg = preview.querySelector('img');
                if (product.imagen_url) {
                    previewImg.src = product.imagen_url;
                    preview.style.display = 'block';
                    // Agregar indicador de imagen actual
                    const imageLabel = form.querySelector('label[for="imagen"]');
                    imageLabel.innerHTML = 'Imagen del Producto <small class="text-muted">(dejar en blanco para mantener la actual)</small>';
                } else {
                    preview.style.display = 'none';
                    // Restaurar etiqueta original
                    const imageLabel = form.querySelector('label[for="imagen"]');
                    imageLabel.textContent = 'Imagen del Producto';
                }
                
                // Mostrar el modal
                const modalInstance = new bootstrap.Modal(modal);
                modalInstance.show();
                
            } catch (error) {
                showNotification(error.message || 'Error cargando los datos del producto', 'error');
            }
        });
    });

    // Resetear formulario cuando se cierra el modal
    const productModal = document.getElementById('productModal');
    if (productModal) {
        productModal.addEventListener('hidden.bs.modal', function() {
            const form = document.getElementById('productForm');
            if (form) {
                form.reset();
                // Limpiar el campo product_id
                const productIdInput = form.querySelector('input[name="product_id"]');
                if (productIdInput) {
                    productIdInput.remove();
                }
                // Restaurar el título del modal
                this.querySelector('.modal-title').textContent = 'Nuevo Producto';
                // Restaurar etiqueta de imagen
                const imageLabel = form.querySelector('label[for="imagen"]');
                imageLabel.textContent = 'Imagen del Producto';
                // Ocultar la vista previa de la imagen
                const preview = document.getElementById('imagePreview');
                if (preview) {
                    preview.style.display = 'none';
                }
            }
        });
    }

    // Manejar eliminación de productos
    const deleteButtons = document.querySelectorAll('.delete-product');
    deleteButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            
            if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) {
                return;
            }
            
            const productId = this.dataset.id;
            try {
                const response = await fetch(`/dashboard/products/${productId}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.message);
                }
                
                showNotification('Producto eliminado exitosamente', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                showNotification(error.message || 'Error eliminando el producto', 'error');
            }
        });
    });

    // Manejar cambio de disponibilidad
    const availabilityToggles = document.querySelectorAll('.availability-toggle');
    availabilityToggles.forEach(toggle => {
        toggle.addEventListener('change', async function() {
            const productId = this.dataset.id;
            const isAvailable = this.checked;
            
            try {
                const response = await fetch(`/dashboard/products/${productId}/availability`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ disponible: isAvailable })
                });
                
                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.message);
                }
                
                showNotification(
                    `Producto ${isAvailable ? 'disponible' : 'no disponible'}`, 
                    'success'
                );
            } catch (error) {
                this.checked = !isAvailable; // Revertir el cambio
                showNotification(error.message || 'Error actualizando disponibilidad', 'error');
            }
        });
    });
});

// Función helper para mostrar notificaciones
function showNotification(message, type = 'success') {
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