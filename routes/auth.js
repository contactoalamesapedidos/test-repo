const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/databasePool');
const { transporter, sendEmail } = require('../config/mailer');
const crypto = require('crypto');
const { requireAuth, requireGuest, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Security imports
const {
    PasswordUtils,
    SecurityAuditUtils,
    ValidationUtils,
    securityLogger
} = require('../utils/security');
const {
    csrfProtection,
    authRateLimit,
    authSlowDown
} = require('../middleware/security');

// Configuración de Nodemailer (usar variables de entorno en producción)
// const transporter = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
//     port: process.env.EMAIL_PORT || 2525,
//     auth: {
//         user: process.env.EMAIL_USER || 'a7011234567890',
//         pass: process.env.EMAIL_PASS || 'a7011234567890'
//     }
// });



// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/auth/profile');
    }
    res.render('auth/login', {
        title: 'Iniciar Sesión - A la Mesa',
        error: req.query.error || null,
        message: req.query.message || null
    });
});

// Handle login con validación y sanitización
router.post('/login', [
    csrfProtection,
    body('email').isEmail().withMessage('Email inválido').trim(),
    body('password').isLength({ min: 1 }).withMessage('La contraseña es requerida').trim(),
    body('remember').optional().toBoolean()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Log failed login attempt
        securityLogger.logFailedLogin(
            req.body.email || 'unknown',
            SecurityAuditUtils.getClientIP(req),
            req.get('User-Agent')
        );
        return res.redirect('/auth/login?error=Email o contraseña incorrectos');
    }

    const { email, password, remember } = req.body;
    const sanitizedEmail = ValidationUtils.sanitizeEmail(email);

    try {
        // Buscar usuario con email sanitizado
        let [users] = await db.execute(
            'SELECT * FROM usuarios WHERE email = ?',
            [sanitizedEmail]
        );

        // Si no se encuentra, buscar sin distinguir mayúsculas/minúsculas
        if (users.length === 0) {
            [users] = await db.execute(
                'SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))',
                [sanitizedEmail]
            );
        }

        if (users.length === 0) {
            // Log failed login attempt
            securityLogger.logFailedLogin(
                sanitizedEmail,
                SecurityAuditUtils.getClientIP(req),
                req.get('User-Agent')
            );
            return res.redirect('/auth/login?error=Email o contraseña incorrectos');
        }

        const user = users[0];

        // Check if user is active
        if (!user.activo) {
            securityLogger.logFailedLogin(
                sanitizedEmail,
                SecurityAuditUtils.getClientIP(req),
                req.get('User-Agent')
            );
            return res.redirect('/auth/login?error=Cuenta inactiva. Contacta al administrador.');
        }

        const isMatch = await PasswordUtils.verifyPassword(password, user.password);

        if (!isMatch) {
            // Log failed login attempt
            securityLogger.logFailedLogin(
                sanitizedEmail,
                SecurityAuditUtils.getClientIP(req),
                req.get('User-Agent')
            );
            return res.redirect('/auth/login?error=Email o contraseña incorrectos');
        }

        // Log successful login
        securityLogger.logSuccessfulLogin(
            user.id,
            SecurityAuditUtils.getClientIP(req),
            req.get('User-Agent')
        );

        // Guardar todos los campos relevantes en la sesión
        req.session.user = {
            id: user.id,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            telefono: user.telefono,
            ciudad: user.ciudad,
            direccion_principal: user.direccion_principal,
            tipo_usuario: user.tipo_usuario,
            fecha_registro: user.fecha_registro,
            recibir_notificaciones: user.recibir_notificaciones
        };

        if (remember) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        } else {
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
        }

        // Redirigir según el tipo de usuario
        if (user.tipo_usuario === 'admin') {
            res.redirect('/admin');
        } else if (user.tipo_usuario === 'restaurante') {
            res.redirect('/dashboard');
        } else if (user.tipo_usuario === 'repartidor') {
            res.redirect('/repartidores');
        } else {
            res.redirect('/');
        }

    } catch (error) {
        console.error('Error en el login:', error);
        // Log security event
        SecurityAuditUtils.logSecurityEvent('login_error', {
            email: sanitizedEmail,
            error: error.message
        }, req).catch(err => console.error('Security audit error:', err));
        res.redirect('/auth/login?error=Error interno del servidor');
    }
});

