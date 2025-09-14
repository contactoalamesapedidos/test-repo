const db = require('../config/database');

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/auth/login?message=Debes iniciar sesión para acceder a esta página.');
    }
    next();
}

function requireGuest(req, res, next) {
    if (req.session.user) {
        return res.redirect('/dashboard'); // O a donde prefieras redirigir si ya está logueado
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.tipo_usuario !== 'admin') {
        return res.status(403).render('error', { message: 'Acceso denegado. No tienes permisos de administrador.' });
    }
    next();
}

function requireRestaurant(req, res, next) {
    if (!req.session.user || req.session.user.tipo_usuario !== 'restaurante') {
        return res.status(403).render('error', { message: 'Acceso denegado. Debes ser un restaurante para ver esta página.' });
    }
    next();
}

async function requireVerifiedRestaurant(req, res, next) {
    if (!req.session.user || req.session.user.tipo_usuario !== 'restaurante') {
         return res.status(403).render('error', { message: 'Acceso denegado.' });
    }

    try {
        const [rows] = await db.execute('SELECT verificado FROM restaurantes WHERE usuario_id = ?', [req.session.user.id]);

        if (rows.length > 0 && rows[0].verificado === 1) {
            req.session.user.verificado = 1; // Actualizar sesión
            next();
        } else {
            req.session.user.verificado = 0; // Actualizar sesión
            return res.redirect('/dashboard/pending');
        }
    } catch (error) {
        console.error('[requireVerifiedRestaurant] Error fetching verification status:', error);
        return res.status(500).render('error', { message: 'Error verificando el estado del restaurante.' });
    }
}


// Middleware para verificar que el usuario es un repartidor
function requireDriver(req, res, next) {
    if (!req.session.user || req.session.user.tipo_usuario !== 'repartidor') {
        return res.status(403).render('error', {
            message: 'Acceso denegado. Debes ser un repartidor para acceder a esta sección.'
        });
    }
    next();
}

module.exports = {
    requireAuth,
    requireGuest,
    requireDriver,
    requireAdmin,
    requireRestaurant,
    requireVerifiedRestaurant
};
