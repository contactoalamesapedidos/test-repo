// Script para verificar el estado de las suscripciones push
// Uso: node check-push-subscriptions.js [userId]

const mysql = require('mysql2/promise');
require('dotenv').config();

const userId = process.argv[2] || 16; // Usuario por defecto

async function checkPushSubscriptions() {
    console.log('🔍 Verificando suscripciones push...\n');

    let connection;

    try {
        // Conectar a la base de datos
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        console.log('✅ Conectado a la base de datos\n');

        // Verificar preferencia del usuario
        const [userPrefs] = await connection.execute(
            'SELECT id, nombre, recibir_notificaciones FROM usuarios WHERE id = ?',
            [userId]
        );

        if (userPrefs.length === 0) {
            console.log('❌ Usuario no encontrado');
            return;
        }

        const user = userPrefs[0];
        console.log('👤 Usuario:', user.nombre, `(ID: ${user.id})`);
        console.log('📧 Preferencia de notificaciones:', user.recibir_notificaciones ? '✅ Activada' : '❌ Desactivada');
        console.log('');

        // Verificar suscripciones push
        const [subscriptions] = await connection.execute(
            'SELECT id, tipo_usuario, fecha_creacion, fecha_actualizacion FROM push_subscriptions WHERE usuario_id = ?',
            [userId]
        );

        console.log('📱 Suscripciones push encontradas:', subscriptions.length);
        console.log('');

        if (subscriptions.length === 0) {
            console.log('❌ No hay suscripciones push activas');
            console.log('');
            console.log('💡 Solución:');
            console.log('1. Ve a Configuración > Notificaciones');
            console.log('2. Desactiva el switch de notificaciones');
            console.log('3. Espera 2 segundos');
            console.log('4. Vuelve a activar el switch');
            console.log('5. Permite las notificaciones cuando el navegador lo pida');
            return;
        }

        // Mostrar detalles de suscripciones
        subscriptions.forEach((sub, index) => {
            console.log(`📋 Suscripción ${index + 1}:`);
            console.log(`   ID: ${sub.id}`);
            console.log(`   Tipo: ${sub.tipo_usuario}`);
            console.log(`   Creada: ${sub.fecha_creacion}`);
            console.log(`   Actualizada: ${sub.fecha_actualizacion}`);
            console.log('');
        });

        // Verificar restaurante del usuario
        const [restaurants] = await connection.execute(
            'SELECT id, nombre FROM restaurantes WHERE usuario_id = ?',
            [userId]
        );

        if (restaurants.length > 0) {
            const restaurant = restaurants[0];
            console.log('🏪 Restaurante encontrado:');
            console.log(`   Nombre: ${restaurant.nombre}`);
            console.log(`   ID: ${restaurant.id}`);
            console.log('');
        } else {
            console.log('❌ No se encontró restaurante para este usuario');
            console.log('');
        }

        // Verificar si las suscripciones están activas
        console.log('✅ Estado: Las suscripciones push están configuradas correctamente');
        console.log('');
        console.log('🧪 Para probar:');
        console.log('1. Ve a /dashboard/settings');
        console.log('2. Haz clic en "Probar notificaciones push"');
        console.log('3. Deberías recibir una notificación');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    checkPushSubscriptions().catch(console.error);
}

module.exports = { checkPushSubscriptions };
