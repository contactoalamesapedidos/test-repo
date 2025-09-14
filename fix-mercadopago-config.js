const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function fixMercadoPagoConfig() {
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

    console.log('🔧 Reparando configuración de MercadoPago...\n');

    // 1. Limpiar credenciales incompletas (access token sin public key)
    console.log('🧹 Limpiando credenciales incompletas...');
    const [incompleteConfigs] = await connection.execute(`
      SELECT id, nombre, mp_access_token, mp_public_key
      FROM restaurantes
      WHERE (mp_access_token IS NOT NULL AND mp_public_key IS NULL)
         OR (mp_access_token IS NULL AND mp_public_key IS NOT NULL)
    `);

    if (incompleteConfigs.length > 0) {
      console.log(`   Encontradas ${incompleteConfigs.length} configuraciones incompletas:`);
      incompleteConfigs.forEach(rest => {
        console.log(`   - ${rest.nombre} (ID: ${rest.id})`);
      });

      // Limpiar las credenciales incompletas
      await connection.execute(`
        UPDATE restaurantes
        SET mp_access_token = NULL,
            mp_public_key = NULL,
            mp_user_id = NULL,
            mp_refresh_token = NULL
        WHERE (mp_access_token IS NOT NULL AND mp_public_key IS NULL)
           OR (mp_access_token IS NULL AND mp_public_key IS NOT NULL)
      `);

      console.log('   ✅ Credenciales incompletas limpiadas');
    } else {
      console.log('   ✅ No se encontraron credenciales incompletas');
    }
    console.log('');

    // 2. Verificar configuración de variables de entorno
    console.log('🔧 Verificando variables de entorno...');
    const requiredEnvVars = [
      'MP_APP_ID',
      'MP_CLIENT_SECRET',
      'MP_REDIRECT_URI'
    ];

    let envOk = true;
    requiredEnvVars.forEach(varName => {
      if (!process.env[varName]) {
        console.log(`   ❌ ${varName}: No configurado`);
        envOk = false;
      } else {
        console.log(`   ✅ ${varName}: Configurado`);
      }
    });

    if (!envOk) {
      console.log('\n❌ ERROR: Variables de entorno faltantes. Revisa el archivo .env');
      return;
    }
    console.log('');

    // 3. Mostrar estado final
    console.log('📊 Estado final de la configuración:');
    const [finalState] = await connection.execute(`
      SELECT
        COUNT(*) as total_restaurantes,
        SUM(CASE WHEN mp_access_token IS NOT NULL AND mp_public_key IS NOT NULL THEN 1 ELSE 0 END) as configurados,
        SUM(CASE WHEN mp_access_token IS NOT NULL AND mp_public_key IS NULL THEN 1 ELSE 0 END) as incompletos
      FROM restaurantes
      WHERE activo = 1
    `);

    const stats = finalState[0];
    console.log(`   Total de restaurantes: ${stats.total_restaurantes}`);
    console.log(`   Completamente configurados: ${stats.configurados}`);
    console.log(`   Con configuración incompleta: ${stats.incompletos}`);
    console.log('');

    if (stats.configurados > 0) {
      console.log('✅ Algunos restaurantes ya tienen MercadoPago configurado');
    } else {
      console.log('💡 Todos los restaurantes necesitan configurar MercadoPago');
      console.log('   Los propietarios deben:');
      console.log('   1. Ir a Configuración > MercadoPago');
      console.log('   2. Hacer clic en "Vincular Cuenta"');
      console.log('   3. Autorizar el acceso en MercadoPago');
    }

    console.log('\n🎉 Reparación completada exitosamente!');

  } catch (error) {
    console.error('❌ Error al reparar configuración:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixMercadoPagoConfig();
}

module.exports = { fixMercadoPagoConfig };
