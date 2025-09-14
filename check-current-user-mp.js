const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function checkCurrentUserMP() {
  let connection;

  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('🔍 Verificando configuración de MercadoPago para el usuario actual...\n');

    // Obtener todos los usuarios con restaurantes para identificar cuál es el actual
    const [allUsers] = await connection.execute(`
      SELECT DISTINCT
        u.id,
        u.nombre,
        u.apellido,
        u.email,
        r.nombre as restaurante_nombre
      FROM usuarios u
      JOIN restaurantes r ON u.id = r.usuario_id
      WHERE r.activo = 1
      ORDER BY u.id
    `);

    console.log('👥 Usuarios con restaurantes activos:');
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ID ${user.id}: ${user.nombre} ${user.apellido} (${user.email}) - ${user.restaurante_nombre}`);
    });
    console.log('');

    // Usar el primer usuario encontrado (o cambiar el ID manualmente)
    const currentUserId = allUsers.length > 0 ? allUsers[0].id : null;

    if (!currentUserId) {
      console.log('❌ No hay usuarios con restaurantes activos');
      return;
    }

    console.log(`👤 Usuario actual ID: ${currentUserId}\n`);

    // Verificar si el usuario tiene un restaurante
    const [userRestaurants] = await connection.execute(`
      SELECT
        r.id,
        r.nombre,
        r.usuario_id,
        r.mp_access_token,
        r.mp_public_key,
        r.mp_user_id,
        r.mp_refresh_token,
        u.nombre as propietario_nombre,
        u.email as propietario_email
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.usuario_id = ? AND r.activo = 1
      LIMIT 1
    `, [currentUserId]);

    if (userRestaurants.length === 0) {
      console.log('❌ El usuario actual no tiene un restaurante activo');
      return;
    }

    const restaurant = userRestaurants[0];
    console.log('🏪 Restaurante del usuario actual:');
    console.log(`   Nombre: ${restaurant.nombre}`);
    console.log(`   ID: ${restaurant.id}`);
    console.log(`   Propietario: ${restaurant.propietario_nombre} (${restaurant.propietario_email})`);
    console.log('');

    console.log('🔐 Estado de MercadoPago:');
    console.log(`   MP Access Token: ${restaurant.mp_access_token ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   MP Public Key: ${restaurant.mp_public_key ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   MP User ID: ${restaurant.mp_user_id || 'No configurado'}`);
    console.log(`   Estado general: ${restaurant.mp_access_token && restaurant.mp_public_key ? '✅ COMPLETO' : '❌ INCOMPLETO'}`);
    console.log('');

    if (restaurant.mp_access_token && restaurant.mp_public_key) {
      console.log('✅ El usuario YA TIENE MercadoPago configurado');
      console.log('💡 Si el botón "Vincular" no funciona, puede ser que:');
      console.log('   - Las credenciales estén expiradas');
      console.log('   - El refresh token necesite ser usado');
      console.log('   - Las variables de entorno no estén configuradas correctamente');
    } else {
      console.log('❌ El usuario NO tiene MercadoPago configurado');
      console.log('💡 El usuario debe hacer clic en "Vincular Cuenta" para configurar MercadoPago');
    }

    console.log('');
    console.log('🔧 Variables de entorno relevantes:');
    console.log(`   MP_APP_ID: ${process.env.MP_APP_ID ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   MP_CLIENT_SECRET: ${process.env.MP_CLIENT_SECRET ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   MP_REDIRECT_URI: ${process.env.MP_REDIRECT_URI ? '✅ Configurado' : '❌ No configurado'}`);

  } catch (error) {
    console.error('❌ Error al verificar configuración:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  checkCurrentUserMP();
}

module.exports = { checkCurrentUserMP };
