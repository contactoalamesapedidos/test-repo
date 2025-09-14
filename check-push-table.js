const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function checkPushTable() {
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

    console.log('🔍 Verificando tabla push_subscriptions...\n');

    // Verificar si la tabla existe
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'push_subscriptions'
    `);

    if (tables.length === 0) {
      console.log('❌ La tabla push_subscriptions NO existe');
      console.log('💡 Creando la tabla...');

      // Crear la tabla
      await connection.execute(`
        CREATE TABLE push_subscriptions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          tipo_usuario ENUM('cliente', 'restaurante', 'repartidor', 'admin') NOT NULL,
          subscription_data JSON NOT NULL,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_usuario_id (usuario_id),
          INDEX idx_tipo_usuario (tipo_usuario),
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      console.log('✅ Tabla push_subscriptions creada exitosamente');
      return;
    }

    console.log('✅ La tabla push_subscriptions existe');

    // Verificar estructura de la tabla
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'push_subscriptions'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\n📋 Estructura de la tabla:');
    columns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Verificar registros existentes
    const [subscriptions] = await connection.execute(`
      SELECT COUNT(*) as total, tipo_usuario, COUNT(*) as count
      FROM push_subscriptions
      GROUP BY tipo_usuario
    `);

    console.log('\n📊 Registros por tipo de usuario:');
    if (subscriptions.length === 0) {
      console.log('   ❌ No hay suscripciones registradas');
    } else {
      subscriptions.forEach(sub => {
        console.log(`   ${sub.tipo_usuario}: ${sub.count}`);
      });
    }

    // Verificar si hay usuarios con restaurantes que deberían tener notificaciones
    const [restaurantUsers] = await connection.execute(`
      SELECT
        u.id,
        u.nombre,
        u.apellido,
        u.email,
        r.nombre as restaurante_nombre,
        CASE WHEN ps.id IS NOT NULL THEN '✅ Tiene suscripción' ELSE '❌ Sin suscripción' END as estado_push
      FROM usuarios u
      JOIN restaurantes r ON u.id = r.usuario_id
      LEFT JOIN push_subscriptions ps ON u.id = ps.usuario_id
      WHERE r.activo = 1
      ORDER BY u.id
    `);

    console.log('\n🏪 Usuarios con restaurantes:');
    restaurantUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.nombre} ${user.apellido} (${user.email})`);
      console.log(`      Restaurante: ${user.restaurante_nombre}`);
      console.log(`      Estado push: ${user.estado_push}`);
      console.log('');
    });

    // Verificar permisos de la tabla
    console.log('🔐 Verificando permisos...');
    try {
      await connection.execute('INSERT INTO push_subscriptions (usuario_id, tipo_usuario, subscription_data) VALUES (1, "admin", "{}")');
      await connection.execute('DELETE FROM push_subscriptions WHERE usuario_id = 1 AND tipo_usuario = "admin"');
      console.log('✅ Permisos de escritura/lectura OK');
    } catch (error) {
      console.log('❌ Error de permisos:', error.message);
    }

  } catch (error) {
    console.error('❌ Error al verificar tabla push_subscriptions:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  checkPushTable();
}

module.exports = { checkPushTable };
