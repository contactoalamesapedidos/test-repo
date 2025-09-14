document.addEventListener('DOMContentLoaded', function() {
    // Edición de datos de usuario
    const editUserBtn = document.getElementById('editUserBtn');
    const userDataForm = document.getElementById('userDataForm');
    const userEditActions = document.getElementById('userEditActions');
    const userInputs = userDataForm.querySelectorAll('input');
    const cancelUserEditBtn = document.getElementById('cancelUserEditBtn');
    let userOriginalValues = {};
    userInputs.forEach(input => { userOriginalValues[input.name] = input.value; });

    if(editUserBtn) {
        editUserBtn.addEventListener('click', function(e) {
            e.preventDefault();
            userDataForm.style.pointerEvents = 'auto';
            userDataForm.style.opacity = '1';
            userEditActions.style.display = 'flex';
            userInputs.forEach(input => { if(input.name !== 'edit_user') { input.readOnly = false; } });
            editUserBtn.style.display = 'none';
        });
    }

    if(cancelUserEditBtn) {
        cancelUserEditBtn.addEventListener('click', function() {
            userInputs.forEach(input => { input.value = userOriginalValues[input.name]; input.readOnly = true; });
            userDataForm.style.pointerEvents = 'none';
            userDataForm.style.opacity = '0.8';
            userEditActions.style.display = 'none';
            editUserBtn.style.display = 'inline-block';
        });
    }

    if(userDataForm) {
        const userSubmitBtn = userDataForm.querySelector('button[type="submit"]'); // Get submit button

        userDataForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Set loading state for button
            if (userSubmitBtn) {
                userSubmitBtn.disabled = true;
                // Add a class for visual loading indicator if needed, e.g., userSubmitBtn.classList.add('loading');
            }

            const formData = new FormData(userDataForm);
            fetch('/dashboard/settings', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                // Reset loading state for button
                if (userSubmitBtn) {
                    userSubmitBtn.disabled = false;
                    // Remove loading class if added, e.g., userSubmitBtn.classList.remove('loading');
                }

                if (data.success) {
                    // Update original values for cancel button functionality
                    if (data.updatedUser) {
                        userOriginalValues.user_nombre = data.updatedUser.nombre;
                        userOriginalValues.user_apellido = data.updatedUser.apellido;
                        userOriginalValues.user_email = data.updatedUser.email;
                        userOriginalValues.user_telefono = data.updatedUser.telefono;
                        userOriginalValues.user_ciudad = data.updatedUser.ciudad;
                        userOriginalValues.recibir_notificaciones = data.updatedUser.recibir_notificaciones;

                        userDataForm.querySelector('[name="user_nombre"]').value = data.updatedUser.nombre;
                        userDataForm.querySelector('[name="user_apellido"]').value = data.updatedUser.apellido;
                        userDataForm.querySelector('[name="user_email"]').value = data.updatedUser.email;
                        userDataForm.querySelector('[name="user_telefono"]').value = data.updatedUser.telefono;
                        userDataForm.querySelector('[name="user_ciudad"]').value = data.updatedUser.ciudad;
                        const recibirNotificacionesCheckbox = userDataForm.querySelector('[name="recibir_notificaciones"]');
                        if (recibirNotificacionesCheckbox) {
                            recibirNotificacionesCheckbox.checked = (data.updatedUser.recibir_notificaciones === 1);
                        }

                        const userDisplayName = document.getElementById('userDisplayName');
                        if (userDisplayName) {
                            userDisplayName.textContent = `${data.updatedUser.nombre} ${data.updatedUser.apellido}`;
                        }
                        const userDisplayEmail = document.getElementById('userDisplayEmail');
                        if (userDisplayEmail) {
                            userDisplayEmail.textContent = data.updatedUser.email;
                        }
                    }

                    // Ensure button not loading
                    if (userSubmitBtn) {
                        userSubmitBtn.disabled = false;
                        // userSubmitBtn.classList.remove('loading');
                    }
                    // Reload immediately to reflect new data globally
                    window.location.reload();

                } else {
                    alert(data.message || 'Error al guardar los datos');
                }
            })
            .catch(() => {
                showNotification('Error al guardar los datos', 'error');
            })
            .finally(() => {
                if (userSubmitBtn) userSubmitBtn.disabled = false;
            });
        });
    }

    // Edición de configuración restaurante
    const editRestBtn = document.getElementById('editRestBtn');
    const settingsForm = document.getElementById('settingsForm');
    const restEditActions = document.getElementById('restEditActions');
    const restInputs = settingsForm.querySelectorAll('input, textarea, select');
    const cancelRestEditBtn = document.getElementById('cancelRestEditBtn');
    let restOriginalValues = {};
    restInputs.forEach(input => { restOriginalValues[input.name] = input.value; });

    if(editRestBtn) {
        editRestBtn.addEventListener('click', function(e) {
            e.preventDefault();
            settingsForm.style.pointerEvents = 'auto';
            settingsForm.style.opacity = '1';
            restEditActions.style.display = 'flex';
            restInputs.forEach(input => {
                if(input.type !== 'hidden' && input.name !== 'edit_rest'){
                    input.readOnly = false;
                    input.disabled = false;
                }
            });
            document.getElementById('map').style.pointerEvents = 'auto';
            editRestBtn.style.display = 'none';
        });
    }

    if(cancelRestEditBtn) {
        cancelRestEditBtn.addEventListener('click', function() {
            restInputs.forEach(input => {
                input.value = restOriginalValues[input.name];
                input.readOnly = true;
                input.disabled = true;
            });
            settingsForm.style.pointerEvents = 'none';
            settingsForm.style.opacity = '0.8';
            restEditActions.style.display = 'none';
            editRestBtn.style.display = 'inline-block';
        });
    }

    if(settingsForm) {
        const restSubmitBtn = settingsForm.querySelector('button[type="submit"]'); // Get submit button

        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Set loading state for button
            if (restSubmitBtn) {
                restSubmitBtn.disabled = true;
                // Add a class for visual loading indicator if needed, e.g., restSubmitBtn.classList.add('loading');
            }

            restInputs.forEach(input => {
                if (input.type !== 'hidden' && input.name !== 'edit_rest') {
                    input.disabled = false;
                    input.readOnly = false;
                }
            });

            const formData = new FormData(settingsForm);
            fetch('/dashboard/settings', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                // Reset loading state for button
                if (restSubmitBtn) {
                    restSubmitBtn.disabled = false;
                    // Remove loading class if added, e.g., restSubmitBtn.classList.remove('loading');
                }

                if (data.success) {
                    // Ensure button not loading
                    if (restSubmitBtn) {
                        restSubmitBtn.disabled = false;
                        // restSubmitBtn.classList.remove('loading');
                    }
                    // Reload immediately for a crisp UX
                    window.location.reload();
                } else {
                    // Display validation errors
                    let errorMessage = data.message || 'Error al guardar la configuración del restaurante';
                    if (data.errors && data.errors.length > 0) {
                        errorMessage += '\n' + data.errors.join('\n');
                    }
                    showNotification(errorMessage, 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Error al guardar la configuración del restaurante. Por favor, inténtalo de nuevo.', 'error');
            })
            .finally(() => {
                if (restSubmitBtn) restSubmitBtn.disabled = false;
            });
        });
    }

    // Edición de datos de transferencia
    const editTransferBtn = document.getElementById('editTransferBtn');
    const transferForm = document.getElementById('transferForm');
    const transferEditActions = document.getElementById('transferEditActions');
    const transferInputs = transferForm.querySelectorAll('input');
    const cancelTransferEditBtn = document.getElementById('cancelTransferEditBtn');
    let transferOriginalValues = {};
    transferInputs.forEach(input => { transferOriginalValues[input.name] = input.value; });

    if(editTransferBtn) {
        editTransferBtn.addEventListener('click', function(e) {
            e.preventDefault();
            transferForm.style.pointerEvents = 'auto';
            transferForm.style.opacity = '1';
            transferEditActions.style.display = 'flex';
            transferInputs.forEach(input => {
                if(input.type !== 'hidden' && input.name !== 'edit_transfer'){
                    input.readOnly = false;
                }
            });
            editTransferBtn.style.display = 'none';
        });
    }

    if(cancelTransferEditBtn) {
        cancelTransferEditBtn.addEventListener('click', function() {
            transferInputs.forEach(input => { input.value = transferOriginalValues[input.name]; input.readOnly = true; });
            transferForm.style.pointerEvents = 'none';
            transferForm.style.opacity = '0.8';
            transferEditActions.style.display = 'none';
            editTransferBtn.style.display = 'inline-block';
        });
    }

    if(transferForm) {
        transferForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(transferForm);
            fetch('/dashboard/settings', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    window.location.reload();
                } else {
                    showNotification(data.message || 'Error al guardar los datos de transferencia', 'error');
                }
            })
            .catch(() => {
                showNotification('Error al guardar los datos de transferencia', 'error');
            })
            .finally(() => {
                // No submit button stored aquí; si lo agregas, re-actívalo en este finally
            });
        });
    }

    // Notificaciones Push
    const toggle = document.getElementById('togglePushNotifications');
    const status = document.getElementById('pushStatus');
    const hiddenPush = document.getElementById('hiddenRecibirNotificaciones');
    if (toggle) {
        // Inicializa el texto de estado
        if (status) status.textContent = toggle.checked ? 'Activadas' : 'Desactivadas';

        toggle.addEventListener('change', async () => {
            const isChecked = toggle.checked;

            // Si se está activando, solicitar permisos del navegador primero
            if (isChecked) {
                try {
                    console.log('=== ACTIVANDO NOTIFICACIONES PUSH ===');

                    // Verificar si el servicio de notificaciones push está disponible
                    if (!window.pushNotificationService) {
                        showNotification('El servicio de notificaciones push no está disponible.', 'error');
                        toggle.checked = false;
                        if (hiddenPush) hiddenPush.checked = false;
                        return;
                    }

                    console.log('🔧 Inicializando servicio de notificaciones push...');
                    const success = await window.pushNotificationService.initialize();
                    console.log('📊 Resultado de inicialización:', success);

                    if (!success) {
                        showNotification('No se pudo inicializar el servicio de notificaciones. Verifica que estés en una conexión segura (HTTPS).', 'warning');
                        toggle.checked = false;
                        if (hiddenPush) hiddenPush.checked = false;
                        return;
                    }

                    console.log('🔔 Solicitando permisos del navegador...');

                    // Verificar estado del permiso antes de solicitar
                    const permisoAntes = Notification.permission;
                    console.log('📋 Permiso antes de solicitar:', permisoAntes);

                    // Solicitar permisos del navegador
                    const permissionGranted = await window.pushNotificationService.requestPermission();
                    console.log('✅ Permiso concedido:', permissionGranted);

                    // Verificar estado del permiso después de solicitar
                    const permisoDespues = Notification.permission;
                    console.log('🔄 Permiso después de solicitar:', permisoDespues);

                    if (!permissionGranted || permisoDespues === 'denied') {
                        console.log('❌ Permiso denegado o revocado automáticamente');

                        // Determinar el tipo de error para dar mejores instrucciones
                        let errorMessage = 'Debes permitir las notificaciones en el navegador para recibir alertas push.';
                        if (permisoDespues === 'denied') {
                            errorMessage = 'El navegador denegó automáticamente el permiso. Revisa la configuración del sitio.';
                        }

                        showNotification(errorMessage, 'warning');
                        toggle.checked = false;
                        if (hiddenPush) hiddenPush.checked = false;
                        return;
                    }

                    // Verificar que la suscripción se haya creado correctamente
                    console.log('🔍 Verificando suscripción después de permisos...');
                    const hasSubscription = window.pushNotificationService.subscription !== null;
                    console.log('📨 Suscripción creada:', hasSubscription);

                    if (!hasSubscription) {
                        showNotification('Error al crear la suscripción push. El navegador puede estar bloqueando las notificaciones.', 'error');
                        toggle.checked = false;
                        if (hiddenPush) hiddenPush.checked = false;
                        return;
                    }

                    console.log('⏳ Esperando a que la suscripción se guarde en el servidor...');
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Verificar una vez más que todo esté bien
                    const finalCheck = window.pushNotificationService.isEnabled();
                    console.log('🎯 Verificación final:', finalCheck);

                    if (!finalCheck) {
                        showNotification('Las notificaciones se configuraron pero pueden no funcionar correctamente. Revisa la consola para más detalles.', 'warning');
                    }

                } catch (error) {
                    console.error('❌ Error al solicitar permisos de notificación:', error);
                    console.error('📋 Tipo de error:', error.name);
                    console.error('💬 Mensaje de error:', error.message);

                    // Dar instrucciones específicas según el tipo de error
                    let userMessage = 'Error al configurar las notificaciones push: ' + error.message;

                    if (error.message.includes('denied') || error.message.includes('NotAllowedError')) {
                        userMessage = 'El navegador bloqueó las notificaciones. Asegúrate de permitirlas en la configuración del sitio.';
                    } else if (error.message.includes('HTTPS')) {
                        userMessage = 'Las notificaciones push requieren HTTPS. Asegúrate de estar en una conexión segura.';
                    }

                    showNotification(userMessage, 'error');
                    toggle.checked = false;
                    if (hiddenPush) hiddenPush.checked = false;
                    return;
                }
            }

            // Refleja el valor en el input oculto del formulario de usuario
            if (hiddenPush) hiddenPush.checked = isChecked;

            // Construye y envía los datos mínimos requeridos para editar usuario
            if (userDataForm) {
                const formData = new FormData();
                formData.append('edit_user', '1');
                formData.append('user_nombre', userDataForm.querySelector('[name="user_nombre"]').value);
                formData.append('user_apellido', userDataForm.querySelector('[name="user_apellido"]').value);
                formData.append('user_email', userDataForm.querySelector('[name="user_email"]').value);
                formData.append('user_telefono', userDataForm.querySelector('[name="user_telefono"]').value || '');
                formData.append('user_ciudad', userDataForm.querySelector('[name="user_ciudad"]').value || '');
                if (isChecked) {
                    formData.append('recibir_notificaciones', 'on');
                }

                fetch('/dashboard/settings', {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    body: formData
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        if (status) status.textContent = isChecked ? 'Activadas' : 'Desactivadas';
                        showNotification(isChecked ?
                            'Notificaciones push activadas exitosamente. Recibirás alertas de nuevos pedidos.' :
                            'Notificaciones push desactivadas.',
                            'success'
                        );
                        // Recargar para actualizar el estado global
                        setTimeout(() => window.location.reload(), 1000);
                    } else {
                        // Si falla, revertir el toggle y mostrar error
                        toggle.checked = !isChecked;
                        if (hiddenPush) hiddenPush.checked = !isChecked;
                        showNotification(data.message || 'No se pudo actualizar la preferencia de notificaciones', 'error');
                    }
                })
                .catch(() => {
                    toggle.checked = !isChecked;
                    if (hiddenPush) hiddenPush.checked = !isChecked;
                    showNotification('Error de red al actualizar notificaciones', 'error');
                });
            }
        });
    }

    // Notificaciones por Email de nuevos pedidos
    const emailToggle = document.getElementById('toggleEmailNewOrders');
    const emailStatus = document.getElementById('emailStatus');
    const hiddenEmailNew = document.getElementById('hiddenEmailNotifNuevoPedido');
    if (emailToggle) {
        // Inicializa el texto de estado
        if (emailStatus) emailStatus.textContent = emailToggle.checked ? 'Activadas' : 'Desactivadas';

        emailToggle.addEventListener('change', () => {
            // Refleja el valor en el input oculto del formulario de usuario
            if (hiddenEmailNew) hiddenEmailNew.checked = emailToggle.checked;

            // Construye y envía los datos mínimos requeridos para editar usuario
            if (userDataForm) {
                const formData = new FormData();
                formData.append('edit_user', '1');
                formData.append('user_nombre', userDataForm.querySelector('[name="user_nombre"]').value);
                formData.append('user_apellido', userDataForm.querySelector('[name="user_apellido"]').value);
                formData.append('user_email', userDataForm.querySelector('[name="user_email"]').value);
                formData.append('user_telefono', userDataForm.querySelector('[name="user_telefono"]').value || '');
                formData.append('user_ciudad', userDataForm.querySelector('[name="user_ciudad"]').value || '');
                if (hiddenPush && hiddenPush.checked) {
                    formData.append('recibir_notificaciones', 'on');
                }
                if (emailToggle.checked) {
                    formData.append('email_notif_nuevo_pedido', 'on');
                }

                fetch('/dashboard/settings', {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    body: formData
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        if (emailStatus) emailStatus.textContent = data.updatedUser.email_notif_nuevo_pedido === 1 ? 'Activadas' : 'Desactivadas';
                        emailToggle.checked = data.updatedUser.email_notif_nuevo_pedido === 1;
                        if (hiddenEmailNew) hiddenEmailNew.checked = data.updatedUser.email_notif_nuevo_pedido === 1;
                        showNotification('Preferencia de emails actualizada exitosamente', 'success');
                    } else {
                        // Si falla, revertir el toggle y mostrar error
                        emailToggle.checked = !emailToggle.checked;
                        if (hiddenEmailNew) hiddenEmailNew.checked = emailToggle.checked;
                        showNotification(data.message || 'No se pudo actualizar la preferencia de emails', 'error');
                    }
                })
                .catch(() => {
                    emailToggle.checked = !emailToggle.checked;
                    if (hiddenEmailNew) hiddenEmailNew.checked = emailToggle.checked;
                    showNotification('Error de red al actualizar preferencia de emails', 'error');
                });
            }
        });
    }
    // Descuento en Efectivo/Transferencia
    const discountToggle = document.getElementById('toggleDiscount');
    if (discountToggle) {
        discountToggle.addEventListener('change', () => {
            const ofreceDescuento = discountToggle.checked;

            fetch('/dashboard/settings/discount', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    ofrece_descuento_efectivo: ofreceDescuento ? 1 : 0
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message, 'success');
                } else {
                    discountToggle.checked = !ofreceDescuento; // Revert on failure
                    showNotification(data.message || 'Error al actualizar la configuración de descuento.', 'error');
                }
            })
            .catch(() => {
                discountToggle.checked = !ofreceDescuento; // Revert on failure
                showNotification('Error de red al actualizar la configuración de descuento.', 'error');
            });
        });
    }

    // Map Initialization
    const mapElement = document.getElementById('map');
    if (mapElement) {
        const latInput = document.getElementById('latitud');
        const lngInput = document.getElementById('longitud');
        const restaurantAddress = document.getElementById('direccion').value;

        let initialLat = parseFloat(latInput.value);
        let initialLng = parseFloat(lngInput.value);

        // Default to a central location if no coordinates are saved
        if (isNaN(initialLat) || isNaN(initialLng)) {
            initialLat = -34.6037; // Buenos Aires latitude
            initialLng = -58.3816; // Buenos Aires longitude
        }

        const map = L.map('map').setView([initialLat, initialLng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

        // Add drag event to update coordinates
        marker.on('dragend', function(event) {
            const position = marker.getLatLng();
            latInput.value = position.lat;
            lngInput.value = position.lng;
            showNotification('Ubicación del marcador actualizada.', 'info');
        });

        // Update hidden inputs on map moveend
        map.on('moveend', function() {
            const center = map.getCenter();
            latInput.value = center.lat;
            lngInput.value = center.lng;
        });

        // Geocode address if no coordinates are set
        if (isNaN(parseFloat(latInput.value)) || isNaN(parseFloat(lngInput.value))) {
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(restaurantAddress)}&format=json&limit=1`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const result = data[0];
                        const newLat = parseFloat(result.lat);
                        const newLng = parseFloat(result.lon);

                        map.setView([newLat, newLng], 16);
                        marker.setLatLng([newLat, newLng]);
                        latInput.value = newLat;
                        lngInput.value = newLng;
                    } else {
                        console.warn('No se encontraron coordenadas para la dirección:', restaurantAddress);
                    }
                })
                .catch(error => {
                    console.error('Error geocodificando la dirección:', error);
                });
        }

        // Get Current Location Button Logic
        const getCurrentLocationBtn = document.getElementById('getCurrentLocationBtn');
        if (getCurrentLocationBtn) {
            getCurrentLocationBtn.addEventListener('click', function() {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function(position) {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;

                        map.setView([lat, lng], 16); // Set map view to current location
                        marker.setLatLng([lat, lng]);
                        latInput.value = lat;
                        lngInput.value = lng;
                        showNotification('Ubicación actual obtenida.', 'success');
                    }, function(error) {
                        console.error('Error getting current location:', error);
                        let errorMessage = 'No se pudo obtener la ubicación actual.';
                        if (error.code === error.PERMISSION_DENIED) {
                            errorMessage += ' Permiso denegado. Por favor, habilita los servicios de ubicación.';
                        } else if (error.code === error.POSITION_UNAVAILABLE) {
                            errorMessage += ' Información de ubicación no disponible.';
                        } else if (error.code === error.TIMEOUT) {
                            errorMessage += ' La solicitud para obtener la ubicación ha caducado.';
                        }
                        showNotification(errorMessage, 'error');
                    });
                } else {
                    showNotification('Tu navegador no soporta la geolocalización.', 'error');
                }
            });
        }
    }
});

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
  const toast = document.createElement('div');

  // Para errores en PC, usar texto negro en lugar de blanco
  const isErrorOnDesktop = type === 'error' && window.innerWidth > 768;
  const textColorClass = isErrorOnDesktop ? 'text-dark' : 'text-white';
  const closeBtnClass = isErrorOnDesktop ? 'btn-close' : 'btn-close-white';

  toast.className = `toast align-items-center ${textColorClass} bg-${type} border-0 position-fixed bottom-0 end-0 m-3`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  toast.innerHTML = `
      <div class="d-flex">
          <div class="toast-body">
              ${message}
          </div>
          <button type="button" class="${closeBtnClass} me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
  `;

  document.body.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();

  toast.addEventListener('hidden.bs.toast', () => {
      document.body.removeChild(toast);
  });
}
