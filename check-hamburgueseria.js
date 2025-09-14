const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkHamburgueseria() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'a_la_mesa',
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Verificando estado de Hamburgueseria Colon 2...\n');

    // Buscar el restaurante
    const [restaurantes] = await connection.execute(`
      SELECT r.id, r.nombre, r.activo, r.verificado, r.fecha_registro,
             u.email, u.nombre as usuario_nombre, u.apellido as usuario_apellido
      FROM restaurantes r
      JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.nombre LIKE '%Hamburgueseria Colon%'
    `);

    if (restaurantes.length === 0) {
      console.log('❌ No se encontró el restaurante Hamburgueseria Colon');
      await connection.end();
      return;
    }

    const restaurante = restaurantes[0];
    console.log('📋 Información del restaurante:');
    console.log(`   ID: ${restaurante.id}`);
    console.log(`   Nombre: ${restaurante.nombre}`);
    console.log(`   Activo: ${restaurante.activo ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   Verificado: ${restaurante.verificado ? '✅ SÍ' : '❌ NO'}`);
    console.log(`   Usuario: ${restaurante.usuario_nombre} ${restaurante.usuario_apellido}`);
    console.log(`   Email: ${restaurante.email}`);
    console.log(`   Fecha registro: ${restaurante.fecha_registro}`);
    console.log('');

    // Verificar si cumple con los criterios de la generación automática
    const cumpleCriterios = restaurante.activo === 1 && restaurante.verificado === 1;
    console.log('🎯 Criterios para generación automática:');
    console.log(`   Activo Y Verificado: ${cumpleCriterios ? '✅ SÍ' : '❌ NO'}`);
    console.log('');

    // Verificar pedidos recientes
    const [pedidos] = await connection.execute(`
      SELECT COUNT(*) as total_pedidos,
             COUNT(CASE WHEN estado IN ('entregado', 'en_camino', 'listo', 'pendiente', 'confirmado', 'preparando') THEN 1 END) as pedidos_relevantes,
             MIN(fecha_pedido) as primer_pedido,
             MAX(fecha_pedido) as ultimo_pedido
      FROM pedidos
      WHERE restaurante_id = ?
    `, [restaurante.id]);

    const stats = pedidos[0];
    console.log('📊 Estadísticas de pedidos:');
    console.log(`   Total pedidos: ${stats.total_pedidos}`);
    console.log(`   Pedidos relevantes: ${stats.pedidos_relevantes}`);
    console.log(`   Primer pedido: ${stats.primer_pedido || 'N/A'}`);
    console.log(`   Último pedido: ${stats.ultimo_pedido || 'N/A'}`);
    console.log('');

    // Verificar cobros existentes
    const [cobros] = await connection.execute(`
      SELECT COUNT(*) as total_cobros,
             MAX(fecha_creacion) as ultimo_cobro
      FROM cobros_semanales
      WHERE restaurante_id = ?
    `, [restaurante.id]);

    const cobrosStats = cobros[0];
    console.log('💰 Estadísticas de cobros:');
    console.log(`   Total cobros: ${cobrosStats.total_cobros}`);
    console.log(`   Último cobro: ${cobrosStats.ultimo_cobro || 'N/A'}`);
    console.log('');

    // Verificar pedidos en las últimas semanas
    const fechaHace7Dias = new Date();
    fechaHace7Dias.setDate(fechaHace7Dias.getDate() - 7);
    const fechaHace7DiasStr = fechaHace7Dias.toISOString().split('T')[0];

    const [pedidosRecientes] = await connection.execute(`
      SELECT COUNT(*) as pedidos_ultima_semana,
             SUM(CASE WHEN estado IN ('entregado', 'en_camino', 'listo', 'pendiente', 'confirmado', 'preparando') THEN total ELSE 0 END) as ventas_ultima_semana
      FROM pedidos
      WHERE restaurante_id = ? AND fecha_pedido >= ?
    `, [restaurante.id, fechaHace7DiasStr]);

    const recientes = pedidosRecientes[0];
    console.log('📅 Actividad reciente (última semana):');
    console.log(`   Pedidos: ${recientes.pedidos_ultima_semana}`);
    console.log(`   Ventas: $${recientes.ventas_ultima_semana || 0}`);
    console.log('');

    // Diagnóstico final
    console.log('🔍 DIAGNÓSTICO:');
    if (!cumpleCriterios) {
      console.log('❌ El restaurante NO cumple con los criterios para generación automática');
      if (restaurante.activo !== 1) {
        console.log('   - No está marcado como ACTIVO');
      }
      if (restaurante.verificado !== 1) {
        console.log('   - No está marcado como VERIFICADO');
      }
    } else {
      console.log('✅ El restaurante SÍ cumple con los criterios para generación automática');
      if (recientes.pedidos_ultima_semana > 0) {
        console.log('✅ Tiene pedidos recientes que deberían generar cobros');
      } else {
        console.log('⚠️ No tiene pedidos en la última semana');
      }
    }

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkHamburgueseria();
