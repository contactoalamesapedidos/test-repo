function initializeChatListeners(orderId, userId, userType, chatContainer = document) {
    const socket = io();

    if (!chatContainer) {
        console.error("Error: chatContainer es undefined o null.", { chatContainer });
        return;
    }

    // Try to find chat elements using different selectors for flexibility
    const chatWindow = chatContainer.querySelector('.chat-window') || chatContainer.querySelector('#chat-messages');
    const messageInput = chatContainer.querySelector('#chat-message-input');
    const sendButton = chatContainer.querySelector('#send-chat-message-btn') || chatContainer.querySelector('#chat-form button[type="submit"]');

    console.log("DEBUG: Elementos del chat encontrados:", {
        chatWindow: chatWindow,
        messageInput: messageInput,
        sendButton: sendButton
    });

    if (!chatWindow || !messageInput || !sendButton) {
        console.error("Error: Elementos del chat no encontrados dentro del contenedor proporcionado.", { chatWindow, messageInput, sendButton, chatContainer });
        return;
    }

    socket.emit('join-order-chat', { orderId, userId, userType });
    console.log(`DEBUG: Emitido 'join-order-chat' para pedido ${orderId}, usuario ${userId} (${userType})`);

    // Timeout para la carga inicial del historial
    let historyTimeout = setTimeout(() => {
        console.warn('DEBUG: Timeout esperando historial de chat');
        const loadingElement = chatWindow.querySelector('#loading-messages');
        if (loadingElement) {
            loadingElement.innerHTML = `
                <i class="fas fa-exclamation-triangle fa-2x text-warning mb-3"></i>
                <p>No se pudo cargar el historial de mensajes.<br>Intenta recargar la página.</p>
            `;
        }
    }, 10000); // 10 segundos timeout

    socket.on('chat-history', (data) => {
        clearTimeout(historyTimeout); // Limpiar timeout si llega la respuesta
        console.log("DEBUG: Historial de chat recibido:", data);

        // Ocultar el indicador de carga
        const loadingElement = chatWindow.querySelector('#loading-messages');
        if (loadingElement) {
            loadingElement.remove();
        }

        if (data.error) {
            console.error('Error al cargar historial:', data.message);
            chatWindow.innerHTML = `<p class="text-danger text-center">Error al cargar el historial de mensajes: ${data.message}</p>`;
            return;
        }

        chatWindow.innerHTML = ''; // Limpiar mensajes existentes

        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
                displayMessage(msg);
            });
        } else {
            // Mostrar mensaje cuando no hay mensajes
            chatWindow.innerHTML = '<p class="text-center text-muted py-5">Aún no hay mensajes en este chat.<br>¡Sé el primero en escribir!</p>';
        }

        // Scroll al final con un pequeño retraso para asegurar que el DOM se ha actualizado
        requestAnimationFrame(() => {
            setTimeout(() => {
                chatWindow.scrollTop = chatWindow.scrollHeight;
                console.log("DEBUG: Scroll realizado a:", chatWindow.scrollHeight);
            }, 50);
        });
    });

    socket.on('chat-message', (data) => {
        console.log('DEBUG: Mensaje recibido en cliente:', data);
        if (data.orderId === orderId) {
            displayMessage(data.message);
            // Scroll al final con un pequeño retraso
            setTimeout(() => {
                chatWindow.scrollTop = chatWindow.scrollHeight;
                console.log("DEBUG: Scroll realizado después de nuevo mensaje a:", chatWindow.scrollHeight);
            }, 50);
        }
    });

    socket.on('chat-error', (data) => {
        console.error('DEBUG: Error de chat recibido:', data);
        if (data.orderId === orderId) {
            const errorDiv = document.createElement('div');
            errorDiv.classList.add('alert', 'alert-danger', 'mt-2');
            errorDiv.textContent = `Error: ${data.message}`;
            chatWindow.appendChild(errorDiv);
            setTimeout(() => {
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }, 50);
        }
    });

    sendButton.addEventListener('click', (e) => {
        e.preventDefault(); // Prevenir el comportamiento por defecto del botón
        console.log("DEBUG: Botón 'Enviar' clickeado.");
        sendMessage();
    });
    console.log("DEBUG: Event listener 'click' adjuntado a sendButton.");

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevenir el comportamiento por defecto de la tecla Enter en un input
            console.log("DEBUG: Tecla 'Enter' presionada en messageInput.");
            sendMessage();
        }
    });
    console.log("DEBUG: Event listener 'keypress' adjuntado a messageInput.");

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            // Mostrar estado de carga
            const originalText = sendButton.innerHTML;
            sendButton.disabled = true;
            sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            messageInput.disabled = true;

            console.log('DEBUG: Datos a enviar en socket.emit:', { orderId, userId, userType, message });

            // Configurar timeout para restaurar estado si no hay respuesta
            const timeoutId = setTimeout(() => {
                console.warn('DEBUG: Timeout alcanzado, restaurando estado del botón');
                restoreButtonState(originalText);
            }, 10000); // 10 segundos timeout

            socket.emit('send-chat-message', { orderId, userId, userType, message });

            // Limpiar el input inmediatamente
            messageInput.value = '';

            // Escuchar confirmación de envío exitoso
            socket.once('message-sent', (data) => {
                clearTimeout(timeoutId);
                console.log('DEBUG: Mensaje enviado exitosamente:', data);
                restoreButtonState(originalText);
            });

            // Escuchar errores de envío
            socket.once('message-error', (data) => {
                clearTimeout(timeoutId);
                console.error('DEBUG: Error al enviar mensaje:', data);
                restoreButtonState(originalText);
                // Mostrar mensaje de error al usuario
                const errorDiv = document.createElement('div');
                errorDiv.classList.add('alert', 'alert-danger', 'mt-2');
                errorDiv.textContent = `Error al enviar mensaje: ${data.message || 'Error desconocido'}`;
                chatWindow.appendChild(errorDiv);
                setTimeout(() => {
                    chatWindow.scrollTop = chatWindow.scrollHeight;
                }, 50);
                // Remover mensaje de error después de 5 segundos
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.remove();
                    }
                }, 5000);
            });

        } else {
            console.log("DEBUG: Intento de enviar mensaje vacío.");
        }
    }

    function restoreButtonState(originalText) {
        sendButton.disabled = false;
        sendButton.innerHTML = originalText;
        messageInput.disabled = false;
        messageInput.focus(); // Volver a enfocar el input
    }

    function displayMessage(msg) {
        console.log('DEBUG: Mostrando mensaje:', msg);
        console.log('DEBUG: msg.remitente_tipo:', msg.remitente_tipo);
        console.log('DEBUG: userType:', userType);
        console.log('DEBUG: Comparación (msg.remitente_tipo === userType):', msg.remitente_tipo === userType);

        const messageElement = document.createElement('div');
        // Usar las clases 'sent' y 'received' que ya tienen estilos en dashboard-orders.css
        // 'sent' para el usuario actual (restaurante), 'received' para el otro (cliente).
        messageElement.classList.add('message', msg.remitente_tipo === userType ? 'sent' : 'received');
        
        const senderName = msg.remitente_nombre || msg.remitente_tipo; // Fallback
        const timestamp = new Date(msg.fecha_envio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageElement.innerHTML = `
            <div class="message-content">
                <p class="message-text"><strong>${senderName}:</strong> ${msg.mensaje}</p>
                <span class="message-time">${timestamp}</span>
            </div>
        `;
        chatWindow.appendChild(messageElement);
    }
}
