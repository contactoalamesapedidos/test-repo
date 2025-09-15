const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const multer = require('multer');
const logger = require('./utils/logger');
require('dotenv').config();

// Security imports
const {
    csrfProtection,
    setCSRFToken,
    sanitizeInput,
    authRateLimit,
    apiRateLimit,
    fileUploadRateLimit,
    authSlowDown,
    validateFileUpload,
    setCSP,
    SecurityLogger
} = require('./middleware/security');
const { SecurityAuditUtils } = require('./utils/security');

// Database connection
const db = require('./config/database');

// Category icons utility
const { getCategoryIcon, getCategoryImagePath } = require('./utils/categoryIcons');

const cartMiddleware = require('./middleware/cart')(db);

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Make io accessible to routes
app.set('io', io);

// Middleware
app.disable('x-powered-by');
// Con proxies (Heroku/Vercel/Nginx) para cookies seguras y detección de HTTPS
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // mantener desactivado si hay inline scripts
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Disable other potentially problematic headers for local development
  hsts: false,
  noSniff: false,
  xssFilter: false,
}));
app.use(compression());

// Configuración de body parsers con límites
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 50000, // Aumentado para evitar errores de 'too many parameters'
  depth: 20, // Aumentado para evitar errores de 'exceeded the depth'
  type: 'application/x-www-form-urlencoded' // Solo URL-encoded, dejar multipart para multer
}));

// HPP (HTTP Parameter Pollution)
app.use(hpp());

// CORS (permitir orígenes configurables)
const allowOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Agregar ngrok automáticamente si estamos en desarrollo
if (process.env.NODE_ENV !== 'production') {
  // Permitir ngrok (patrón común de ngrok)
  allowOrigins.push(/^https:\/\/[a-z0-9]+\.ngrok-free\.app$/);
  allowOrigins.push(/^https:\/\/[a-z0-9]+\.ngrok\.app$/);
  // Permitir localhost para desarrollo
  allowOrigins.push(/^http:\/\/localhost:\d+$/);
  allowOrigins.push(/^https:\/\/localhost:\d+$/);
}



app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);

    // Verificar si el origin está en la lista permitida
    const isAllowed = allowOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn('[CORS] Origin bloqueado', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true, // IMPORTANTE: permitir cookies
  optionsSuccessStatus: 200 // Para legacy browsers
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
// Servir uploads con cabeceras seguras y cacheo controlado
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 días
  }
}));

// Configuración de logging (después de servir archivos estáticos)
app.use(morgan('dev')); // Logging estándar

// Middleware para manejar respuestas AJAX
app.use((req, res, next) => {
    // Guardar referencia al método render original
    const _render = res.render;
    
    // Sobrescribir el método render
    res.render = function(view, options, callback) {
        // Verificar si es una petición AJAX
        const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest' || 
                      (req.headers.accept && req.headers.accept.includes('application/json'));
        
        if (isAjax) {
            // Si es AJAX, devolver JSON en lugar de renderizar la vista
            const error = options.error || 'Error en la solicitud';
            return res.status(400).json({ 
                success: false, 
                message: error 
            });
        }
        
        // Si no es AJAX, continuar con el render normal
        _render.call(this, view, options, callback);
    };
    
    next();
});


// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Layout setup
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Session configuration
const sessionConfig = {
  key: 'alamesa_session',
  secret: process.env.SESSION_SECRET || 'tu_secreto_de_session_super_seguro',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }
};

// Solo configurar el store de MySQL si tenemos credenciales
if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
  sessionConfig.store = new MySQLStore({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  });
}

app.use(session(sessionConfig));

// Security middlewares - applied in correct order
app.use(setCSRFToken); // Set CSRF token for all requests
app.use(sanitizeInput); // Sanitize all input data

// Only apply CSP in production to avoid blocking local development
if (process.env.NODE_ENV === 'production') {
    app.use(setCSP); // Set Content Security Policy
}

// Security audit middleware
app.use((req, res, next) => {
  // Log security events for sensitive operations (solo en desarrollo o con configuración específica)
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_SECURITY_EVENTS === 'true') {
      SecurityAuditUtils.logSecurityEvent('api_request', {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent')
      }, req).catch(err => logger.error('[SECURITY] Audit error', { error: err.message }));
    }
  }
  next();
});

// Middleware global para exponer el usuario en todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.user;
  next();
});

// Middleware para currentPath en todas las vistas
app.use((req, res, next) => {
  res.locals.currentPath = req.originalUrl;
  next();
});

// Cart middleware
app.use(cartMiddleware);

