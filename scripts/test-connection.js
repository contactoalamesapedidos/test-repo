const mysql = require('mysql2/promise');

async function testConnection() {
    console.log('Iniciando prueba de conexión a la base de datos...');
    
    const config = {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'a_la_mesa',
        port: 3306
    };
    
    console.log('Configuración de conexión:', config);
    
    try {
        const connection = await mysql.createConnection(config);
        console.log('✅ Conexión exitosa a MySQL');
        
        // Verificar si la base de datos existe
        const [rows] = await connection.execute('SELECT DATABASE() as db');
        console.log('Base de datos conectada:', rows[0].db);
        
        // Verificar tablas
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('\nTablas disponibles:');
        console.log(tables);
        
        // Verificar usuario
        const [users] = await connection.execute(
            'SELECT * FROM usuarios WHERE email LIKE ?', 
            ['%tiendanexus%']
        );
        
        console.log('\nUsuarios encontrados:');
        console.log(users);
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        console.error('Código de error:', error.code);
        console.error('Número de error:', error.errno);
        console.error('SQL State:', error.sqlState);
    } finally {
        process.exit();
    }
}

testConnection();
