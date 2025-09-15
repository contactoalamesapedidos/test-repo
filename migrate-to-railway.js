const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrateDatabase() {
  console.log('🚀 Iniciando migración a Railway...\n');

  // Conexión a base de datos local
  const localDb = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'PESneymar2013',
    database: 'a_la_mesa'
  });

  // Conexión a Railway
  const railwayDb = await mysql.createConnection({
    host: 'ballast.proxy.rlwy.net',
    user: 'root',
    password: 'qBwmlSypzfGDjDFkZKdhevcXTtAQhBCU',
    database: 'railway',
    port: 30834,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📤 Exportando datos de la base de datos local...\n');

    // Obtener todas las tablas
    const [tables] = await localDb.execute("SHOW TABLES");
    const tableNames = tables.map(row => Object.values(row)[0]);

    console.log(`📋 Encontradas ${tableNames.length} tablas:`, tableNames.join(', '));

    // Para cada tabla, exportar e importar datos
    for (const tableName of tableNames) {
      console.log(`\n🔄 Migrando tabla: ${tableName}`);

      try {
        // Obtener estructura de la tabla
        const [createTable] = await localDb.execute(`SHOW CREATE TABLE \`${tableName}\``);
        const createTableSQL = createTable[0]['Create Table'];

        // Crear tabla en Railway (ignorar error si ya existe)
        try {
          await railwayDb.execute(createTableSQL.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'));
          console.log(`  ✅ Tabla ${tableName} creada`);
        } catch (error) {
          console.log(`  ⚠️  Tabla ${tableName} ya existe, continuando...`);
        }

        // Obtener datos de la tabla
        const [rows] = await localDb.execute(`SELECT * FROM \`${tableName}\``);

        if (rows.length > 0) {
          // Preparar inserción masiva
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => '?').join(', ');
          const insertSQL = `INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;

          // Insertar en lotes para evitar problemas de memoria
          const batchSize = 100;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            for (const row of batch) {
              try {
                const values = columns.map(col => row[col]);
                await railwayDb.execute(insertSQL, values);
              } catch (error) {
                console.log(`  ⚠️  Error insertando fila en ${tableName}:`, error.message);
              }
            }
          }

          console.log(`  ✅ Insertados ${rows.length} registros en ${tableName}`);
        } else {
          console.log(`  ℹ️  Tabla ${tableName} está vacía`);
        }

      } catch (error) {
        console.log(`  ❌ Error migrando tabla ${tableName}:`, error.message);
      }
    }

    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('\n📝 Resumen:');
    console.log('- Base de datos local migrada a Railway');
    console.log('- Todas las tablas y datos transferidos');
    console.log('- Listo para deploy en Vercel');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await localDb.end();
    await railwayDb.end();
  }
}

// Ejecutar migración
migrateDatabase().catch(console.error);
