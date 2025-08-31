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
require('dotenv').config();

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
}));
app.use(compression());

// Configuración de body parsers con límites
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// HPP (HTTP Parameter Pollution)
app.use(hpp());

// CORS (permitir orígenes configurables)
const allowOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowOrigins.length ? allowOrigins : undefined,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
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

// Rate limiting & slow down
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 10,
  delayMs: 250,
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

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
const pushRoutes = require('./routes/push');
const driverRoutes = require('./routes/drivers');

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
app.use('/drivers', driverRoutes);
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
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);
app.use('/reviews', reviewRoutes);
app.use('/cart', cartSidebarTemplateRoutes);
// Rate limit para APIs
app.use('/api/push', apiLimiter, pushRoutes);
app.use('/api/drivers', apiLimiter, driverRoutes);

// Redirigir /profile a /auth/profile
app.get('/profile', (req, res) => {
    res.redirect('/auth/profile');
});

// Socket.IO for real-time features
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);
  
  // Join restaurant room for notifications
  socket.on('join-restaurant', (restaurantId) => {
    socket.join(`restaurant-${restaurantId}`);
    console.log(`Usuario se unió al restaurante ${restaurantId}`);
  });

  // Join user room for order updates
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`Usuario ${userId} se unió a su sala`);
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
    console.log('Usuario desconectado:', socket.id);
  });

  // CHAT DE PEDIDOS
  socket.on('join-order-chat', async (data) => {
    const { orderId, userId, userType } = data;
    const roomName = `order-${orderId}`;
    socket.join(roomName);
    console.log(`${userType} ${userId} se unió a la sala de chat del pedido ${orderId}`);

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
            console.log('Creando tabla mensajes_pedido...');
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
        
        console.log(`Enviando historial de chat para pedido ${orderId}: ${messages.length} mensajes`, messages);
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

    console.log('DEBUG (server): Mensaje recibido para enviar:', { orderId, userId, userType, message });

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
          console.log('Creando tabla mensajes_pedido para enviar mensaje...');
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

      console.log(`[CHAT] Sender determined: type=${userType}, id=${userId}, name=${senderName}`);

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
      console.log(`DEBUG (server): Mensaje enviado en pedido ${orderId} por ${normalizedUserType} ${userId}: ${message}`);

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error en el servidor:', err.stack);
  const user = req.session && req.session.user ? req.session.user : null;
  
  res.status(500).render('error', {
    title: 'Error del Servidor',
    message: 'Algo salió mal. Por favor, intenta nuevamente.',
    error: process.env.NODE_ENV === 'development' ? err : {},
    user: user
  });
});

// 404 handler
app.use((req, res) => {
  console.log('Ruta no encontrada:', req.method, req.url);
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
  console.log(`📱 Acceso local: http://192.168.0.102:${PORT}`);
  console.log(`📱 Acceso desde red: http://192.168.0.102:${PORT}`);
  console.log(`🏪 Dashboard restaurante: http://192.168.0.102:${PORT}/dashboard`);
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