// Forzar HTTPS en producción y añadir headers de seguridad
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isSecure) {
      const host = req.headers.host;
      const httpsUrl = `https://${host}${req.url}`;
      return res.redirect(301, httpsUrl);
    }
    // HSTS (6 meses)
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  // Headers de seguridad adicionales
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Rate limiting & slow down - using enhanced security versions
const authLimiter = authRateLimit;
const apiLimiter = apiRateLimit;

// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const cartRoutes = require('./routes/cart');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews');
const cartSidebarTemplateRoutes = require('./routes/cartSidebarTemplate');
const { router: pushRoutes } = require('./routes/push');
const driverRoutes = require('./routes/drivers'); // New import
const apiRoutes = require('./routes/api');

// Debug route for push notifications
app.get('/push-debug', (req, res) => {
    res.render('push-debug', {
        title: 'Debug Push Notifications - A la Mesa',
        user: req.session.user || null
    });
});

// Limitador para métodos que mutan estado
const mutateLimiter = (req, res, next) => {
  const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (methods.includes(req.method)) {
    return apiLimiter(req, res, next);
  }
  return next();
};
app.use(mutateLimiter);

app.use('/', indexRoutes);
// Rate limit y slow down para autenticación
app.use('/auth', authSlowDown, authLimiter, authRoutes);
app.use('/restaurants', restaurantRoutes);
app.use('/products', productRoutes);
// Redirigir /orders a /orders/
app.get('/orders', (req, res) => {
  res.redirect('/orders/');
});

app.use('/orders', orderRoutes);
app.use('/cart', cartRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/repartidores', driverRoutes); // New use statement
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);
app.use('/reviews', reviewRoutes);
app.use('/cart', cartSidebarTemplateRoutes);
// Rate limit para APIs
app.use('/api/push', apiLimiter, pushRoutes);
app.use('/api', apiRoutes);

// Redirigir /profile a /auth/profile
app.get('/profile', (req, res) => {
    res.redirect('/auth/profile');
});

