// Dashboard Products - JavaScript Optimizado

// Función para editar producto
function editProduct(productId) {
    const editButton = document.querySelector(`.edit-product[data-id="${productId}"]`);
    const submitBtn = document.querySelector('#productForm button[type="submit"]');
    
    if (!editButton || !submitBtn) return;
    
    // Mostrar indicador de carga
    editButton.disabled = true;
    editButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    submitBtn.disabled = true;
    
    // Obtener datos del producto
    fetch(`/dashboard/products/${productId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fillProductForm(data.product);
                showProductModal('Editar Producto', productId);
            } else {
                showToast(`Error al obtener los datos del producto: ${data.message}`, 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Error al obtener los datos del producto', 'danger');
        })
        .finally(() => {
            // Restaurar el botón de editar
            editButton.disabled = false;
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            submitBtn.disabled = false;
        });
}

// Llenar formulario con datos del producto
function fillProductForm(product) {
    const form = document.getElementById('productForm');
    if (!form) return;

    form.querySelector('#nombre').value = product.nombre || '';
    form.querySelector('#descripcion').value = product.descripcion || '';
    form.querySelector('#precio').value = product.precio || '';
    form.querySelector('#precio_descuento').value = product.precio_descuento || '';
    form.querySelector('#categoria_id').value = product.categoria_id || '';
    form.querySelector('#ingredientes').value = product.ingredientes || '';
    form.querySelector('#disponible').checked = product.disponible || false;
    form.querySelector('#destacado').checked = product.destacado || false;

    // Manejar imagen
    const imagePreview = document.getElementById('imagePreview');
    if (product.imagen && imagePreview) {
        imagePreview.style.display = 'block';
        imagePreview.querySelector('img').src = product.imagen;
    } else if (imagePreview) {
        imagePreview.style.display = 'none';
    }
}

// Mostrar modal del producto
function showProductModal(title, productId = null) {
    console.log('🎭 Abriendo modal:', { title, productId });

    const modal = document.getElementById('productModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('productForm');

    if (modalTitle) modalTitle.textContent = title;
    if (form) {
        form.dataset.productId = productId || '';
    }

    if (modal && !modal.classList.contains('show')) {
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }
}

// Toast notification helper optimizado
function showToast(message, type = 'success') {
    const toastId = `toast_${Date.now()}`;
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-bg-${type === 'success' ? 'success' : 'danger'} border-0 mb-2" 
             role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="3000">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>`;
    
    let container = document.querySelector('.toast-container') || document.querySelector('#toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = 2000;
        document.body.appendChild(container);
    }
    
    container.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const toast = new bootstrap.Toast(toastEl);
            toast.show();
            toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
        } else {
            setTimeout(() => toastEl.remove(), 3000);
        }
    } catch (e) {
        console.error('Error mostrando toast:', e);
        setTimeout(() => toastEl.remove(), 3000);
    }
}

// Previsualización de imagen optimizada
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM cargado, configurando eventos...');
    
    const imagenInput = document.getElementById('imagen');
    if (imagenInput) {
        imagenInput.addEventListener('change', handleImagePreview);
    }
    
    // No configurar el formulario aquí, se hará cuando se abra el modal
});

