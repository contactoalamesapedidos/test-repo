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

const runMigration = async () => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado a la base de datos.');

        const migrationFileName = process.argv[2]; // Get migration file name from command line argument
        if (!migrationFileName) {
            console.error('Error: No migration file specified. Usage: node apply-migration.js <migration_file_name>');
            process.exit(1);
        }

        const migrationFile = path.join(__dirname, migrationFileName);
        if (!fs.existsSync(migrationFile)) {
            console.error(`Error: Migration file not found: ${migrationFileName}`);
            process.exit(1);
        }

        const sql = fs.readFileSync(migrationFile, 'utf8');
        
        const statements = sql.split(';').filter(s => s.trim().length > 0);

        for (const statement of statements) {
            const cleanStatement = statement.trim();
            if (cleanStatement.length > 0) {
                await connection.query(cleanStatement);
                console.log(`Sentencia ejecutada exitosamente: ${cleanStatement.substring(0, 100)}...`);
            }
        }

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

runMigration();
