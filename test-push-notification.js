// Script de prueba para notificaciones push - A la Mesa
// Ejecutar en la consola del navegador

console.log('🧪 === PRUEBA DE NOTIFICACIONES PUSH ===');

// Función para verificar el estado del Service Worker
async function checkServiceWorker() {
    console.log('🔧 Verificando Service Worker...');

    if (!('serviceWorker' in navigator)) {
        console.error('❌ Service Worker no soportado');
        return false;
    }

    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('📋 Registros encontrados:', registrations.length);

        for (const reg of registrations) {
            console.log('🔧 SW registrado:', {
                scope: reg.scope,
                activo: !!reg.active,
                instalando: !!reg.installing,
                esperando: !!reg.waiting,
                url: reg.active ? reg.active.scriptURL : 'N/A'
            });
        }

        // Intentar registrar uno nuevo para verificar si funciona
        console.log('🔄 Intentando registrar Service Worker de prueba...');
        try {
            const testRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            console.log('✅ Registro de prueba exitoso:', testRegistration.scope);
            return true;
        } catch (regError) {
            console.error('❌ Error en registro de prueba:', regError);
            console.error('📋 Tipo de error:', regError.name);
            console.error('💬 Mensaje:', regError.message);

            // Posibles causas del error
            if (regError.name === 'SecurityError') {
                console.error('🔒 CAUSA: Error de seguridad - verifica HTTPS');
            } else if (regError.name === 'NotAllowedError') {
                console.error('🚫 CAUSA: Permiso denegado - navegador bloqueó el registro');
            } else if (regError.name === 'AbortError') {
                console.error('⏹️ CAUSA: Registro abortado - posible conflicto con SW existente');
            }

            return false;
        }
    } catch (error) {
        console.error('❌ Error verificando SW:', error);
        return false;
    }
}

// Función para verificar permisos
function checkPermissions() {
    console.log('🔔 Verificando permisos...');

    if (!('Notification' in window)) {
        console.error('❌ Notificaciones no soportadas');
        return false;
    }

    const permission = Notification.permission;
    console.log('📋 Estado del permiso:', permission);

    return permission === 'granted';
}

// Función para verificar suscripciones push
async function checkPushSubscription() {
    console.log('📨 Verificando suscripción push...');

    if (!('serviceWorker' in navigator)) {
        console.error('❌ Service Worker no disponible');
        return false;
    }

    try {
        const registrations = await navigator.serviceWorker.getRegistrations();

        if (registrations.length === 0) {
            console.error('❌ No hay Service Workers registrados');
            return false;
        }

        const reg = registrations[0];
        const subscription = await reg.pushManager.getSubscription();

        if (subscription) {
            console.log('✅ Suscripción encontrada:', {
                endpoint: subscription.endpoint.substring(0, 50) + '...',
                expirationTime: subscription.expirationTime
            });
            return true;
        } else {
            console.log('⚠️ No hay suscripción push activa');
            return false;
        }
    } catch (error) {
        console.error('❌ Error verificando suscripción:', error);
        return false;
    }
}

// Función para probar envío desde el servidor
async function testServerNotification(userId) {
    console.log('📤 Probando envío desde servidor...');

    if (!userId) {
        // Intentar obtener el userId de la página
        const userScript = document.querySelector('script[data-user]');
        if (userScript) {
            try {
                const userData = JSON.parse(userScript.textContent);
                userId = userData.id;
                console.log('👤 UserId obtenido de la página:', userId);
            } catch (e) {
                console.error('❌ Error obteniendo userId de la página');
            }
        }
    }

    if (!userId) {
        console.error('❌ No se pudo obtener userId. Proporciona uno manualmente: testServerNotification(123)');
        return;
    }

    try {
        const response = await fetch('/api/push/debug-send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                title: '🧪 Prueba desde Consola',
                body: `Test realizado a las ${new Date().toLocaleTimeString()}`,
                url: '/dashboard/orders'
            })
        });

        const result = await response.json();
        console.log('📋 Respuesta del servidor:', result);

        if (result.success) {
            console.log('✅ Notificación enviada exitosamente');
            console.log('⏳ Espera 5-10 segundos para que llegue la notificación...');
        } else {
            console.error('❌ Falló el envío:', result.message);
            if (result.debug) {
                console.log('🔧 Información de debug:', result.debug);
            }
        }

        return result;
    } catch (error) {
        console.error('❌ Error en la petición:', error);
        return { success: false, error: error.message };
    }
}

