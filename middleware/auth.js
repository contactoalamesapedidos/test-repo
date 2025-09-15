const db = require('../config/database');
const { requireOwnership, SecurityLogger } = require('./security');
const { SecurityAuditUtils } = require('../utils/security');

const securityLogger = new SecurityLogger();

function requireAuth(req, res, next) {
    if (!req.session.user) {
        // Log unauthorized access attempt
        SecurityAuditUtils.logSecurityEvent('unauthorized_access', {
            path: req.path,
            method: req.method,
            ip: SecurityAuditUtils.getClientIP(req)
        }, req).catch(err => console.error('Security audit error:', err));

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
        // Log unauthorized admin access attempt
        SecurityAuditUtils.logSecurityEvent('unauthorized_admin_access', {
            userId: req.session.user?.id,
            userType: req.session.user?.tipo_usuario,
            path: req.path,
            ip: SecurityAuditUtils.getClientIP(req)
        }, req).catch(err => console.error('Security audit error:', err));

        return res.status(403).render('error', { message: 'Acceso denegado. No tienes permisos de administrador.' });
    }
    next();
}

function requireRestaurant(req, res, next) {
    if (!req.session.user || req.session.user.tipo_usuario !== 'restaurante') {
        // Log unauthorized restaurant access attempt
        SecurityAuditUtils.logSecurityEvent('unauthorized_restaurant_access', {
            userId: req.session.user?.id,
            userType: req.session.user?.tipo_usuario,
            path: req.path,
            ip: SecurityAuditUtils.getClientIP(req)
        }, req).catch(err => console.error('Security audit error:', err));

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
        // Log unauthorized driver access attempt
        SecurityAuditUtils.logSecurityEvent('unauthorized_driver_access', {
            userId: req.session.user?.id,
            userType: req.session.user?.tipo_usuario,
            path: req.path,
            ip: SecurityAuditUtils.getClientIP(req)
        }, req).catch(err => console.error('Security audit error:', err));

        return res.status(403).render('error', {
            message: 'Acceso denegado. Debes ser un repartidor para acceder a esta sección.'
        });
    }
    next();
}

// Enhanced ownership-based middlewares
const requireRestaurantOwnership = requireOwnership('restaurant');
const requireOrderOwnership = requireOwnership('order');
const requireProductOwnership = requireOwnership('product');

// Middleware for API access control
function requireApiAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Autenticación requerida'
        });
    }
    next();
}

// Middleware for role-based access control
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Autenticación requerida'
            });
        }

        if (!allowedRoles.includes(req.session.user.tipo_usuario)) {
            SecurityAuditUtils.logSecurityEvent('insufficient_permissions', {
                userId: req.session.user.id,
                userType: req.session.user.tipo_usuario,
                requiredRoles: allowedRoles,
                path: req.path,
                ip: SecurityAuditUtils.getClientIP(req)
            }, req).catch(err => console.error('Security audit error:', err));

            return res.status(403).json({
                success: false,
                message: 'Permisos insuficientes'
            });
        }

        next();
    };
}

// Middleware to check if user account is active
async function requireActiveUser(req, res, next) {
    if (!req.session.user) {
        return next();
    }

    try {
        const [users] = await db.execute('SELECT activo FROM usuarios WHERE id = ?', [req.session.user.id]);

        if (users.length === 0 || !users[0].activo) {
            // Log inactive user access attempt
            SecurityAuditUtils.logSecurityEvent('inactive_user_access', {
                userId: req.session.user.id,
                path: req.path,
                ip: SecurityAuditUtils.getClientIP(req)
            }, req).catch(err => console.error('Security audit error:', err));

            req.session.destroy(() => {
                res.redirect('/auth/login?error=Tu cuenta ha sido desactivada. Contacta al administrador.');
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Error checking user status:', error);
        next(); // Continue if database error
    }
}

// Middleware to validate session integrity
function validateSession(req, res, next) {
    if (req.session.user) {
        // Check if session has required user data
        const requiredFields = ['id', 'tipo_usuario', 'email'];
        const missingFields = requiredFields.filter(field => !req.session.user[field]);

        if (missingFields.length > 0) {
            SecurityAuditUtils.logSecurityEvent('invalid_session', {
                missingFields,
                path: req.path,
                ip: SecurityAuditUtils.getClientIP(req)
            }, req).catch(err => console.error('Security audit error:', err));

            req.session.destroy(() => {
                res.redirect('/auth/login?error=Sesión inválida. Por favor inicia sesión nuevamente.');
            });
            return;
        }
    }

    next();
}

module.exports = {
    requireAuth,
    requireGuest,
    requireDriver,
    requireAdmin,
    requireRestaurant,
    requireVerifiedRestaurant,
    requireRestaurantOwnership,
    requireOrderOwnership,
    requireProductOwnership,
    requireApiAuth,
    requireRole,
    requireActiveUser,
    validateSession
};