// Register page
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/auth/profile');
    }
    res.render('auth/register', {
        title: 'Registrarse - A la Mesa',
        error: null,
        message: null // Añadido para compatibilidad con 'success' en la plantilla
    });
});

// Handle registration
router.post('/register', [
    body('nombre_apellido').trim().notEmpty().withMessage('El nombre y apellido son requeridos'),
    body('email').isEmail().withMessage('Email inválido').trim(),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('confirm_password').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Las contraseñas no coinciden');
        }
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/register', {
            title: 'Registro - A la Mesa',
            error: errors.array()[0].msg,
            message: ''
        });
    }

    const { nombre_apellido, email, password, telefono, ciudad, direccion } = req.body;
    const [nombre, ...apellido_parts] = nombre_apellido.split(' ');
    const apellido = apellido_parts.join(' ');

    try {
        const [existingUsers] = await db.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.render('auth/register', {
                title: 'Registrarse - A la Mesa',
                error: 'El email ya está registrado',
                message: ''
            });
        }

        const hashedPassword = await PasswordUtils.hashPassword(password);

        const [result] = await db.execute(
            'INSERT INTO usuarios (nombre, apellido, email, password, telefono, ciudad, tipo_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nombre, apellido, email, hashedPassword, telefono || null, ciudad || '', 'cliente']
        );

        // Enviar correo de bienvenida
        await sendEmail(
            email,
            '¡Bienvenido a A la Mesa!',
            'customer-welcome',
            { nombre: nombre }
        );

        const [rows] = await db.execute('SELECT * FROM usuarios WHERE id = ?', [result.insertId]);

        res.redirect('/auth/login?message=Registro exitoso. Ahora puedes iniciar sesión.');

    } catch (error) {
        console.error('Error en el registro:', error);
        res.render('auth/register', {
            title: 'Registrarse - A la Mesa',
            error: 'Error interno del servidor al registrar usuario',
            message: ''
        });
    }
});

// Register restaurant page
router.get('/register-restaurant', (req, res) => {
    res.render('auth/register-restaurant', {
        title: 'Registrar Restaurante - A la Mesa',
        error: null,
        success: null
    });
});

// Handle restaurant registration
router.post('/register-restaurant', [
    body('nombre_apellido').trim().notEmpty().withMessage('El nombre y apellido son requeridos'),
    body('email').isEmail().withMessage('Email inválido').trim(),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('restaurante_nombre').trim().notEmpty().withMessage('El nombre del restaurante es requerido'),
    body('restaurante_descripcion').trim().notEmpty().withMessage('La descripción del restaurante es requerida'),
    body('restaurante_direccion').trim().notEmpty().withMessage('La dirección del restaurante es requerida'),
    body('categoria_id').notEmpty().withMessage('La categoría es requerida'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/register-restaurant', {
            title: 'Registro de Restaurante - A la Mesa',
            error: errors.array()[0].msg,
            success: ''
        });
    }

    const { nombre_apellido, email, password, ciudad, restaurante_nombre, restaurante_descripcion, restaurante_direccion, restaurante_telefono, categoria_id, horario_apertura, horario_cierre } = req.body;
    const [nombre, ...apellido_parts] = nombre_apellido.split(' ');
    const apellido = apellido_parts.join(' ');

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existingUsers] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            await connection.rollback();
            return res.render('auth/register-restaurant', {
                title: 'Registrar Restaurante - A la Mesa',
                error: 'El email del propietario ya está registrado',
                success: null
            });
        }

        const hashedPassword = await PasswordUtils.hashPassword(password);

        const [userResult] = await connection.execute(
            'INSERT INTO usuarios (nombre, apellido, email, password, tipo_usuario, ciudad) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, apellido, email, hashedPassword, 'restaurante', ciudad]
        );

        const userId = userResult.insertId;

        await connection.execute(
            'INSERT INTO restaurantes (usuario_id, nombre, descripcion, direccion, ciudad, telefono, verificado, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, restaurante_nombre, restaurante_descripcion, restaurante_direccion, ciudad, restaurante_telefono || null, 0, 0] // No verificado, no activo por defecto
        );

        await connection.commit();

        // Enviar correo de bienvenida al restaurante
        await sendEmail(
            email,
            '¡Gracias por registrar tu restaurante en A la Mesa!',
            'restaurant-welcome',
            {
                nombre: nombre,
                nombreRestaurante: restaurante_nombre
            }
        );

        // Enviar correo de notificación al administrador
        // TODO: Reemplazar con el email del administrador desde la configuración o base de datos
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@alamesa.com';
        await sendEmail(
            adminEmail,
            'Nuevo Restaurante Registrado',
            'admin-new-restaurant-notification',
            {
                nombreRestaurante: restaurante_nombre,
                nombrePropietario: nombre_apellido,
                emailPropietario: email
            }
        );

        res.redirect('/auth/login?message=Registro de restaurante exitoso. Espera la aprobación del administrador.');

    } catch (error) {
        await connection.rollback();
        console.error('Error en el registro de restaurante:', error);
        res.render('auth/register-restaurant', {
            title: 'Registrar Restaurante - A la Mesa',
            error: 'Error interno del servidor al registrar restaurante',
            success: null
        });
    } finally {
        connection.release();
    }
});