// Función para verificar suscripciones en la base de datos
async function checkDatabaseSubscriptions(userId) {
    console.log('🗄️ Verificando suscripciones en base de datos...');

    if (!userId) {
        // Intentar obtener el userId de la página
        const userScript = document.querySelector('script[data-user]');
        if (userScript) {
            try {
                const userData = JSON.parse(userScript.textContent);
                userId = userData.id;
                console.log('👤 UserId obtenido de la página:', userId);
            } catch (e) {
                console.error('❌ Error obteniendo userId de la página');
            }
        }
    }

    if (!userId) {
        console.error('❌ No se pudo obtener userId. Proporciona uno manualmente: checkDatabaseSubscriptions(123)');
        return;
    }

    try {
        const response = await fetch(`/api/push/debug-user/${userId}`);
        const result = await response.json();

        console.log('📋 Estado del usuario en BD:', result);

        if (result.success) {
            console.log('✅ Usuario encontrado');
            console.log('📊 Suscripciones activas:', result.subscriptionCount);
            console.log('🔔 Preferencia de notificaciones:', result.hasPushPreference ? 'Activada' : 'Desactivada');
            console.log('🏪 Restaurantes:', result.restaurantCount);

            if (result.subscriptions.length > 0) {
                console.log('📋 Detalles de suscripciones:');
                result.subscriptions.forEach((sub, index) => {
                    console.log(`  ${index + 1}. ID: ${sub.id}, Tipo: ${sub.tipo_usuario}, Fecha: ${sub.fecha_creacion}`);
                });
            }
        } else {
            console.error('❌ Error consultando BD:', result.message);
        }

        return result;
    } catch (error) {
        console.error('❌ Error consultando BD:', error);
        return { success: false, error: error.message };
    }
}

// Función para verificar todas las suscripciones
async function checkAllSubscriptions() {
    console.log('📊 Verificando todas las suscripciones en el sistema...');

    try {
        const response = await fetch('/api/push/debug-subscriptions');
        const result = await response.json();

        console.log('📋 Respuesta del servidor:', result);

        if (result.success) {
            console.log('✅ Consulta exitosa');
            console.log('📊 Total de suscripciones:', result.totalSubscriptions);
            console.log('👥 Usuarios con push activado:', result.totalUsersWithPush);

            if (result.subscriptions.length > 0) {
                console.log('📋 Últimas suscripciones:');
                result.subscriptions.slice(0, 5).forEach((sub, index) => {
                    console.log(`  ${index + 1}. Usuario: ${sub.nombre} ${sub.apellido} (${sub.usuario_id}), Tipo: ${sub.tipo_usuario}, Fecha: ${sub.fecha_creacion}`);
                });
            }

            if (result.usersWithPushEnabled.length > 0) {
                console.log('🔔 Usuarios con preferencia activada:');
                result.usersWithPushEnabled.slice(0, 5).forEach((user, index) => {
                    console.log(`  ${index + 1}. ${user.nombre} ${user.apellido} (${user.email})`);
                });
            }
        } else {
            console.error('❌ Error en consulta:', result.message);
        }

        return result;
    } catch (error) {
        console.error('❌ Error en petición:', error);
        return { success: false, error: error.message };
    }
}

// Función para verificar configuración VAPID
async function checkVapidConfig() {
    console.log('🔑 Verificando configuración VAPID...');

    try {
        const response = await fetch('/api/push/vapid-public-key');
        const vapidKey = await response.text();

        console.log('📋 Clave VAPID pública:', vapidKey ? '✅ Configurada' : '❌ No configurada');
        console.log('🔗 Longitud:', vapidKey.length);

        return vapidKey.length > 0;
    } catch (error) {
        console.error('❌ Error obteniendo clave VAPID:', error);
        return false;
    }
}

// Función principal de diagnóstico
async function diagnosePushNotifications(userId) {
    console.log('🔍 === DIAGNÓSTICO COMPLETO ===');

    const results = {
        serviceWorker: await checkServiceWorker(),
        permissions: checkPermissions(),
        pushSubscription: await checkPushSubscription(),
        vapidConfig: await checkVapidConfig()
    };

    console.log('📊 Resultados del diagnóstico:');
    console.log('🔧 Service Worker:', results.serviceWorker ? '✅ OK' : '❌ FALLÓ');
    console.log('🔔 Permisos:', results.permissions ? '✅ OK' : '❌ FALLÓ');
    console.log('📨 Suscripción Push:', results.pushSubscription ? '✅ OK' : '❌ FALLÓ');
    console.log('🔑 VAPID:', results.vapidConfig ? '✅ OK' : '❌ FALLÓ');

    const allOk = Object.values(results).every(result => result === true);

    if (allOk) {
        console.log('🎉 ¡Todo parece estar configurado correctamente!');
        console.log('💡 Si aún no llegan las notificaciones, prueba: testServerNotification()');
    } else {
        console.log('⚠️ Hay problemas de configuración. Revisa los resultados arriba.');
    }

    return results;
}

