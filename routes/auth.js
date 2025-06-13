const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const db = require('../config/database');

// Middleware to check if user is logged in
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/login', {
    title: 'Iniciar Sesión - A la Mesa',
    error: null
  });
});

// Login process
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('La contraseña es requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Iniciar Sesión - A la Mesa',
        error: 'Por favor, verifica los datos ingresados'
      });
    }

    const { email, password } = req.body;

    // Find user
    const [users] = await db.execute(
      'SELECT * FROM usuarios WHERE email = ? AND activo = 1',
      [email]
    );

    if (users.length === 0) {
      return res.render('auth/login', {
        title: 'Iniciar Sesión - A la Mesa',
        error: 'Email o contraseña incorrectos'
      });
    }

    const user = users[0];
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.render('auth/login', {
        title: 'Iniciar Sesión - A la Mesa',
        error: 'Email o contraseña incorrectos'
      });
    }

    // Create session
    const sessionData = {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      tipo_usuario: user.tipo_usuario,
      imagen_perfil: user.imagen_perfil
    };
    
    req.session.user = sessionData;

    // Redirect based on user type
    if (user.tipo_usuario === 'restaurante') {
      res.redirect('/dashboard');
    } else if (user.tipo_usuario === 'admin') {
      res.redirect('/admin');
    } else {
      res.redirect('/');
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.render('auth/login', {
      title: 'Iniciar Sesión - A la Mesa',
      error: 'Error interno del servidor'
    });
  }
});

// Register page
router.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register', {
    title: 'Registrarse - A la Mesa',
    error: null,
    success: null
  });
});

// Register process
router.post('/register', [
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('apellido').notEmpty().withMessage('El apellido es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('telefono').optional().isLength({ min: 7 }).withMessage('Teléfono debe tener al menos 7 dígitos'),
  body('ciudad').notEmpty().withMessage('La ciudad es requerida')
      .isLength({ min: 2, max: 50 }).withMessage('La ciudad debe tener entre 2 y 50 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Registrarse - A la Mesa',
        error: 'Por favor, verifica los datos ingresados',
        success: null
      });
    }

    const { nombre, apellido, email, password, telefono, ciudad } = req.body;

    // Check if email already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.render('auth/register', {
        title: 'Registrarse - A la Mesa',
        error: 'Este email ya está registrado',
        success: null
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert user
    const [result] = await db.execute(
      `INSERT INTO usuarios (nombre, apellido, email, password, telefono, ciudad, tipo_usuario) 
       VALUES (?, ?, ?, ?, ?, ?, 'cliente')`,
      [nombre, apellido, email, hashedPassword, telefono || null, ciudad]
    );

    // Auto login
    req.session.user = {
      id: result.insertId,
      nombre,
      apellido,
      email,
      tipo_usuario: 'cliente'
    };

    res.redirect('/');
  } catch (error) {
    console.error('Error en registro:', error);
    res.render('auth/register', {
      title: 'Registrarse - A la Mesa',
      error: 'Error interno del servidor',
      success: null
    });
  }
});

// Restaurant register page
router.get('/register-restaurant', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register-restaurant', {
    title: 'Registrar Restaurante - A la Mesa',
    error: null,
    success: null
  });
});