// User profile page
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, nombre, apellido, email, telefono, ciudad, direccion_principal, tipo_usuario, recibir_notificaciones FROM usuarios WHERE id = ?', [req.session.user.id]);

        if (users.length === 0) {
            req.session.destroy(() => {
                res.redirect('/auth/login?error=Usuario no encontrado');
            });
            return;
        }
        const user = users[0];
        // Obtener los pedidos recientes del usuario
        const [orders] = await db.execute(`
            SELECT p.id, p.numero_pedido, r.nombre AS restaurante_nombre, p.estado, p.total
            FROM pedidos p
            JOIN restaurantes r ON p.restaurante_id = r.id
            WHERE p.cliente_id = ?
            ORDER BY p.fecha_pedido DESC
            LIMIT 5
        `, [user.id]);
        res.render('auth/profile', {
            title: 'Mi Perfil - A la Mesa',
            user: user,
            orders: orders || [],
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Error cargando perfil:', error);
        res.redirect('/?error=Error al cargar el perfil');
    }
});

// Handle profile update
router.post('/profile', requireAuth, [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('apellido').notEmpty().withMessage('El apellido es requerido'),
    body('email').isEmail().withMessage('Ingresa un email válido').trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.redirect(`/auth/profile?error=${errors.array()[0].msg}`);
    }

    const { nombre, apellido, email, telefono, ciudad, direccion } = req.body;
    const recibir_notificaciones = req.body.recibir_notificaciones ? 1 : 0;
    const userId = req.session.user.id;



    try {
        // Check if email already exists for another user
        const [existingUsers] = await db.execute('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, userId]);
        if (existingUsers.length > 0) {
            return res.redirect('/auth/profile?error=El email ya está en uso por otra cuenta');
        }

        await db.execute(
            'UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, telefono = ?, ciudad = ?, direccion_principal = ?, recibir_notificaciones = ? WHERE id = ?',
            [nombre, apellido, email, telefono || null, ciudad || null, direccion || null, recibir_notificaciones, userId]
        );

        const [updatedUser] = await db.execute('SELECT * FROM usuarios WHERE id = ?', [userId]);
        const user = updatedUser[0];

        // Actualizar todos los campos relevantes en la sesión
        req.session.user = {
            id: user.id,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            telefono: user.telefono,
            ciudad: user.ciudad,
            direccion_principal: user.direccion_principal,
            tipo_usuario: user.tipo_usuario,
            fecha_registro: user.fecha_registro,
            recibir_notificaciones: user.recibir_notificaciones
        };

        res.redirect('/auth/profile?message=Perfil actualizado exitosamente');

    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.redirect('/auth/profile?error=Error interno del servidor al actualizar perfil');
    }
});

