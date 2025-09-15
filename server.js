const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cors = require('cors');
require('dotenv').config();

// Database connection
const db = require('./config/database');

// Category icons utility
const { getCategoryIcon, getCategoryImagePath } = require('./utils/categoryIcons');

const cartMiddleware = require('./middleware/cart')(db);

const app = express();

// Socket.IO disabled for Vercel (serverless)
// const io = null;

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

// Session store disabled for Vercel serverless
// MySQL session store may not work in serverless environment

app.use(session(sessionConfig));

// Security middlewares - simplified for Vercel
// Temporarily disabled complex security middlewares that may cause issues
// app.use(setCSRFToken);
// app.use(sanitizeInput);
// app.use(setCSP);

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

// Rate limiting disabled for Vercel serverless
// const authLimiter = authRateLimit;
// const apiLimiter = apiRateLimit;

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

// Rate limiting disabled for Vercel serverless
// const mutateLimiter = ...

app.use('/', indexRoutes);
// Authentication routes without rate limiting for Vercel
app.use('/auth', authRoutes);
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
// API routes without rate limiting for Vercel
app.use('/api/push', pushRoutes);
app.use('/api', apiRoutes);

// Redirigir /profile a /auth/profile
app.get('/profile', (req, res) => {
    res.redirect('/auth/profile');
});

// Socket.IO disabled for Vercel (serverless)
// Real-time features will need alternative implementation

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

// Export for Vercel serverless functions
module.exports = app;

// For local development
if (require.main === module) {
  const HOST = process.env.HOST || '0.0.0.0';
  const PORT = process.env.PORT || 3000;

  const http = require('http');
  const server = http.createServer(app);

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
}

app.locals.getCategoryIcon = getCategoryIcon;
app.locals.getCategoryImagePath = getCategoryImagePath;