// Función para probar notificación local (sin servidor)
function testLocalNotification() {
    console.log('🏠 Probando notificación local...');

    if (!('Notification' in window)) {
        console.error('❌ Notificaciones no soportadas');
        return;
    }

    if (Notification.permission !== 'granted') {
        console.error('❌ Permiso no concedido');
        return;
    }

    try {
        const notification = new Notification('🧪 Prueba Local', {
            body: `Test local a las ${new Date().toLocaleTimeString()}`,
            icon: '/images/logo-a-la-mesa.png',
            badge: '/images/logo-a-la-mesa.png'
        });

        console.log('✅ Notificación local creada');

        // Cerrar automáticamente después de 3 segundos
        setTimeout(() => {
            notification.close();
            console.log('🗑️ Notificación local cerrada');
        }, 3000);

    } catch (error) {
        console.error('❌ Error creando notificación local:', error);
    }
}

// Hacer funciones disponibles globalmente
window.checkServiceWorker = checkServiceWorker;
window.checkPermissions = checkPermissions;
window.checkPushSubscription = checkPushSubscription;
window.testServerNotification = testServerNotification;
window.checkDatabaseSubscriptions = checkDatabaseSubscriptions;
window.checkAllSubscriptions = checkAllSubscriptions;
window.checkVapidConfig = checkVapidConfig;
window.diagnosePushNotifications = diagnosePushNotifications;
window.testLocalNotification = testLocalNotification;

console.log('🛠️ Funciones de prueba disponibles:');
console.log('• diagnosePushNotifications() - Diagnóstico completo del navegador');
console.log('• testServerNotification(userId) - Probar envío desde servidor');
console.log('• testLocalNotification() - Probar notificación local');
console.log('• checkServiceWorker() - Verificar Service Worker');
console.log('• checkPermissions() - Verificar permisos del navegador');
console.log('• checkPushSubscription() - Verificar suscripción push');
console.log('• checkVapidConfig() - Verificar configuración VAPID');
console.log('• checkDatabaseSubscriptions(userId) - Verificar suscripciones en BD');
console.log('• checkAllSubscriptions() - Ver todas las suscripciones del sistema');