// Handle password change
router.post('/change-password', requireAuth, [
    body('current_password').notEmpty().withMessage('La contraseña actual es requerida'),
    body('new_password').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
    body('confirm_new_password').custom((value, { req }) => {
        if (value !== req.body.new_password) {
            throw new Error('Las nuevas contraseñas no coinciden');
        }
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.redirect(`/auth/profile?error=${errors.array()[0].msg}`);
    }

    const { current_password, new_password } = req.body;
    const userId = req.session.user.id;

    try {
        const [users] = await db.execute('SELECT password FROM usuarios WHERE id = ?', [userId]);
        const user = users[0];

        const isMatch = await PasswordUtils.verifyPassword(current_password, user.password);
        if (!isMatch) {
            return res.redirect('/auth/profile?error=La contraseña actual es incorrecta');
        }

        const hashedNewPassword = await PasswordUtils.hashPassword(new_password);
        await db.execute('UPDATE usuarios SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        res.redirect('/auth/profile?message=Contraseña actualizada exitosamente');

    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        res.redirect('/auth/profile?error=Error interno del servidor al cambiar contraseña');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Forgot password request form
router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Recuperar Contraseña - A la Mesa',
        error: null,
        message: null
    });
});

// Handle forgot password request
router.post('/forgot-password', [
    body('email').isEmail().withMessage('Ingresa un email válido').trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/forgot-password', {
            title: 'Recuperar Contraseña - A la Mesa',
            error: errors.array()[0].msg,
            message: null
        });
    }

    const { email } = req.body;

    try {
        const [users] = await db.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (users.length === 0) {
            // Para evitar la enumeración de usuarios, siempre respondemos con éxito
            // pero no enviamos email si el usuario no existe.
            return res.render('auth/forgot-password', {
                title: 'Recuperar Contraseña - A la Mesa',
                message: 'Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.',
                error: null // Aseguramos que 'error' siempre esté definido
            });
        }

        const user = users[0];
        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hora de validez

        await db.execute(
            'UPDATE usuarios SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
            [token, expires, user.id]
        );

        const resetUrl = `http://${req.headers.host}/auth/reset-password/${token}`;

        await sendEmail(
            user.email,
            'Restablecer Contraseña - A la Mesa',
            'password-reset',
            {
                nombre: user.nombre,
                resetLink: resetUrl
            }
        );

        res.render('auth/forgot-password', {
            title: 'Recuperar Contraseña - A la Mesa',
            message: 'Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.',
            error: null // Aseguramos que 'error' siempre esté definido
        });

    } catch (error) {
        console.error('Error en forgot password:', error);
        res.render('auth/forgot-password', {
            title: 'Recuperar Contraseña - A la Mesa',
            error: 'Error interno del servidor al procesar la solicitud.',
            message: null
        });
    }
});

// Reset password form
router.get('/reset-password/:token', async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id FROM usuarios WHERE reset_password_token = ? AND reset_password_expires > NOW()',
            [req.params.token]
        );

        if (users.length === 0) {
            return res.render('auth/reset-password', {
                title: 'Restablecer Contraseña - A la Mesa',
                error: 'El token de restablecimiento de contraseña es inválido o ha expirado.',
                message: null,
                token: req.params.token // Pasar el token para que el formulario lo use
            });
        }

        res.render('auth/reset-password', {
            title: 'Restablecer Contraseña - A la Mesa',
            error: null,
            message: null,
            token: req.params.token
        });

    } catch (error) {
        console.error('Error en reset password GET:', error);
        res.render('auth/reset-password', {
            title: 'Restablecer Contraseña - A la Mesa',
            error: 'Error interno del servidor.',
            message: null,
            token: req.params.token
        });
    }
});

// Handle reset password
router.post('/reset-password/:token', [
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Las nuevas contraseñas no coinciden');
        }
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/reset-password', {
            title: 'Restablecer Contraseña - A la Mesa',
            error: errors.array()[0].msg,
            message: null,
            token: req.params.token
        });
    }

    try {
        const [users] = await db.execute(
            'SELECT id FROM usuarios WHERE reset_password_token = ? AND reset_password_expires > NOW()',
            [req.params.token]
        );

        if (users.length === 0) {
            return res.render('auth/reset-password', {
                title: 'Restablecer Contraseña - A la Mesa',
                error: 'El token de restablecimiento de contraseña es inválido o ha expirado.',
                message: null,
                token: req.params.token
            });
        }

        const user = users[0];
        const hashedPassword = await PasswordUtils.hashPassword(req.body.password);

        await db.execute(
            'UPDATE usuarios SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        res.redirect('/auth/login?message=Tu contraseña ha sido restablecida exitosamente. Ahora puedes iniciar sesión.');

    } catch (error) {
        console.error('Error en reset password POST:', error);
        res.render('auth/reset-password', {
            title: 'Restablecer Contraseña - A la Mesa',
            error: 'Error interno del servidor al restablecer la contraseña.',
            message: null,
            token: req.params.token
        });
    }
});

// Register driver page
router.get('/register-driver', (req, res) => {
    res.render('auth/register-driver', {
        title: 'Registrar Repartidor - A la Mesa',
        error: null,
        success: null
    });
});

