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

        toggle.addEventListener('change', () => {
            // Refleja el valor en el input oculto del formulario de usuario
            if (hiddenPush) hiddenPush.checked = toggle.checked;

            // Construye y envía los datos mínimos requeridos para editar usuario
            if (userDataForm) {
                const formData = new FormData();
                formData.append('edit_user', '1');
                formData.append('user_nombre', userDataForm.querySelector('[name="user_nombre"]').value);
                formData.append('user_apellido', userDataForm.querySelector('[name="user_apellido"]').value);
                formData.append('user_email', userDataForm.querySelector('[name="user_email"]').value);
                formData.append('user_telefono', userDataForm.querySelector('[name="user_telefono"]').value || '');
                formData.append('user_ciudad', userDataForm.querySelector('[name="user_ciudad"]').value || '');
                if (toggle.checked) {
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
                        if (status) status.textContent = toggle.checked ? 'Activadas' : 'Desactivadas';
                        window.location.reload();
                    } else {
                        // Si falla, revertir el toggle y mostrar error
                        toggle.checked = !toggle.checked;
                        if (hiddenPush) hiddenPush.checked = toggle.checked;
                        showNotification(data.message || 'No se pudo actualizar la preferencia de notificaciones', 'error');
                    }
                })
                .catch(() => {
                    toggle.checked = !toggle.checked;
                    if (hiddenPush) hiddenPush.checked = toggle.checked;
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
});

// Función para mostrar notificaciones
function showNotification(message, type = 'success') {
    // ... (show notification logic)
}
