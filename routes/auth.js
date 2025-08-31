const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/databasePool');
const { transporter, sendEmail } = require('../config/mailer');
const crypto = require('crypto');
const { requireAuth, requireGuest, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

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
    body('email').isEmail().withMessage('Email inválido').trim(),
    body('password').isLength({ min: 1 }).withMessage('La contraseña es requerida').trim(),
    body('remember').optional().toBoolean()
], async (req, res) => {
    // Deshabilitar temporalmente la protección contra fuerza bruta
    console.log('Intento de login (protección deshabilitada):', req.body.email);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.redirect('/auth/login?error=Email o contraseña incorrectos');
    }

    const { email, password, remember } = req.body;

    try {
        // Buscar usuario con email exacto primero
        console.log('[AUTH] Buscando usuario con email exacto:', email);
        
        let [users] = await db.execute(
            'SELECT * FROM usuarios WHERE email = ?', 
            [email]
        );
        
        // Si no se encuentra, buscar sin distinguir mayúsculas/minúsculas
        if (users.length === 0) {
            console.log('[AUTH] No se encontró con email exacto, intentando búsqueda insensible a mayúsculas');
            [users] = await db.execute(
                'SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))', 
                [email]
            );
        }

        console.log('[AUTH] Resultados de búsqueda:', users.length, 'usuarios encontrados');
        if (users.length > 0) {
            console.log('[AUTH] Primer usuario encontrado:', {
                id: users[0].id,
                email: users[0].email,
                tipo_usuario: users[0].tipo_usuario,
                password_length: users[0].password ? users[0].password.length : 'null'
            });
        }

        if (users.length === 0) {
            return res.redirect('/auth/login?error=Email o contraseña incorrectos');
        }

        const user = users[0];

        console.log('=== DEBUG INICIO DE SESIÓN ===');
        console.log(`[AUTH] Email proporcionado: ${email}`);
        console.log(`[AUTH] Usuario encontrado en DB:`, {
            id: user.id,
            email: user.email,
            tipo_usuario: user.tipo_usuario,
            password_length: user.password ? user.password.length : 'null',
            password_start: user.password ? user.password.substring(0, 10) + '...' : 'null',
            password_ends_with: user.password ? '...' + user.password.substring(-10) : 'null'
        });
        
        console.log(`[AUTH] Comparando contraseñas...`);
        console.log(`[AUTH] Contraseña proporcionada: '${password}'`);
        console.log(`[AUTH] Hash almacenado: ${user.password.substring(0, 10)}...${user.password.substring(-10)}`);
        
        // Verificar si el hash parece ser un hash bcrypt válido
        const isBcryptHash = /^\$2[ayb]\$\d{2}\$[./0-9A-Za-z]{53}$/.test(user.password);
        console.log(`[AUTH] ¿El hash parece ser un hash bcrypt válido?: ${isBcryptHash}`);
        
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`[AUTH] Resultado de bcrypt.compare(): ${isMatch}`);
        
        // Si falla, intentar con una contraseña alternativa común
        if (!isMatch && password === '123456') {
            console.log('[AUTH] Probando con contraseña alternativa...');
            const testHash = await bcrypt.hash('123456', 10);
            console.log(`[AUTH] Hash generado para '123456': ${testHash.substring(0, 10)}...`);
            console.log(`[AUTH] Comparando con hash almacenado: ${testHash === user.password}`);
        }

        if (!isMatch) {
            console.log('[AUTH] Error: La contraseña no coincide');
            return res.redirect('/auth/login?error=Email o contraseña incorrectos');
        }
        
        console.log('[AUTH] Contraseña válida, creando sesión...');

        console.log(`[AUTH] Usuario ${user.email} autenticado. Tipo de usuario de DB: ${user.tipo_usuario}`);

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

        console.log(`[AUTH] Tipo de usuario guardado en sesión: ${req.session.user.tipo_usuario}`);

        if (remember) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        } else {
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
        }

        // Redirigir según el tipo de usuario
        if (user.tipo_usuario === 'restaurante' || user.tipo_usuario === 'admin') {
            res.redirect('/dashboard');
        } else {
            res.redirect('/');
        }

    } catch (error) {
        console.error('Error en el login:', error);
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

        const hashedPassword = await bcrypt.hash(password, 10);

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

        const hashedPassword = await bcrypt.hash(password, 10);

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

// Register driver page
router.get('/register-driver', (req, res) => {
    res.render('auth/register-driver', {
        title: 'Registrar Repartidor - A la Mesa',
        error: null,
        success: null
    });
});

// Handle driver registration
router.post('/register-driver', [
    body('nombre_apellido').trim().notEmpty().withMessage('El nombre y apellido son requeridos'),
    body('email').isEmail().withMessage('Email inválido').trim(),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('vehicle_type').notEmpty().withMessage('El tipo de vehículo es requerido'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/register-driver', {
            title: 'Registro de Repartidor - A la Mesa',
            error: errors.array()[0].msg,
            success: ''
        });
    }

    const { nombre_apellido, email, password, telefono, ciudad, vehicle_type } = req.body;
    const [nombre, ...apellido_parts] = nombre_apellido.split(' ');
    const apellido = apellido_parts.join(' ');

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existingUsers] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            await connection.rollback();
            return res.render('auth/register-driver', {
                title: 'Registrar Repartidor - A la Mesa',
                error: 'El email ya está registrado',
                success: null
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [userResult] = await connection.execute(
            'INSERT INTO usuarios (nombre, apellido, email, password, telefono, ciudad, tipo_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nombre, apellido, email, hashedPassword, telefono || null, ciudad || '', 'repartidor']
        );

        const userId = userResult.insertId;

        await connection.execute(
            'INSERT INTO drivers (user_id, vehicle_type, status) VALUES (?, ?, ?)',
            [userId, vehicle_type, 'offline'] // Por defecto, el repartidor inicia offline
        );

        await connection.commit();

        res.redirect('/auth/login?message=Registro de repartidor exitoso. Ahora puedes iniciar sesión.');

    } catch (error) {
        await connection.rollback();
        console.error('Error en el registro de repartidor:', error);
        res.render('auth/register-driver', {
            title: 'Registrar Repartidor - A la Mesa',
            error: 'Error interno del servidor al registrar repartidor',
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
        console.log('Usuario obtenido de la BD:', users[0]);
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

    console.log('Datos recibidos en actualización:', { nombre, apellido, email, telefono, ciudad, direccion });

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

        console.log('Usuario actualizado en la BD. Verificando...');
        const [updatedUser] = await db.execute('SELECT * FROM usuarios WHERE id = ?', [userId]);
        const user = updatedUser[0];
        console.log('Datos después de actualizar:', user);

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

        const isMatch = await bcrypt.compare(current_password, user.password);
        if (!isMatch) {
            return res.redirect('/auth/profile?error=La contraseña actual es incorrecta');
        }

        const hashedNewPassword = await bcrypt.hash(new_password, 10);
        console.log(`[AUTH] Actualizando contraseña para el usuario ID: ${userId}`);
        console.log(`[AUTH] Nuevo hash de contraseña: ${hashedNewPassword}`);
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
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

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
router.post('/register-driver', [
    body('nombre_apellido').trim().notEmpty().withMessage('El nombre y apellido son requeridos'),
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('vehicle_type').notEmpty().withMessage('El tipo de vehículo es requerido'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('auth/register-driver', {
            title: 'Registro de Repartidor - A la Mesa',
            error: errors.array()[0].msg,
            success: ''
        });
    }

    const { nombre_apellido, email, password, telefono, ciudad, vehicle_type } = req.body;
    const [nombre, ...apellido_parts] = nombre_apellido.split(' ');
    const apellido = apellido_parts.join(' ');

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existingUsers] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            await connection.rollback();
            return res.render('auth/register-driver', {
                title: 'Registrar Repartidor - A la Mesa',
                error: 'El email ya está registrado',
                success: null
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [userResult] = await connection.execute(
            'INSERT INTO usuarios (nombre, apellido, email, password, telefono, ciudad, tipo_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nombre, apellido, email, hashedPassword, telefono || null, ciudad || '', 'repartidor']
        );

        const userId = userResult.insertId;

        await connection.execute(
            'INSERT INTO drivers (user_id, vehicle_type, status) VALUES (?, ?, ?)',
            [userId, vehicle_type, 'offline'] // Por defecto, el repartidor inicia offline
        );

        await connection.commit();

        res.redirect('/auth/login?message=Registro de repartidor exitoso. Ahora puedes iniciar sesión.');

    } catch (error) {
        await connection.rollback();
        console.error('Error en el registro de repartidor:', error);
        res.render('auth/register-driver', {
            title: 'Registrar Repartidor - A la Mesa',
            error: 'Error interno del servidor al registrar repartidor',
            success: null
        });
    } finally {
        connection.release();
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