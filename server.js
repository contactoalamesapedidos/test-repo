const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Database connection
const db = require('./config/database');

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
}));
app.use(compression());

// Configuración de logging
app.use(morgan('dev')); // Logging estándar

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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
app.use(session({
  key: 'alamesa_session',
  secret: process.env.SESSION_SECRET || 'tu_secreto_de_session_super_seguro',
  store: new MySQLStore({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'a_la_mesa'
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: false // Set to true in production with HTTPS
  }
}));

// Global variables middleware
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.user;
  res.locals.cart = req.session.cart || [];
  res.locals.cartTotal = req.session.cartTotal || 0;
  res.locals.cartCount = req.session.cartCount || 0;
  next();
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

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/restaurants', restaurantRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/cart', cartRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);

// Redirigir /profile a /auth/profile
app.get('/profile', (req, res) => {
    res.redirect('/auth/profile');
});

// Redirigir /orders a /orders/history
app.get('/orders', (req, res) => {
    res.redirect('/orders/history');
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
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Error del Servidor',
    message: 'Algo salió mal. Por favor, intenta nuevamente.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página No Encontrada',
    message: 'La página que buscas no existe.',
    error: {}
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Servidor A la Mesa corriendo en puerto ${PORT}`);
  console.log(`📱 Visita: http://localhost:${PORT}`);
  console.log(`🏪 Dashboard restaurante: http://localhost:${PORT}/dashboard`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});