function handleImagePreview(e) {
    const file = e.target.files[0];
    const imagePreview = document.getElementById('imagePreview');
    
    if (!file || !imagePreview) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('El archivo debe ser una imagen válida', 'danger');
        e.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(ev) {
        imagePreview.style.display = 'block';
        imagePreview.querySelector('img').src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

// Configurar formulario de producto
function setupProductForm() {
    const form = document.getElementById('productForm');
    if (!form) return;

    // Verificar si ya se configuró este formulario
    if (form.dataset.configured === 'true') {
        console.log('⚠️ Formulario ya configurado, saltando configuración adicional');
        return;
    }

    console.log('🔧 Configurando formulario de producto...');
    form.dataset.configured = 'true';

    // Remover event listeners anteriores para evitar duplicados
    const oldSubmitHandler = form.dataset.submitHandler;
    if (oldSubmitHandler) {
        form.removeEventListener('submit', window[oldSubmitHandler]);
    }

    // Crear nueva función de manejo de submit
    const submitHandler = async function(e) {
        e.preventDefault();

        console.log('🔄 Evento submit detectado');

        if (form.dataset.isSubmitting === 'true') {
            console.log('❌ Formulario ya se está enviando, ignorando envío adicional');
            return false;
        }

        if (!validateProductForm()) return false;

        form.dataset.isSubmitting = 'true';
        const submitBtn = form.querySelector('button[type="submit"]');
        const spinner = document.getElementById('productSpinner');
        const btnText = document.getElementById('productBtnText');

        // Deshabilitar el botón inmediatamente
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
        }
        if (spinner) spinner.classList.remove('d-none');
        if (btnText) btnText.textContent = 'Guardando...';

        try {
            const formData = new FormData(form);
            const productId = form.dataset.productId;

            const url = productId ? `/dashboard/products/edit/${productId}` : '/dashboard/products/add';
            const method = 'POST';

            console.log('Enviando formulario a:', url);

            const response = await fetch(url, {
                method: method,
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            if (data.success) {
                showToast(data.message, 'success');
                const modal = document.getElementById('productModal');
                if (modal) {
                    const bootstrapModal = bootstrap.Modal.getInstance(modal);
                    if (bootstrapModal) bootstrapModal.hide();
                }
                setTimeout(() => location.reload(), 1200);
            } else {
                showToast(`Error: ${data.message}`, 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error al guardar el producto', 'danger');
        } finally {
            form.dataset.isSubmitting = 'false';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
            if (spinner) spinner.classList.add('d-none');
            if (btnText) btnText.textContent = 'Guardar Producto';
        }
    };

    // Guardar referencia a la función para poder removerla después
    const handlerName = 'productSubmitHandler_' + Date.now();
    window[handlerName] = submitHandler;
    form.dataset.submitHandler = handlerName;

    // Agregar el event listener
    form.addEventListener('submit', submitHandler);
}

// Validar formulario de producto
function validateProductForm() {
    const form = document.getElementById('productForm');
    if (!form) return false;
    
    const nombre = form.querySelector('#nombre')?.value.trim();
    const descripcion = form.querySelector('#descripcion')?.value.trim();
    const precio = form.querySelector('#precio')?.value;
    const categoria = form.querySelector('#categoria_id')?.value;
    
    if (!nombre) {
        showToast('Completa el nombre del producto', 'danger');
        form.querySelector('#nombre')?.focus();
        return false;
    }
    
    
    
    if (!precio || parseFloat(precio) <= 0) {
        showToast('Ingresa un precio válido', 'danger');
        form.querySelector('#precio')?.focus();
        return false;
    }
    
    if (!categoria) {
        showToast('Selecciona una categoría', 'danger');
        form.querySelector('#categoria_id')?.focus();
        return false;
    }
    
    return true;
}

// Evento para editar producto (vincular con botones)
$(document).ready(function() {
    console.log('📋 Configurando eventos de productos...');
    
    // Cambiar a delegación para soportar recarga dinámica
    $(document).on('click', '.edit-product', function() {
        const productId = $(this).data('id');
        editProduct(productId);
    });
    
    // Evento cuando se abre el modal
    $('#productModal').on('shown.bs.modal', function() {
        console.log('🎭 Modal abierto, configurando formulario...');
        setupProductForm();
    });
    
    // Limpiar formulario y preview al cerrar modal
    $('#productModal').on('hidden.bs.modal', function() {
        console.log('🔒 Modal cerrado, limpiando formulario...');
        $('#productForm')[0].reset();
        $('#productForm').removeData('product-id');
        $('#imagePreview').hide();
        $('#productModal .modal-title').text('Nuevo Producto');
        // Resetear el estado de envío
        const form = document.getElementById('productForm');
        if (form) {
            form.dataset.productId = '';
            form.dataset.configured = 'false'; // Permitir reconfiguración
        }
    });
});

// Refuerza el control para evitar dobles alertas al eliminar producto
$(document).off('click', '.delete-product').on('click', '.delete-product', function(e) {
    if (window.eliminandoProducto) return;
    window.eliminandoProducto = true;
    setTimeout(() => { window.eliminandoProducto = false; }, 1000); // Evita doble confirmación rápida
    const button = $(this);
    const productId = button.data('id');
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        button.prop('disabled', true);
        button.html('<i class="fas fa-spinner fa-spin"></i>');
        $.ajax({
            url: `/dashboard/products/${productId}`,
            type: 'DELETE',
            success: function(response) {
                if (response.success) {
                    alert('Producto eliminado exitosamente');
                    location.reload();
                } else {
                    alert('Error al eliminar el producto: ' + response.message);
                }
            },
            error: function(xhr, status, error) {
                alert('Error al eliminar el producto: ' + error);
            },
            complete: function() {
                button.prop('disabled', false);
                button.html('<i class="fas fa-trash"></i>');
            }
        });
    }
});

// Evento para cambiar disponibilidad
$(document).on('change', '.availability-toggle', function() {
    const $input = $(this);
    const productId = $input.data('id');
    const disponible = $input.is(':checked');
    $input.prop('disabled', true);
    $.ajax({
        url: `/dashboard/products/${productId}/availability`,
        type: 'PUT',
        data: { disponible: disponible },
        success: function(response) {
            if (!response.success) {
                alert('Error al actualizar la disponibilidad: ' + response.message);
                $input.prop('checked', !disponible);
            }
        },
        error: function(xhr, status, error) {
            alert('Error al actualizar la disponibilidad: ' + error);
            $input.prop('checked', !disponible);
        },
        complete: function() {
            $input.prop('disabled', false);
        }
    });
});
