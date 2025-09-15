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

// Middleware
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: false,
  noSniff: false,
  xssFilter: false,
}));
app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 50000,
  depth: 20,
  type: 'application/x-www-form-urlencoded'
}));

// CORS
const allowOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== 'production') {
  allowOrigins.push(/^https:\/\/[a-z0-9]+\.ngrok-free\.app$/);
  allowOrigins.push(/^https:\/\/[a-z0-9]+\.ngrok\.app$/);
  allowOrigins.push(/^http:\/\/localhost:\d+$/);
  allowOrigins.push(/^https:\/\/localhost:\d+$/);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
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
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  }
}));

app.use(morgan('dev'));

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
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }
};

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
const driverRoutes = require('./routes/drivers');
const apiRoutes = require('./routes/api');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/restaurants', restaurantRoutes);
app.use('/products', productRoutes);
app.get('/orders', (req, res) => {
  res.redirect('/orders/');
});
app.use('/orders', orderRoutes);
app.use('/cart', cartRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/repartidores', driverRoutes);
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);
app.use('/reviews', reviewRoutes);
app.use('/cart', cartSidebarTemplateRoutes);
app.use('/api/push', pushRoutes);
app.use('/api', apiRoutes);

// Redirigir /profile a /auth/profile
app.get('/profile', (req, res) => {
    res.redirect('/auth/profile');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error en el servidor:', err.message);

  const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest' ||
                (req.headers.accept && req.headers.accept.includes('application/json')) ||
                req.is('application/json');

  if (isAjax) {
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
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  res.status(500).render('error', {
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