// Función para probar el proceso completo paso a paso
async function testStepByStep() {
    console.log('🔬 === PRUEBA PASO A PASO ===');

    // Paso 1: Verificar soporte básico
    console.log('📋 PASO 1: Verificando soporte básico...');
    if (!('serviceWorker' in navigator)) {
        console.error('❌ Service Worker no soportado');
        return;
    }
    if (!('Notification' in window)) {
        console.error('❌ Notificaciones no soportadas');
        return;
    }
    if (!('PushManager' in window)) {
        console.error('❌ Push Manager no soportado');
        return;
    }
    console.log('✅ Soporte básico OK');

    // Paso 2: Verificar entorno seguro
    console.log('🔒 PASO 2: Verificando entorno seguro...');
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    console.log('🌐 Protocolo:', window.location.protocol);
    console.log('🏠 Hostname:', window.location.hostname);
    console.log('🔐 Seguro:', isSecure);

    if (!isSecure) {
        console.warn('⚠️ Advertencia: No estás en HTTPS. Las notificaciones push requieren HTTPS en producción.');
    }

    // Paso 3: Verificar permisos actuales
    console.log('🔔 PASO 3: Verificando permisos actuales...');
    const currentPermission = Notification.permission;
    console.log('📋 Permiso actual:', currentPermission);

    // Paso 4: Intentar registrar Service Worker
    console.log('🔧 PASO 4: Intentando registrar Service Worker...');
    try {
        console.log('📍 URL del SW:', window.location.origin + '/sw.js');
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('✅ Service Worker registrado:', registration.scope);

        // Esperar a que se active
        console.log('⏳ Esperando activación del Service Worker...');
        await navigator.serviceWorker.ready;
        console.log('✅ Service Worker listo');

        // Paso 5: Solicitar permisos
        console.log('📝 PASO 5: Solicitando permisos de notificación...');
        const permission = await Notification.requestPermission();
        console.log('📋 Permiso obtenido:', permission);

        // Verificar inmediatamente después
        const permissionAfter = Notification.permission;
        console.log('🔄 Permiso después de solicitud:', permissionAfter);

        if (permissionAfter === 'denied') {
            console.error('❌ EL NAVEGADOR CAMBIÓ EL PERMISO A DENIED AUTOMÁTICAMENTE');
            console.error('🚨 Esto indica un problema de seguridad o configuración del navegador');

            // Posibles soluciones
            console.log('💡 POSIBLES SOLUCIONES:');
            console.log('1. Verifica que estés en HTTPS (no HTTP)');
            console.log('2. Limpia cookies y datos del sitio');
            console.log('3. Reinicia el navegador');
            console.log('4. Verifica que no haya extensiones bloqueando notificaciones');
            console.log('5. Prueba en modo incógnito');

            return { success: false, error: 'PERMISSION_AUTO_DENIED' };
        }

        if (permission === 'granted' || permissionAfter === 'granted') {
            console.log('✅ Permisos concedidos correctamente');

            // Paso 6: Intentar crear suscripción push
            console.log('📨 PASO 6: Intentando crear suscripción push...');
            try {
                // Obtener clave VAPID
                const vapidResponse = await fetch('/api/push/vapid-public-key');
                const vapidKey = await vapidResponse.text();

                if (!vapidKey) {
                    console.error('❌ No se pudo obtener clave VAPID');
                    return { success: false, error: 'VAPID_MISSING' };
                }

                // Convertir clave
                const convertedKey = urlBase64ToUint8Array(vapidKey);

                // Crear suscripción
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedKey
                });

                console.log('✅ Suscripción push creada:', subscription.endpoint.substring(0, 50) + '...');

                // Paso 7: Enviar al servidor
                console.log('📤 PASO 7: Enviando suscripción al servidor...');
                const serverResponse = await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subscription: subscription,
                        userId: 1, // Usuario de prueba
                        userType: 'cliente'
                    })
                });

                const serverResult = await serverResponse.json();
                console.log('📋 Respuesta del servidor:', serverResult);

                if (serverResult.success) {
                    console.log('🎉 ¡TODO FUNCIONÓ CORRECTAMENTE!');
                    return { success: true };
                } else {
                    console.error('❌ Error del servidor:', serverResult.message);
                    return { success: false, error: 'SERVER_ERROR', details: serverResult };
                }

            } catch (subError) {
                console.error('❌ Error creando suscripción:', subError);
                return { success: false, error: 'SUBSCRIPTION_ERROR', details: subError.message };
            }

        } else {
            console.error('❌ Usuario denegó los permisos');
            return { success: false, error: 'USER_DENIED' };
        }

    } catch (regError) {
        console.error('❌ Error registrando Service Worker:', regError);
        console.error('📋 Tipo de error:', regError.name);
        console.error('💬 Mensaje:', regError.message);

        // Análisis específico del error
        if (regError.name === 'SecurityError') {
            console.error('🔒 CAUSA: Error de seguridad - El sitio debe estar en HTTPS');
        } else if (regError.name === 'NotAllowedError') {
            console.error('🚫 CAUSA: Permiso denegado - El navegador bloqueó el registro');
        } else if (regError.name === 'AbortError') {
            console.error('⏹️ CAUSA: Registro abortado - Posible conflicto con SW existente');
        }

        return { success: false, error: 'REGISTRATION_FAILED', details: regError };
    }
}

// Función auxiliar para convertir VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Agregar función de prueba paso a paso
window.testStepByStep = testStepByStep;

console.log('🛠️ Funciones de prueba disponibles:');
console.log('• diagnosePushNotifications() - Diagnóstico completo del navegador');
console.log('• testServerNotification(userId) - Probar envío desde servidor');
console.log('• testLocalNotification() - Probar notificación local');
console.log('• checkServiceWorker() - Verificar Service Worker');
console.log('• checkPermissions() - Verificar permisos del navegador');
console.log('• checkPushSubscription() - Verificar suscripción push');
console.log('• checkVapidConfig() - Verificar configuración VAPID');
console.log('• checkDatabaseSubscriptions(userId) - Verificar suscripciones en BD');
console.log('• checkAllSubscriptions() - Ver todas las suscripciones del sistema');
console.log('• testStepByStep() - PRUEBA PASO A PASO (recomendado)');

console.log('💡 Comienza ejecutando: testStepByStep()');

// Ejecutar prueba paso a paso automáticamente
setTimeout(() => {
    testStepByStep();
}, 1000);