// Handle driver registration
router.post('/register-driver', async (req, res, next) => {
    // Verificar si es una petición AJAX (usando headers personalizados)
    const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest' || 
                  (req.headers.accept && req.headers.accept.includes('application/json'));

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // Validar campos requeridos
        const { nombre, apellido, email, password, telefono, vehicle_type, registration_type, restaurant_id } = req.body;
        

        
        // Validar campos requeridos
        if (!nombre || nombre.trim() === '') {
            throw new Error('El campo nombre es requerido');
        }
        
        if (!apellido || apellido.trim() === '') {
            throw new Error('El campo apellido es requerido');
        }
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('El email no es válido');
        }
        
        if (!password || password.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres');
        }
        
        if (!vehicle_type) {
            throw new Error('El tipo de vehículo es requerido');
        }

        let restauranteId = null;
        let requestStatus = 'independent';

        if (registration_type === 'restaurant') {
            if (!restaurant_id) {
                throw new Error('El ID del restaurante es requerido para este tipo de registro.');
            }
            const [restaurants] = await connection.execute(
                'SELECT id FROM restaurantes WHERE id = ?',
                [restaurant_id]
            );

            if (restaurants.length === 0) {
                throw new Error('Restaurante no encontrado. Por favor, verifica el ID.');
            }
            restauranteId = restaurants[0].id;
            requestStatus = 'pending';
        }
        
        // Normalizar datos
        const nombreCompleto = `${nombre.trim()} ${apellido.trim()}`;
        const emailNormalizado = email.trim().toLowerCase();
        
        // Verificar si el email ya existe
        const [existingUsers] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [emailNormalizado]);
        if (existingUsers.length > 0) {
            throw new Error('El email ya está registrado');
        }
        
        // Hashear la contraseña
        const hashedPassword = await PasswordUtils.hashPassword(password);
        
        // Crear el usuario
        const [result] = await connection.execute(
            'INSERT INTO usuarios (nombre, apellido, email, password, telefono, tipo_usuario) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre.trim(), apellido.trim(), emailNormalizado, hashedPassword, telefono ? telefono.trim() : null, 'repartidor']
        );
        
        const userId = result.insertId;
        
        // Crear el perfil de repartidor
        await connection.execute(
            'INSERT INTO drivers (user_id, vehicle_type, status, restaurante_id, request_status) VALUES (?, ?, "offline", ?, ?)',
            [userId, vehicle_type, restauranteId, requestStatus]
        );
        
        await connection.commit();
        connection.release();
        
        // Respuesta exitosa
        let successMessage = 'Registro exitoso. Por favor inicia sesión.';
        if (requestStatus === 'pending') {
            successMessage = 'Solicitud de registro enviada. Espera la aprobación del restaurante.';
        }

        if (isAjax) {
            return res.status(200).json({
                success: true,
                message: successMessage,
                redirect: '/auth/login'
            });
        }
        
        return res.render('auth/login', {
            title: 'Iniciar Sesión - A la Mesa',
            error: null,
            success: successMessage
        });
        
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error en el registro de repartidor:', error);
        
        if (isAjax) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Error en el registro. Por favor intenta de nuevo.'
            });
        }
        
        return res.render('auth/register-driver', {
            title: 'Registro de Repartidor - A la Mesa',
            error: error.message || 'Error en el registro. Por favor intenta de nuevo.',
            success: null
        });
    }
});

// Endpoint para obtener el estado del banner push
router.get('/push-banner-status', async (req, res) => {
  if (!req.session.user || req.session.user.tipo_usuario !== 'cliente') {
    return res.json({ closed: true }); // No mostrar a no clientes
  }
  // Verificar si tiene suscripción push activa
  const [subs] = await db.execute('SELECT id FROM push_subscriptions WHERE usuario_id = ? AND tipo_usuario = "cliente" AND activo = 1', [req.session.user.id]);
  if (subs.length > 0) {
    return res.json({ closed: true }); // Ya tiene notificaciones activadas
  }
  const [rows] = await db.execute('SELECT push_banner_closed FROM usuarios WHERE id = ?', [req.session.user.id]);
  res.json({ closed: !!rows[0]?.push_banner_closed });
});

// Endpoint para actualizar el estado del banner push
router.post('/push-banner-status', async (req, res) => {
  if (!req.session.user || req.session.user.tipo_usuario !== 'cliente') {
    return res.status(403).json({ success: false });
  }
  const { closed } = req.body;
  await db.execute('UPDATE usuarios SET push_banner_closed = ? WHERE id = ?', [closed ? 1 : 0, req.session.user.id]);
  res.json({ success: true });
});

module.exports = router;
