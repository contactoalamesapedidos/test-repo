#!/usr/bin/env node

// Script de configuración rápida de base de datos para A la Mesa
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    console.log('🍕 Configurando base de datos para A la Mesa...\n');

    const forceReset = process.argv.includes('--force');
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true,
        namedPlaceholders: false
    };

    let connection;

    try {
        // Conectar a MySQL
        console.log('📡 Conectando a MySQL...');
        connection = await mysql.createConnection({
            ...config,
            multipleStatements: true
        });
        console.log('✅ Conectado a MySQL exitosamente');

        // Crear base de datos si no existe
        console.log('\n🗄️ Creando base de datos...');
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'a_la_mesa'}`);
        console.log('✅ Base de datos creada o ya existe');

        // Cambiar a la base de datos
        await connection.query(`USE ${process.env.DB_NAME || 'a_la_mesa'}`);

        // Si se fuerza el reset, eliminar todas las tablas
        if (forceReset) {
            console.log('\n🗑️ Forzando recreación de tablas...');
            const tables = [
                'notificaciones_sistema',
                'actividad_admin',
                'ventas_diarias',
                'comprobantes_pago',
                'cobros_semanales',
                'configuraciones',
                'favoritos',
                'uso_cupones',
                'cupones',
                'carrito_opciones',
                'carrito',
                'calificaciones',
                'item_opciones_seleccionadas',
                'items_pedido',
                'pedidos',
                'valores_opciones',
                'opciones_productos',
                'productos',
                'categorias_productos',
                'restaurante_categorias',
                'restaurantes',
                'categorias_restaurantes',
                'direcciones',
                'usuarios'
            ];
            
            // Desactivar verificación de claves foráneas temporalmente
            await connection.query('SET FOREIGN_KEY_CHECKS = 0');
            
            // Eliminar cada tabla si existe
            for (const table of tables) {
                await connection.query(`DROP TABLE IF EXISTS ${table}`);
            }
            
            // Reactivar verificación de claves foráneas
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
            console.log('✅ Tablas eliminadas');
        }

        // Ejecutar schema
        console.log('\n📋 Creando tablas...');
        const schemaSQL = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
        await connection.query(schemaSQL);
        console.log('✅ Tablas creadas exitosamente');

        // Ejecutar datos de ejemplo
        console.log('\n📦 Insertando datos de ejemplo...');
        const seedSQL = fs.readFileSync(path.join(__dirname, 'database', 'seed.sql'), 'utf8');
        await connection.query(seedSQL);
        console.log('✅ Datos de ejemplo insertados');

        // Verificar datos
        console.log('\n🔍 Verificando instalación...');
        
        const [restaurants] = await connection.execute('SELECT COUNT(*) as count FROM restaurantes');
        const [products] = await connection.execute('SELECT COUNT(*) as count FROM productos');
        const [users] = await connection.execute('SELECT COUNT(*) as count FROM usuarios');

        console.log(`   📊 Restaurantes: ${restaurants[0].count}`);
        console.log(`   🍽️ Productos: ${products[0].count}`);
        console.log(`   👥 Usuarios: ${users[0].count}`);

        console.log('\n🎉 ¡Base de datos configurada exitosamente!');
        console.log('\n📝 Credenciales de prueba:');
        console.log('   🛡️  ADMIN: admin@alamesa.com / 123456');
        console.log('   🛒 Cliente: demo@alamesa.com / 123456');
        console.log('   🏪 Restaurante: restaurante@alamesa.com / 123456');
        console.log('\n🌐 URLs importantes:');
        console.log('   🏠 Inicio: http://localhost:3000');
        console.log('   🔐 Login: http://localhost:3000/auth/login');
        console.log('   🛡️  PANEL ADMIN: http://localhost:3000/admin');
        console.log('   🏪 Panel Restaurante: http://localhost:3000/dashboard');
        console.log('   💰 Cobros Restaurante: http://localhost:3000/dashboard/cobros');
        console.log('   ➕ Registro Restaurante: http://localhost:3000/auth/register-restaurant');
        console.log('\n💼 Funcionalidades del Panel Admin:');
        console.log('   • Gestión completa de restaurantes (CRUD)');
        console.log('   • Sistema de cobros semanales (10% comisión)');
        console.log('   • Aprobación de comprobantes de pago');
        console.log('   • Gestión de productos desde admin');
        console.log('   • Reportes y estadísticas');
        console.log('   • Exportación de datos (CSV)');

    } catch (error) {
        console.error('\n❌ Error configurando base de datos:', error.message);
        console.error('\n🔧 Posibles soluciones:');
        console.error('   1. Verifica que MySQL esté ejecutándose');
        console.error('   2. Verifica las credenciales en el archivo .env');
        console.error('   3. Asegúrate de tener permisos para crear bases de datos');
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;