// Socket.IO for real-time features
io.on('connection', (socket) => {
  // Join restaurant room for notifications
  socket.on('join-restaurant', (restaurantId) => {
    socket.join(`restaurant-${restaurantId}`);
  });

  // Join user room for order updates
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
  });
  
  // Join order room for driver location updates
  socket.on('join-order-updates', async ({ orderId }) => {
    if (!orderId) {
      console.error('Intento de unirse a actualizaciones sin orderId');
      return;
    }
    
    try {
      // Verificar que el pedido existe y obtener información relevante
      const [order] = await db.query('SELECT id, repartidor_id, estado FROM pedidos WHERE id = ?', [orderId]);
      
      if (!order || order.length === 0) {
        console.error(`Pedido ${orderId} no encontrado`);
        return;
      }
      
      socket.join(`order-${orderId}`);
      
      // Enviar la última ubicación conocida del repartidor si está disponible
      if (order[0].repartidor_id && order[0].estado === 'en_camino') {
        const [driver] = await db.query(
          'SELECT d.current_latitude as latitude, d.current_longitude as longitude FROM drivers d WHERE d.user_id = ?',
          [order[0].repartidor_id]
        );

        if (driver && driver[0] && driver[0].latitude && driver[0].longitude) {
          socket.emit('driver-location-update', {
            orderId,
            driverId: order[0].repartidor_id,
            latitude: parseFloat(driver[0].latitude),
            longitude: parseFloat(driver[0].longitude),
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error al unirse a actualizaciones del pedido:', error);
    }
  });
  
  // Handle driver location updates
  socket.on('update-driver-location', async (data) => {
    try {
      const { orderId, driverId, latitude, longitude } = data;

      // Validar datos básicos
      if (latitude === undefined || longitude === undefined) {
        console.error('Datos de ubicación inválidos:', data);
        return;
      }



      // Si tenemos driverId, actualizar la ubicación del repartidor en la tabla drivers
      if (driverId) {
        const [result] = await db.query(
          'UPDATE drivers SET current_latitude = ?, current_longitude = ? WHERE user_id = ?',
          [latitude, longitude, driverId]
        );

        // Si tenemos orderId específico, enviar actualización a ese pedido
        if (orderId) {
          io.to(`order-${orderId}`).emit('driver-location-update', {
            orderId,
            driverId,
            latitude,
            longitude,
            timestamp: new Date()
          });
        } else {
          // Si no tenemos orderId específico, buscar pedidos activos de este repartidor
          const [activeOrders] = await db.query(
            'SELECT id FROM pedidos WHERE repartidor_id = ? AND estado = "en_camino"',
            [driverId]
          );

          if (activeOrders.length > 0) {
            // Enviar actualización a todos los pedidos activos de este repartidor
            for (const order of activeOrders) {
              io.to(`order-${order.id}`).emit('driver-location-update', {
                orderId: order.id,
                driverId,
                latitude,
                longitude,
                timestamp: new Date()
              });


            }
          }
        }
      }
      // Si no tenemos ni orderId ni driverId, intentar buscar por socket ID o algo más
      else {
        // No hay acción específica para este caso
      }

    } catch (error) {
      console.error('Error actualizando ubicación del repartidor:', error);
    }
  });

  // New order notification
  socket.on('new-order', (data) => {
    io.to(`restaurant-${data.restaurantId}`).emit('new-order-notification', data);
  });

  // Order status update
  socket.on('order-status-update', (data) => {
    io.to(`user-${data.userId}`).emit('order-status-changed', data);
  });

  socket.on('disconnect', () => {
    // User disconnected
  });

  // CHAT DE PEDIDOS
  socket.on('join-order-chat', async (data) => {
    const { orderId, userId, userType } = data;
    const roomName = `order-${orderId}`;
    socket.join(roomName);

    // Cargar historial de mensajes al unirse a la sala
    try {
        // Verificar si la tabla existe antes de consultar
        const [tables] = await db.execute(`
            SELECT TABLE_NAME
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'mensajes_pedido'
        `);

        if (tables.length === 0) {
            // La tabla no existe, crearla
            await db.execute(`
                CREATE TABLE IF NOT EXISTS mensajes_pedido (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    pedido_id INT NOT NULL,
                    remitente_tipo ENUM('cliente', 'restaurante', 'admin') NOT NULL,
                    remitente_id INT NOT NULL,
                    mensaje TEXT NOT NULL,
                    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (pedido_id),
                    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            // Enviar historial vacío
            socket.emit('chat-history', { orderId, messages: [] });
            return;
        }

        const [messages] = await db.execute(`
            SELECT mp.*,
                   CASE
                       WHEN mp.remitente_tipo = 'cliente' THEN u.nombre
                       WHEN mp.remitente_tipo = 'restaurante' THEN r.nombre
                       WHEN mp.remitente_tipo = 'admin' THEN ua.nombre
                       ELSE 'Desconocido'
                   END as remitente_nombre
            FROM mensajes_pedido mp
            LEFT JOIN usuarios u ON mp.remitente_id = u.id AND mp.remitente_tipo = 'cliente'
            LEFT JOIN restaurantes r ON mp.remitente_id = r.usuario_id AND mp.remitente_tipo = 'restaurante'
            LEFT JOIN usuarios ua ON mp.remitente_id = ua.id AND mp.remitente_tipo = 'admin'
            WHERE pedido_id = ?
            ORDER BY fecha_envio ASC
        `, [orderId]);

        socket.emit('chat-history', { orderId, messages });
    } catch (error) {
        console.error('Error al cargar el historial de chat:', error);
        // Enviar respuesta de error para que el cliente pueda manejarlo
        socket.emit('chat-history', { orderId, error: true, message: 'Error al cargar el historial' });
    }
  });

  socket.on('send-chat-message', async (data) => {
    const { orderId, userId, userType, message } = data;
    const roomName = `order-${orderId}`;

    if (!orderId || !userId || !userType || !message) {
      console.error('Datos incompletos para enviar mensaje:', data);
      return;
    }

    try {
      // Verificar si la tabla existe
      const [tables] = await db.execute(`
          SELECT TABLE_NAME
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'mensajes_pedido'
      `);

      if (tables.length === 0) {
          // La tabla no existe, crearla
          await db.execute(`
              CREATE TABLE IF NOT EXISTS mensajes_pedido (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  pedido_id INT NOT NULL,
                  remitente_tipo ENUM('cliente', 'restaurante', 'admin') NOT NULL,
                  remitente_id INT NOT NULL,
                  mensaje TEXT NOT NULL,
                  fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX (pedido_id),
                  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `);
      }

      let senderName;
      let normalizedUserType = userType; // Default to original userType

      // Normalize userType to match enum values if necessary
      if (userType === 'restaurante') {
        normalizedUserType = 'restaurante';
      } else if (userType === 'cliente') {
        normalizedUserType = 'cliente';
      } else if (userType === 'admin') {
        normalizedUserType = 'admin';
      }

      if (userType === 'cliente') {
        const [user] = await db.execute('SELECT nombre FROM usuarios WHERE id = ?', [userId]);
        senderName = user.length > 0 ? user[0].nombre : 'Cliente';
      } else if (userType === 'restaurante') {
        const [restaurant] = await db.execute('SELECT nombre FROM restaurantes WHERE usuario_id = ?', [userId]);
        senderName = restaurant.length > 0 ? restaurant[0].nombre : 'Restaurante';
      } else if (userType === 'admin') {
        const [adminUser] = await db.execute('SELECT nombre FROM usuarios WHERE id = ?', [userId]);
        senderName = adminUser.length > 0 ? adminUser[0].nombre : 'Admin';
      } else {
        senderName = 'Desconocido';
      }

      // Guardar mensaje en la base de datos
      const [result] = await db.execute(`
        INSERT INTO mensajes_pedido (pedido_id, remitente_tipo, remitente_id, mensaje)
        VALUES (?, ?, ?, ?)
      `, [orderId, normalizedUserType, userId, message]);

      const newMessage = {
        id: result.insertId,
        pedido_id: orderId,
        remitente_tipo: normalizedUserType,
        remitente_id: userId,
        mensaje: message,
        fecha_envio: new Date(),
        remitente_nombre: senderName
      };

      // Emitir el mensaje a todos en la sala del pedido
      io.to(roomName).emit('chat-message', { orderId, message: newMessage });

      // Enviar confirmación de envío exitoso al emisor
      socket.emit('message-sent', {
        orderId,
        messageId: result.insertId,
        message: 'Mensaje enviado exitosamente'
      });

      // Opcional: Notificar al otro lado (cliente/restaurante) si no están en la sala
      // Esto podría requerir lógica adicional para saber quién está en línea

    } catch (error) {
      console.error('Error al guardar o emitir mensaje de chat:', error);
      // Notificar al emisor que hubo un error
      socket.emit('chat-error', {
          orderId,
          error: true,
          message: 'Error al enviar el mensaje'
      });
    }
  });


});

// Middleware para manejar respuestas AJAX
app.use((req, res, next) => {
  // Guardar el método render original
  const originalRender = res.render;
  
  // Sobrescribir el método render
  res.render = function(view, options, callback) {
    // Verificar si es una petición AJAX
    const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest' || 
                  (req.headers.accept && req.headers.accept.includes('application/json')) ||
                  req.is('application/json');
    
    if (isAjax) {
      // Si es AJAX, devolver un error JSON
      return res.status(500).json({
        success: false,
        message: 'Error en el servidor al procesar la solicitud'
      });
    }
    
    // Si no es AJAX, continuar con el render normal
    return originalRender.call(this, view, options, callback);
  };
  
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error en el servidor', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method
  });
  
  // Verificar si es una petición AJAX
  const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest' || 
                (req.headers.accept && req.headers.accept.includes('application/json')) ||
                req.is('application/json');
  
  // Si es AJAX, responder con JSON
  if (isAjax) {
    // Mapear errores comunes a códigos de estado HTTP
    let statusCode = 500;
    let message = 'Error interno del servidor';
    
    if (err.status === 404) {
      statusCode = 404;
      message = 'Recurso no encontrado';
    } else if (err.name === 'ValidationError') {
      statusCode = 400;
      message = err.message || 'Error de validación de datos';
    } else if (err.name === 'UnauthorizedError') {
      statusCode = 401;
      message = 'No autorizado';
    } else if (err.code === 'ER_DUP_ENTRY') {
      statusCode = 409;
      message = 'El registro ya existe';
    }
    
    return res.status(statusCode).json({
      success: false,
      message: message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  
  // Si no es AJAX, continuar con el manejo de errores normal
  
  // Si es un error 404, renderizar la página de error 404
  if (err.status === 404) {
    return res.status(404).render('error/404', {
      title: 'Página no encontrada',
      error: err.message || 'La página que estás buscando no existe.'
    });
  }
  
  // Si es un error de validación, mostrar el mensaje de error
  if (err.name === 'ValidationError') {
    return res.status(400).render('error/400', {
      title: 'Error de validación',
      error: err.message || 'Error de validación de datos.'
    });
  }
  
  // Para errores de autenticación
  if (err.name === 'UnauthorizedError') {
    return res.status(401).render('error/401', {
      title: 'No autorizado',
      error: err.message || 'No tienes permiso para acceder a este recurso.'
    });
  }
  
  // Para errores de base de datos
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).render('error/400', {
      title: 'Error de duplicado',
      error: 'El registro ya existe en la base de datos.'
    });
  }
  
  // Para otros errores, renderizar la página de error 500
  res.status(500).render('error/500', {
    title: 'Error del servidor',
    user: req.session && req.session.user ? req.session.user : null,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Ha ocurrido un error en el servidor.'
  });
});

// 404 handler
app.use((req, res) => {
  const user = req.session && req.session.user ? req.session.user : null;

  res.status(404).render('error-404', {
    title: 'Página No Encontrada - A la Mesa',
    user: user
  });
});

const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;

server.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor A la Mesa corriendo en http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

app.locals.getCategoryIcon = getCategoryIcon;
app.locals.getCategoryImagePath = getCategoryImagePath;
