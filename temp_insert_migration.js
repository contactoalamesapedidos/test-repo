const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function insertMigration() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'a_la_mesa',
        port: process.env.DB_PORT || 3306
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.query('INSERT IGNORE INTO migrations (name) VALUES (?)', ['20250727_add_delivery_system_tables.sql']);
        console.log('Migration 20250727_add_delivery_system_tables.sql inserted into migrations table.');
    } catch (error) {
        console.error('Error inserting migration:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

insertMigration();
