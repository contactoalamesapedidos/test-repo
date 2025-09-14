const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'a_la_mesa',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
};

const runSpecificMigration = async (migrationFileName) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado a la base de datos.');

        const migrationFile = path.join(__dirname, migrationFileName);
        const sql = fs.readFileSync(migrationFile, 'utf8');

        console.log(`Ejecutando migración: ${migrationFileName}`);

        // Ejecutar todas las sentencias SQL
        await connection.query(sql);

        console.log(`Migración ${migrationFileName} completada exitosamente.`);

    } catch (err) {
        console.error('Error durante la migración:', err);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Conexión cerrada.');
        }
    }
};

// Obtener el nombre del archivo de migración desde los argumentos de línea de comandos
const migrationFileName = process.argv[2];
if (!migrationFileName) {
    console.error('Uso: node run_specific_migration.js <nombre_del_archivo_de_migracion>');
    process.exit(1);
}

runSpecificMigration(migrationFileName);
