const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Usar la misma configuración que en database.js
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'a_la_mesa',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

async function updatePassword() {
    const email = 'tiendanexus.info@gmail.com';
    const newPassword = '123456';
    
    // Generar hash bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    console.log(`Nuevo hash para la contraseña '${newPassword}':`);
    console.log(hashedPassword);
    
    // Crear conexión a la base de datos
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        // Actualizar la contraseña en la base de datos
        const [result] = await connection.execute(
            'UPDATE usuarios SET password = ? WHERE email = ?',
            [hashedPassword, email]
        );
        
        if (result.affectedRows > 0) {
            console.log(`\n✅ Contraseña actualizada correctamente para ${email}`);
            console.log(`Nuevo hash almacenado: ${hashedPassword}`);
        } else {
            console.log('❌ No se encontró el usuario con el correo proporcionado');
        }
    } catch (error) {
        console.error('Error al actualizar la contraseña:', error);
    } finally {
        await connection.end();
    }
}

updatePassword().catch(console.error);
