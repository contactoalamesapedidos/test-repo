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
    console.log(`[AUTH-MIDDLEWARE] requireRestaurant: req.session.user existe? ${!!req.session.user}`);
    if (req.session.user) {
        console.log(`[AUTH-MIDDLEWARE] requireRestaurant: tipo_usuario en sesión: ${req.session.user.tipo_usuario}`);
    }

    if (!req.session.user || req.session.user.tipo_usuario !== 'restaurante') {
        return res.status(403).render('error', { message: 'Acceso denegado. Debes ser un restaurante para ver esta página.' });
    }
    next();
}

async function requireVerifiedRestaurant(req, res, next) {
    console.log(`[requireVerifiedRestaurant] Start. Session user: ${req.session.user ? req.session.user.id : 'none'}, type: ${req.session.user ? req.session.user.tipo_usuario : 'none'}`);
    if (!req.session.user || req.session.user.tipo_usuario !== 'restaurante') {
         console.log('[requireVerifiedRestaurant] Access denied: Not logged in or not a restaurant.');
         return res.status(403).render('error', { message: 'Acceso denegado.' });
    }
    
    try {
        const [rows] = await db.execute('SELECT verificado FROM restaurantes WHERE usuario_id = ?', [req.session.user.id]);
        console.log('[requireVerifiedRestaurant] DB query result for verificado:', rows);

        if (rows.length > 0 && rows[0].verificado === 1) {
            console.log('[requireVerifiedRestaurant] Restaurant VERIFIED. Updating session.');
            req.session.user.verificado = 1; // Actualizar sesión
            next();
        } else {
            console.log('[requireVerifiedRestaurant] Restaurant NOT VERIFIED or not found. Redirecting to pending.');
            req.session.user.verificado = 0; // Actualizar sesión
            return res.redirect('/dashboard/pending');
        }
    } catch (error) {
        console.error('[requireVerifiedRestaurant] Error fetching verification status:', error);
        return res.status(500).render('error', { message: 'Error verificando el estado del restaurante.' });
    }
}


module.exports = {
    requireAuth,
    requireGuest,
    requireAdmin,
    requireRestaurant,
    requireVerifiedRestaurant
};