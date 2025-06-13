// Funciones para el manejo de la configuración del restaurante
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('settingsForm');
    const logoInput = document.getElementById('logo');
    const logoPreview = document.getElementById('logoPreview');
    const currentLogo = document.getElementById('currentLogo');
    const bannerInput = document.getElementById('banner');
    const bannerPreview = document.getElementById('bannerPreview');
    const currentBanner = document.getElementById('currentBanner');
    const deliveryCheckbox = document.getElementById('delivery');
    const costoDeliveryContainer = document.getElementById('costoDeliveryContainer');
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Estado del formulario
    let isSubmitting = false;
    let submitTimeout = null;
    
    // Función para mostrar notificaciones
    function showNotification(message, type = 'error') {
        console.log('Mostrando notificación:', { message, type });
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        const container = document.createElement('div');
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.appendChild(toast);
        document.body.appendChild(container);
        
        const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => container.remove());
    }
    
    // Función para restaurar el botón
    function restoreButton() {
        if (submitTimeout) {
            clearTimeout(submitTimeout);
            submitTimeout = null;
        }
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Cambios';
    }
    
    // Función para procesar el formulario
    function handleSubmit(e) {
        e.preventDefault();
        
        // Evitar múltiples envíos
        if (isSubmitting) return;
        
        // Obtener días de operación
        const diasOperacion = Array.from(
            document.querySelectorAll('input[name="dias_operacion[]"]:checked')
        ).map(cb => parseInt(cb.value));
        console.log('Días de operación seleccionados:', diasOperacion);

        if (diasOperacion.length === 0) {
            showNotification('Debes seleccionar al menos un día de operación');
            return;
        }

        // Crear FormData
        const formData = new FormData(form);
        
        // Eliminar los checkboxes originales
        formData.delete('dias_operacion[]');
        
        // Agregar los días como un string JSON
        formData.append('dias_operacion', JSON.stringify(diasOperacion));

        // Log de datos a enviar
        const formDataObj = {};
        for (let [key, value] of formData.entries()) {
            formDataObj[key] = value;
        }
        console.log('Datos a enviar:', formDataObj);

        // Actualizar estado del botón
        isSubmitting = true;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';

        // Timeout de seguridad (5 segundos)
        submitTimeout = setTimeout(() => {
            console.error('Timeout al guardar la configuración');
            restoreButton();
            showNotification('La operación tomó demasiado tiempo. Por favor, intenta nuevamente.');
        }, 5000);

        // Enviar usando fetch con manejo de errores mejorado
        fetch('/dashboard/settings', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin' // Asegurar que se envían las cookies
        })
        .then(response => {
            console.log('Respuesta recibida:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            return response.json();
        })
        .then(data => {
            console.log('Datos de respuesta:', data);
            if (data.success) {
                showNotification('Configuración actualizada correctamente', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(data.error || 'Error al actualizar la configuración');
            }
        })
        .catch(error => {
            console.error('Error en la petición:', error);
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                showNotification('Error de conexión. Por favor, verifica tu conexión a internet.');
            } else {
                showNotification(error.message || 'Error al actualizar la configuración');
            }
        })
        .finally(() => {
            console.log('Finalizando envío del formulario...');
            restoreButton();
        });
    }
    
    // Manejar visibilidad del costo de envío
    if (deliveryCheckbox && costoDeliveryContainer) {
        deliveryCheckbox.addEventListener('change', function() {
            costoDeliveryContainer.style.display = this.checked ? 'block' : 'none';
            if (!this.checked) {
                document.getElementById('costo_delivery').value = '0.00';
            }
        });
    }
    
    // Preview de logo
    logoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Validar tipo de archivo
            if (!file.type.startsWith('image/')) {
                showNotification('El archivo debe ser una imagen válida');
                logoInput.value = '';
                return;
            }
            
            // Validar tamaño (5MB)
            if (file.size > 5 * 1024 * 1024) {
                showNotification('La imagen no debe superar los 5MB');
                logoInput.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                logoPreview.src = e.target.result;
                logoPreview.classList.remove('d-none');
                if (currentLogo) {
                    currentLogo.classList.add('d-none');
                }
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Preview de banner
    bannerInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Validar tipo de archivo
            if (!file.type.startsWith('image/')) {
                showNotification('El archivo debe ser una imagen válida');
                bannerInput.value = '';
                return;
            }
            
            // Validar tamaño (5MB)
            if (file.size > 5 * 1024 * 1024) {
                showNotification('La imagen no debe superar los 5MB');
                bannerInput.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                bannerPreview.src = e.target.result;
                bannerPreview.classList.remove('d-none');
                if (currentBanner) {
                    currentBanner.classList.add('d-none');
                }
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Función para validar las imágenes
    function validateImages() {
        const logoInput = document.getElementById('logo');
        const bannerInput = document.getElementById('banner');
        
        // Validar logo si se seleccionó uno
        if (logoInput.files.length > 0) {
            const logoFile = logoInput.files[0];
            
            // Validar tipo de archivo
            if (!logoFile.type.startsWith('image/')) {
                showNotification('El archivo de logo debe ser una imagen válida');
                return false;
            }
            
            // Validar tamaño (5MB)
            if (logoFile.size > 5 * 1024 * 1024) {
                showNotification('La imagen del logo no debe superar los 5MB');
                return false;
            }
        }
        
        // Validar banner si se seleccionó uno
        if (bannerInput.files.length > 0) {
            const bannerFile = bannerInput.files[0];
            
            // Validar tipo de archivo
            if (!bannerFile.type.startsWith('image/')) {
                showNotification('El archivo de banner debe ser una imagen válida');
                return false;
            }
            
            // Validar tamaño (5MB)
            if (bannerFile.size > 5 * 1024 * 1024) {
                showNotification('La imagen del banner no debe superar los 5MB');
                return false;
            }
        }
        
        return true;
    }
    
    // Función para validar y formatear horarios
    function validateAndFormatTime(time) {
        if (!time) return null;
        
        // Si es un objeto Date, convertirlo a string HH:MM
        if (time instanceof Date) {
            return time.toTimeString().slice(0, 5);
        }
        
        // Si ya es un string, asegurarse que tenga el formato HH:MM
        if (typeof time === 'string') {
            // Remover cualquier caracter que no sea número o :
            time = time.replace(/[^\d:]/g, '');
            
            // Si no tiene el formato HH:MM, intentar formatearlo
            if (!/^\d{2}:\d{2}$/.test(time)) {
                const [hours, minutes] = time.split(':').map(Number);
                if (!isNaN(hours) && !isNaN(minutes)) {
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                }
            } else {
                return time;
            }
        }
        
        return null;
    }

    // Configurar el formulario
    console.log('Configurando manejador del formulario...');
    form.addEventListener('submit', handleSubmit);

    // Manejar la navegación fuera de la página
    window.addEventListener('beforeunload', () => {
        if (submitTimeout) {
            clearTimeout(submitTimeout);
        }
    });

    // Agregar listener para los checkboxes de días de operación
    document.querySelectorAll('input[name="dias_operacion[]"]:checked').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            console.log('Checkbox cambiado:', {
                id: this.id,
                value: this.value,
                checked: this.checked
            });
        });
    });

    // Preview de imágenes
    function setupImagePreview(inputId, previewId, currentImageId) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const currentImage = document.getElementById(currentImageId);

        if (input && preview) {
            input.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    if (!file.type.startsWith('image/')) {
                        showNotification('El archivo debe ser una imagen válida');
                        input.value = '';
                        return;
                    }
                    
                    if (file.size > 5 * 1024 * 1024) {
                        showNotification('La imagen no debe superar los 5MB');
                        input.value = '';
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        preview.src = e.target.result;
                        preview.classList.remove('d-none');
                        if (currentImage) {
                            currentImage.classList.add('d-none');
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    // Configurar previews de imágenes
    setupImagePreview('logo', 'logoPreview', 'currentLogo');
    setupImagePreview('banner', 'bannerPreview', 'currentBanner');

    // Verificar que el formulario está correctamente configurado
    console.log('Estado inicial del formulario:', {
        formId: form.id,
        submitButton: submitButton ? 'presente' : 'ausente',
        deliveryCheckbox: deliveryCheckbox ? 'presente' : 'ausente',
        costoDeliveryContainer: costoDeliveryContainer ? 'presente' : 'ausente'
    });
});