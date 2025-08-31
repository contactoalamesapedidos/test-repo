const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function updatePassword() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'a_la_mesa',
        port: 3306
    });

    const email = 'tiendanexus.info@gmail.com';
    const newPassword = '123456';
    
    try {
        // Generar hash bcrypt con un salt fijo para consistencia
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        console.log(`Nuevo hash para '${newPassword}':`);
        console.log(hashedPassword);
        
        // Actualizar la contraseña y asegurar que el tipo de usuario sea 'restaurante'
        const [result] = await connection.execute(
            'UPDATE usuarios SET password = ? WHERE email = ?',
            [hashedPassword, email]
        );
        
        if (result.affectedRows > 0) {
            console.log(`✅ Contraseña actualizada para ${email}`);
            
            // Verificar el usuario actualizado
            const [user] = await connection.execute(
                'SELECT id, email, tipo_usuario, LENGTH(password) as pwd_length FROM usuarios WHERE email = ?',
                [email]
            );
            
            console.log('\nDatos actualizados del usuario:');
            console.log(user[0]);
            
            // Verificar que la contraseña coincide
            const isMatch = await bcrypt.compare(newPassword, user[0].password);
            console.log(`\nVerificación de contraseña: ${isMatch ? '✅ Correcta' : '❌ Incorrecta'}`);
            
        } else {
            console.log('❌ No se pudo actualizar la contraseña');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
        process.exit();
    }
}

// Ejecutar la función
updatePassword().catch(console.error);
