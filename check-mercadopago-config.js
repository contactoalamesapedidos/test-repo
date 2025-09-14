const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function checkMercadoPagoConfig() {
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

    console.log('🔍 Verificando configuración de MercadoPago...\n');

    // Verificar variables de entorno
    console.log('📋 Variables de entorno:');
    console.log('MP_APP_ID:', process.env.MP_APP_ID ? '✅ Configurado' : '❌ No configurado');
    console.log('MP_CLIENT_SECRET:', process.env.MP_CLIENT_SECRET ? '✅ Configurado' : '❌ No configurado');
    console.log('MP_REDIRECT_URI:', process.env.MP_REDIRECT_URI ? '✅ Configurado' : '❌ No configurado');
    console.log('MERCADOPAGO_ACCESS_TOKEN:', process.env.MERCADOPAGO_ACCESS_TOKEN ? '✅ Configurado' : '❌ No configurado');
    console.log('MERCADOPAGO_PUBLIC_KEY:', process.env.MERCADOPAGO_PUBLIC_KEY ? '✅ Configurado' : '❌ No configurado');
    console.log('');

    // Verificar restaurantes con configuración de MP
    const [restaurants] = await connection.execute(`
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
      WHERE r.activo = 1
      ORDER BY r.id
    `);

    console.log('🏪 Restaurantes encontrados:', restaurants.length);
    console.log('');

    restaurants.forEach((restaurant, index) => {
      console.log(`📍 Restaurante ${index + 1}: ${restaurant.nombre}`);
      console.log(`   ID: ${restaurant.id}`);
      console.log(`   Propietario: ${restaurant.propietario_nombre} (${restaurant.propietario_email})`);
      console.log(`   MP Access Token: ${restaurant.mp_access_token ? '✅ Configurado' : '❌ No configurado'}`);
      console.log(`   MP Public Key: ${restaurant.mp_public_key ? '✅ Configurado' : '❌ No configurado'}`);
      console.log(`   MP User ID: ${restaurant.mp_user_id || 'No configurado'}`);
      console.log(`   Estado: ${restaurant.mp_access_token && restaurant.mp_public_key ? '✅ COMPLETO' : '❌ INCOMPLETO'}`);
      console.log('');
    });

    // Verificar tabla de configuraciones
    const [configRows] = await connection.execute("SELECT * FROM configuraciones WHERE clave LIKE '%mercadopago%'");
    console.log('⚙️ Configuraciones del sistema:');
    configRows.forEach(config => {
      console.log(`   ${config.clave}: ${config.valor}`);
    });
    console.log('');

    // Recomendaciones
    console.log('💡 Recomendaciones:');
    if (restaurants.length === 0) {
      console.log('   - No hay restaurantes activos en el sistema');
    } else {
      const configuredRestaurants = restaurants.filter(r => r.mp_access_token && r.mp_public_key);
      console.log(`   - ${configuredRestaurants.length} de ${restaurants.length} restaurantes tienen MP configurado`);

      if (configuredRestaurants.length === 0) {
        console.log('   - Ningún restaurante tiene MercadoPago configurado');
        console.log('   - Los propietarios deben ir a Configuración > MercadoPago y vincular su cuenta');
      }
    }

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
  checkMercadoPagoConfig();
}

module.exports = { checkMercadoPagoConfig };
