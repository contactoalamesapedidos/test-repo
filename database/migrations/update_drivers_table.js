const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'a_la_mesa',
    port: process.env.DB_PORT || 3306
};

const runMigration = async () => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado a la base de datos para actualizar la tabla `drivers`.');

        const columnsToAdd = {
            'status': "VARCHAR(50) NOT NULL DEFAULT 'offline'",
            'vehicle_type': "VARCHAR(100) NULL",
            'current_latitude': "DECIMAL(10, 8) NULL",
            'current_longitude': "DECIMAL(11, 8) NULL"
        };

        for (const [column, definition] of Object.entries(columnsToAdd)) {
            const [rows] = await connection.execute(
                `SELECT * FROM information_schema.columns WHERE table_schema = ? AND table_name = 'drivers' AND column_name = ?`,
                [dbConfig.database, column]
            );
            if (rows.length === 0) {
                await connection.execute(`ALTER TABLE drivers ADD COLUMN ${column} ${definition}`);
                console.log(`Columna '${column}' añadida a la tabla 'drivers'.`);
            } else {
                console.log(`Columna '${column}' ya existe en la tabla 'drivers'.`);
            }
        }

        console.log('Migración de la tabla `drivers` completada exitosamente.');

    } catch (err) {
        console.error('Error durante la migración de `drivers`:', err);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Conexión cerrada.');
        }
    }
};

runMigration();