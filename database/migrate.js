const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'a_la_mesa',
    port: process.env.DB_PORT || 3306
});

const queries = [
    `CREATE TABLE IF NOT EXISTS configuracion (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sitio_web VARCHAR(255) NOT NULL DEFAULT 'http://192.168.0.102:3000',
        comision DECIMAL(5,2) NOT NULL DEFAULT 10.00,
        tiempo_preparacion INT NOT NULL DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `INSERT INTO configuracion (id, sitio_web, comision, tiempo_preparacion)
    SELECT 1, 'http://192.168.0.102:3000', 10.00, 30
    WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE id = 1)`,
    `ALTER TABLE usuarios ADD COLUMN direccion_principal VARCHAR(255) NULL AFTER ciudad`,
    `CREATE INDEX idx_direccion_principal ON usuarios(direccion_principal)`,
    `ALTER TABLE productos ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE`
];

connection.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err);
        return;
    }
    console.log('Conectado a la base de datos');

    // Ejecutar cada consulta por separado
    queries.forEach((query, index) => {
        connection.query(query, (err, results) => {
            if (err) {
                console.error(`Error al ejecutar consulta ${index + 1}:`, err);
            } else {
                console.log(`Consulta ${index + 1} ejecutada exitosamente`);
            }
            
            // Si es la última consulta, cerrar la conexión
            if (index === queries.length - 1) {
                connection.end();
                console.log('Migración completada');
            }
        });
    });
});
