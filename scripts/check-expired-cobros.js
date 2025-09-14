/**
 * Script para verificar y actualizar cobros vencidos
 * Se ejecuta periódicamente para cambiar el estado de cobros pendientes a vencidos
 * cuando han pasado más de 72 horas desde la fecha de vencimiento
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkExpiredCobros() {
    let connection;

    try {
        // Crear conexión a la base de datos
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'a_la_mesa',
            timezone: 'Z'
        });

        console.log('🔍 Verificando cobros vencidos...');

        // Obtener la fecha actual
        const now = new Date();
        const fechaActual = now.toISOString().split('T')[0]; // Formato YYYY-MM-DD

        // Calcular la fecha límite (72 horas antes de la fecha actual)
        const fechaLimite = new Date(now.getTime() - (72 * 60 * 60 * 1000)); // 72 horas en milisegundos
        const fechaLimiteStr = fechaLimite.toISOString().split('T')[0];

        console.log(`📅 Fecha actual: ${fechaActual}`);
        console.log(`⏰ Fecha límite (72h atrás): ${fechaLimiteStr}`);

        // Buscar cobros pendientes que han vencido
        const [cobrosPendientes] = await connection.execute(`
            SELECT
                cs.id,
                cs.restaurante_id,
                cs.fecha_vencimiento,
                cs.monto_comision,
                r.nombre as restaurante_nombre,
                DATEDIFF(CURDATE(), cs.fecha_vencimiento) as dias_vencidos
            FROM cobros_semanales cs
            JOIN restaurantes r ON cs.restaurante_id = r.id
            WHERE cs.estado = 'pendiente'
            AND cs.fecha_vencimiento < ?
        `, [fechaLimiteStr]);

        console.log(`📊 Encontrados ${cobrosPendientes.length} cobros pendientes vencidos`);

        if (cobrosPendientes.length === 0) {
            console.log('✅ No hay cobros vencidos para actualizar');
            return;
        }

        // Mostrar información de los cobros vencidos
        console.log('\n📋 Cobros que serán marcados como vencidos:');
        cobrosPendientes.forEach(cobro => {
            console.log(`   - ID ${cobro.id}: ${cobro.restaurante_nombre} - $${cobro.monto_comision} - Vencido hace ${cobro.dias_vencidos} días`);
        });

        // Actualizar el estado de los cobros vencidos
        const [result] = await connection.execute(`
            UPDATE cobros_semanales
            SET estado = 'vencido',
                fecha_actualizacion = NOW()
            WHERE estado = 'pendiente'
            AND fecha_vencimiento < ?
        `, [fechaLimiteStr]);

        console.log(`\n✅ Actualizados ${result.affectedRows} cobros a estado 'vencido'`);

        // Crear notificaciones para los restaurantes afectados
        for (const cobro of cobrosPendientes) {
            try {
                // Buscar el usuario administrador del restaurante
                const [usuarioRestaurante] = await connection.execute(`
                    SELECT u.id, u.nombre, u.apellido
                    FROM usuarios u
                    JOIN restaurantes r ON u.id = r.usuario_id
                    WHERE r.id = ?
                `, [cobro.restaurante_id]);

                if (usuarioRestaurante.length > 0) {
                    const usuarioId = usuarioRestaurante[0].id;

                    // Crear notificación
                    await connection.execute(`
                        INSERT INTO notificaciones_sistema (
                            usuario_id,
                            tipo,
                            titulo,
                            mensaje,
                            url_accion,
                            fecha_creacion
                        ) VALUES (?, 'vencimiento_proximo', 'Cobro Vencido',
                        'Su cobro semanal por $${cobro.monto_comision.toLocaleString('es-AR', {minimumFractionDigits: 2})} ha vencido. Por favor, realice el pago lo antes posible.',
                        '/dashboard/cobros', NOW())
                    `, [usuarioId]);

                    console.log(`📬 Notificación enviada a ${usuarioRestaurante[0].nombre} ${usuarioRestaurante[0].apellido}`);
                }
            } catch (notifError) {
                console.error(`❌ Error creando notificación para restaurante ${cobro.restaurante_id}:`, notifError.message);
            }
        }

        console.log('\n🎉 Proceso completado exitosamente');

    } catch (error) {
        console.error('❌ Error en checkExpiredCobros:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Función para obtener estadísticas de cobros
async function getCobrosStats() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'a_la_mesa'
        });

        const [stats] = await connection.execute(`
            SELECT
                estado,
                COUNT(*) as cantidad,
                SUM(monto_comision) as monto_total
            FROM cobros_semanales
            GROUP BY estado
            ORDER BY estado
        `);

        console.log('\n📊 Estadísticas de cobros:');
        stats.forEach(stat => {
            console.log(`   ${stat.estado}: ${stat.cantidad} cobros - $${stat.monto_total?.toLocaleString('es-AR') || 0}`);
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar el script
async function main() {
    try {
        console.log('🚀 Iniciando verificación de cobros vencidos...');
        console.log('=' .repeat(50));

        await checkExpiredCobros();
        await getCobrosStats();

        console.log('=' .repeat(50));
        console.log('✅ Script ejecutado exitosamente');

    } catch (error) {
        console.error('❌ Error ejecutando el script:', error);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = { checkExpiredCobros, getCobrosStats };
