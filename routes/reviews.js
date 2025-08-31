const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware para verificar autenticación
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Obtener reseñas disponibles para el usuario
router.get('/available', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Obtener pedidos entregados que pueden ser reseñados
        const [reviews] = await db.execute(`
            SELECT 
                c.id as calificacion_id,
                c.pedido_id,
                c.puede_resenar,
                c.resena_dejada,
                c.fecha_limite_resena,
                c.fecha_resena,
                p.numero_pedido,
                p.fecha_entrega,
                p.total,
                r.id as restaurante_id,
                r.nombre as restaurante_nombre,
                r.imagen_logo as restaurante_logo,
                COUNT(ip.id) as total_items
            FROM calificaciones c
            JOIN pedidos p ON c.pedido_id = p.id
            JOIN restaurantes r ON c.restaurante_id = r.id
            LEFT JOIN items_pedido ip ON p.id = ip.pedido_id
            WHERE c.cliente_id = ? AND p.estado = 'entregado'
            GROUP BY c.id, c.pedido_id, c.puede_resenar, c.resena_dejada, 
                     c.fecha_limite_resena, c.fecha_resena, p.numero_pedido, 
                     p.fecha_entrega, p.total, r.id, r.nombre, r.imagen_logo
            ORDER BY p.fecha_entrega DESC
        `, [userId]);

        // Calcular si cada reseña está disponible o expirada
        const now = new Date();
        reviews.forEach(review => {
            const fechaLimite = new Date(review.fecha_limite_resena);
        const fechaEntrega = review.fecha_entrega ? new Date(review.fecha_entrega) : null;
            review.puede_resenar = review.puede_resenar && !review.resena_dejada && now <= fechaLimite;
            review.expirada = now > fechaLimite;
            review.tiempo_restante = fechaLimite - now;
        });

        res.json({
            success: true,
            reviews
        });
    } catch (error) {
        console.error('Error obteniendo reseñas disponibles:', error);
        res.json({
            success: false,
            message: 'Error obteniendo reseñas disponibles'
        });
    }
});

// Obtener formulario de reseña
router.get('/:pedidoId', requireAuth, async (req, res) => {
    try {
        const pedidoId = req.params.pedidoId;
        const userId = req.session.user.id;

        // Verificar que el pedido pertenece al usuario y puede ser reseñado
        let [reviews] = await db.execute(`
            SELECT 
                c.id as calificacion_id,
                c.pedido_id,
                c.puede_resenar,
                c.resena_dejada,
                c.fecha_limite_resena,
                c.calificacion_restaurante,
                c.comentario_restaurante,
                p.numero_pedido,
                p.fecha_entrega,
                p.total,
                r.id as restaurante_id,
                r.nombre as restaurante_nombre,
                r.imagen_logo as restaurante_logo,
                r.imagen_banner as restaurante_banner
            FROM calificaciones c
            JOIN pedidos p ON c.pedido_id = p.id
            JOIN restaurantes r ON c.restaurante_id = r.id
            WHERE c.cliente_id = ? AND c.pedido_id = ? AND p.estado = 'entregado'
        `, [userId, pedidoId]);

        // Si no existe la fila en calificaciones, crearla si el pedido es entregado y pertenece al usuario
        if (reviews.length === 0) {
            const [pedidos] = await db.execute(`
                SELECT * FROM pedidos WHERE id = ? AND cliente_id = ? AND estado = 'entregado'`, [pedidoId, userId]);
            if (pedidos.length > 0) {
                const pedido = pedidos[0];
                // Crear la fila en calificaciones
                await db.execute(`
                    INSERT INTO calificaciones (
                        pedido_id, cliente_id, restaurante_id, repartidor_id, fecha_limite_resena, puede_resenar, resena_dejada
                    ) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 16 HOUR), TRUE, FALSE)
                `, [pedido.id, pedido.cliente_id, pedido.restaurante_id, pedido.repartidor_id]);
                // Volver a consultar
                [reviews] = await db.execute(`
                    SELECT 
                        c.id as calificacion_id,
                        c.pedido_id,
                        c.puede_resenar,
                        c.resena_dejada,
                        c.fecha_limite_resena,
                        c.calificacion_restaurante,
                        c.comentario_restaurante,
                        p.numero_pedido,
                        p.fecha_entrega,
                        p.total,
                        r.id as restaurante_id,
                        r.nombre as restaurante_nombre,
                        r.imagen_logo as restaurante_logo,
                        r.imagen_banner as restaurante_banner
                    FROM calificaciones c
                    JOIN pedidos p ON c.pedido_id = p.id
                    JOIN restaurantes r ON c.restaurante_id = r.id
                    WHERE c.cliente_id = ? AND c.pedido_id = ? AND p.estado = 'entregado'
                `, [userId, pedidoId]);
            }
        }

        if (reviews.length === 0) {
            return res.status(404).render('error', {
                title: 'Reseña No Encontrada',
                message: 'No se encontró el pedido o no puede ser reseñado',
                error: {}
            });
        }

        const review = reviews[0];
        const now = new Date();
        const fechaLimite = new Date(review.fecha_limite_resena);
        
        // Verificar si puede reseñar
        if (review.resena_dejada) {
            return res.render('reviews/completed', {
                title: 'Reseña Completada',
                review,
                user: req.session.user
            });
        }

        if (now > fechaLimite) {
            return res.render('reviews/expired', {
                title: 'Reseña Expirada',
                review,
                user: req.session.user
            });
        }

        // Obtener items del pedido
        const [items] = await db.execute(`
            SELECT ip.*, pr.nombre, pr.imagen
            FROM items_pedido ip
            JOIN productos pr ON ip.producto_id = pr.id
            WHERE ip.pedido_id = ?
        `, [pedidoId]);

        res.render('reviews/form', {
            title: 'Dejar Reseña',
            review,
            items,
            user: req.session.user
        });

    } catch (error) {
        console.error('Error cargando formulario de reseña:', error);
        res.render('error', {
            title: 'Error',
            message: 'Error cargando el formulario de reseña',
            error: {}
        });
    }
});