// Restaurant register process
router.post('/register-restaurant', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      nombre, apellido, email, telefono, ciudad,
      password, restaurante_nombre, restaurante_descripcion,
      restaurante_direccion, restaurante_telefono,
      categoria_id, horario_apertura, horario_cierre
    } = req.body;

    // Validación básica
    if (!nombre || !apellido || !email || !password || !restaurante_nombre || !restaurante_descripcion || !restaurante_direccion) {
      throw new Error('Todos los campos marcados con * son obligatorios');
    }

    // Validar longitud mínima de la descripción
    if (restaurante_descripcion.length < 20) {
      throw new Error('La descripción del restaurante debe tener al menos 20 caracteres');
    }

    // Verificar si el email ya existe
    const [existingUsers] = await connection.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      throw new Error('El email ya está registrado');
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Asegurar que ciudad tenga un valor válido
    const ciudadFinal = ciudad?.trim() || 'Ciudad Autónoma de Buenos Aires';

    // Insert user
    const [userResult] = await connection.execute(
      `INSERT INTO usuarios (
        nombre, apellido, email, password, telefono,
        ciudad, tipo_usuario, activo
      ) VALUES (?, ?, ?, ?, ?, ?, 'restaurante', 1)`,
      [
        nombre.trim(),
        apellido.trim(),
        email.trim(),
        hashedPassword,
        telefono ? telefono.trim() : null,
        ciudadFinal
      ]
    );

    const userId = userResult.insertId;

    // Insert restaurant
    const insertRestaurantQuery = `
      INSERT INTO restaurantes (
        usuario_id, nombre, descripcion, direccion, 
        ciudad, telefono, email_contacto, horario_apertura, 
        horario_cierre, activo, verificado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `;

    const restaurantParams = [
      userId,
      restaurante_nombre.trim(),
      restaurante_descripcion.trim(),
      restaurante_direccion.trim(),
      ciudadFinal.trim(),
      restaurante_telefono ? restaurante_telefono.trim() : null,
      email.trim(),
      horario_apertura || null,
      horario_cierre || null
    ];

    await connection.execute(insertRestaurantQuery, restaurantParams);

    // Insert restaurant category
    if (categoria_id) {
      await connection.execute(
        'INSERT INTO restaurantes_categorias (restaurante_id, categoria_id) VALUES (?, ?)',
        [userResult.insertId, categoria_id]
      );
    }

    await connection.commit();

    // Crear sesión
    req.session.userId = userId;
    req.session.tipoUsuario = 'restaurante';
    req.session.nombre = nombre;

    res.redirect('/dashboard/');

  } catch (error) {
    await connection.rollback();
    console.error('Error en el registro del restaurante:', {
      error: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState
    });
    res.render('auth/register-restaurant', {
      error: error.message,
      formData: req.body
    });
  } finally {
    connection.release();
  }
});

// Profile page
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Get user info
        const [users] = await db.execute(`
            SELECT id, nombre, apellido, email, telefono, fecha_registro
            FROM usuarios
            WHERE id = ?
        `, [userId]);
        
        if (users.length === 0) {
            return res.redirect('/auth/login');
        }
        
        const user = users[0];
        
        // Get recent orders
        const [orders] = await db.execute(`
            SELECT p.*, r.nombre as restaurante_nombre, r.imagen_logo,
                   COUNT(ip.id) as total_items
            FROM pedidos p
            JOIN restaurantes r ON p.restaurante_id = r.id
            LEFT JOIN items_pedido ip ON p.id = ip.pedido_id
            WHERE p.cliente_id = ?
            GROUP BY p.id
            ORDER BY p.fecha_pedido DESC
            LIMIT 5
        `, [userId]);
        
        res.render('auth/profile', {
            title: 'Mi Perfil - A la Mesa',
            user,
            orders,
            scripts: ['/js/profile.js']
        });
        
    } catch (error) {
        console.error('Error cargando perfil:', error);
        res.render('error', {
            title: 'Error',
            message: 'Error cargando el perfil',
            error: {}
        });
    }
});

// Update profile
router.post('/profile', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { nombre, apellido, email, telefono, password, confirmPassword } = req.body;
        
        // Validate required fields
        if (!nombre || !apellido || !email) {
            return res.json({
                success: false,
                message: 'Por favor, completa todos los campos requeridos'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({
                success: false,
                message: 'Por favor, ingresa un email válido'
            });
        }
        
        // Check if email is already taken by another user
        const [existingUsers] = await db.execute(`
            SELECT id FROM usuarios 
            WHERE email = ? AND id != ?
        `, [email, userId]);
        
        if (existingUsers.length > 0) {
            return res.json({
                success: false,
                message: 'El email ya está registrado por otro usuario'
            });
        }
        
        // Start building update query
        let updateFields = ['nombre = ?', 'apellido = ?', 'email = ?'];
        let params = [nombre, apellido, email];
        
        // Add phone if provided
        if (telefono) {
            updateFields.push('telefono = ?');
            params.push(telefono);
        }
        
        // Add password if provided
        if (password) {
            if (password !== confirmPassword) {
                return res.json({
                    success: false,
                    message: 'Las contraseñas no coinciden'
                });
            }
            
            if (password.length < 6) {
                return res.json({
                    success: false,
                    message: 'La contraseña debe tener al menos 6 caracteres'
                });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push('password = ?');
            params.push(hashedPassword);
        }
        
        // Update user
        await db.execute(`
            UPDATE usuarios 
            SET ${updateFields.join(', ')}
            WHERE id = ?
        `, [...params, userId]);
        
        // Update session
        req.session.user = {
            ...req.session.user,
            nombre,
            apellido,
            email
        };
        
        res.json({
            success: true,
            message: 'Perfil actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.json({
            success: false,
            message: 'Error actualizando el perfil'
        });
    }
});

module.exports = router;