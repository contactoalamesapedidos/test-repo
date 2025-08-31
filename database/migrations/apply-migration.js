const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function applyMigrations() {
    const migrationsDir = __dirname;
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'a_la_mesa',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    };

    let connection;
    try {
        console.log(`Attempting to connect to database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
        connection = await mysql.createConnection(dbConfig);
        console.log('Successfully connected to the database.');

        // Ensure migrations table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Migrations table ensured.');

        const [appliedMigrationsRows] = await connection.query('SELECT name FROM migrations');
        const appliedMigrations = new Set(appliedMigrationsRows.map(row => row.name));

        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql') && file !== path.basename(__filename))
            .sort(); // Ensure migrations are applied in order

        for (const file of migrationFiles) {
            if (!appliedMigrations.has(file)) {
                const filePath = path.join(migrationsDir, file);
                const sql = fs.readFileSync(filePath, 'utf8');
                console.log(`Applying migration: ${file}`);
                try {
                    await connection.query(sql);
                    await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);
                    console.log(`Migration ${file} applied successfully.`);
                } catch (error) {
                    if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_COLUMN') {
                        console.warn(`Warning: Column in ${file} already exists. Marking as applied.`);
                        await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);
                    } else {
                        throw error;
                    }
                }
            } else {
                console.log(`Migration ${file} already applied, skipping.`);
            }
        }

        console.log('All pending migrations applied.');

    } catch (error) {
        console.error('Error applying migrations:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}

applyMigrations();