// Guardar reseña
router.post('/:pedidoId', requireAuth, async (req, res) => {
    try {
        const pedidoId = req.params.pedidoId;
        const userId = req.session.user.id;
        const { calificacion_restaurante, comentario_restaurante } = req.body;

        // Validar datos
        if (!calificacion_restaurante || calificacion_restaurante < 1 || calificacion_restaurante > 5) {
            return res.json({
                success: false,
                message: 'La calificación debe estar entre 1 y 5'
            });
        }

        // Validar comentario no vacío
        const comentarioLimpio = (comentario_restaurante || '').toString().trim();
        if (!comentarioLimpio) {
            return res.json({
                success: false,
                message: 'El comentario no puede estar vacío'
            });
        }

        // Verificar que el pedido puede ser reseñado
        const [reviews] = await db.execute(`
            SELECT c.id, c.puede_resenar, c.resena_dejada, c.fecha_limite_resena, c.restaurante_id, p.fecha_entrega
            FROM calificaciones c
            JOIN pedidos p ON c.pedido_id = p.id
            WHERE c.cliente_id = ? AND c.pedido_id = ? AND p.estado = 'entregado'
        `, [userId, pedidoId]);

        if (reviews.length === 0) {
            return res.json({
                success: false,
                message: 'No se encontró el pedido o no puede ser reseñado'
            });
        }

        const review = reviews[0];
        const now = new Date();
        const fechaLimite = new Date(review.fecha_limite_resena);

        if (review.resena_dejada) {
            return res.json({
                success: false,
                message: 'Ya has dejado una reseña para este pedido'
            });
        }

        // Respetar límite configurado y un límite duro de 16h desde la entrega
        const vencidoPorLimiteDuro = fechaEntrega ? (now - fechaEntrega) > (16 * 60 * 60 * 1000) : false;
        if (now > fechaLimite || vencidoPorLimiteDuro) {
            return res.json({
                success: false,
                message: 'El tiempo para dejar reseña ha expirado'
            });
        }

        // Actualizar la calificación
        await db.execute(`
            UPDATE calificaciones 
            SET calificacion_restaurante = ?,
                comentario_restaurante = ?,
                resena_dejada = TRUE,
                puede_resenar = FALSE,
                fecha_resena = NOW()
            WHERE id = ?
        `, [calificacion_restaurante, comentarioLimpio, review.id]);

        // Actualizar calificación promedio del restaurante
        await db.execute(`
            UPDATE restaurantes r
            SET calificacion_promedio = (
                SELECT AVG(calificacion_restaurante)
                FROM calificaciones c
                WHERE c.restaurante_id = r.id AND c.calificacion_restaurante IS NOT NULL
            ),
            total_calificaciones = (
                SELECT COUNT(*)
                FROM calificaciones c
                WHERE c.restaurante_id = r.id AND c.calificacion_restaurante IS NOT NULL
            )
            WHERE r.id = ?
        `, [review.restaurante_id]);

        res.json({
            success: true,
            message: 'Reseña guardada exitosamente'
        });

    } catch (error) {
        console.error('Error guardando reseña:', error);
        res.json({
            success: false,
            message: 'Error guardando la reseña'
        });
    }
});

// Obtener reseñas de un restaurante
router.get('/restaurant/:restaurantId', async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        // Obtener reseñas del restaurante
        const [reviews] = await db.execute(`
            SELECT 
                c.calificacion_restaurante,
                c.comentario_restaurante,
                c.fecha_resena,
                u.nombre,
                u.apellido,
                p.numero_pedido
            FROM calificaciones c
            JOIN usuarios u ON c.cliente_id = u.id
            JOIN pedidos p ON c.pedido_id = p.id
            WHERE c.restaurante_id = ? AND c.resena_dejada = TRUE
            ORDER BY c.fecha_resena DESC
            LIMIT ? OFFSET ?
        `, [restaurantId, limit, offset]);

        // Obtener total de reseñas
        const [totalReviews] = await db.execute(`
            SELECT COUNT(*) as total
            FROM calificaciones c
            WHERE c.restaurante_id = ? AND c.resena_dejada = TRUE
        `, [restaurantId]);

        const totalPages = Math.ceil(totalReviews[0].total / limit);

        res.json({
            success: true,
            reviews,
            pagination: {
                currentPage: page,
                totalPages,
                totalReviews: totalReviews[0].total,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error obteniendo reseñas del restaurante:', error);
        res.json({
            success: false,
            message: 'Error obteniendo reseñas'
        });
    }
});

module.exports = router; 