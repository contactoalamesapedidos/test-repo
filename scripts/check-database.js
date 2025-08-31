const mysql = require('mysql2/promise');

async function checkDatabase() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        port: 3306
    });

    try {
        // Verificar bases de datos disponibles
        const [databases] = await connection.query('SHOW DATABASES;');
        console.log('Bases de datos disponibles:');
        console.log(databases.map(db => db.Database).join('\n'));

        // Verificar si existe la base de datos a_la_mesa
        const dbExists = databases.some(db => db.Database === 'a_la_mesa');
        
        if (!dbExists) {
            console.log('\n❌ La base de datos "a_la_mesa" no existe');
            return;
        }

        // Conectar a la base de datos a_la_mesa
        await connection.changeUser({ database: 'a_la_mesa' });
        
        // Verificar tablas
        const [tables] = await connection.query('SHOW TABLES;');
        console.log('\nTablas en a_la_mesa:');
        console.log(tables);

        // Verificar tabla de usuarios
        if (tables.some(t => t.Tables_in_a_la_mesa === 'usuarios')) {
            const [users] = await connection.query('SELECT id, email, tipo_usuario, LENGTH(password) as pwd_length FROM usuarios');
            console.log('\nUsuarios en la base de datos:');
            console.log(users);
            
            // Buscar el usuario específico
            const [targetUser] = await connection.query(
                'SELECT * FROM usuarios WHERE email LIKE ?', 
                ['%tiendanexus%']
            );
            
            console.log('\nUsuarios que coinciden con "tiendanexus":');
            console.log(targetUser);
        }

    } catch (error) {
        console.error('Error al verificar la base de datos:', error);
    } finally {
        await connection.end();
        process.exit();
    }
}

checkDatabase().catch(console.error);
