const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Minimal setup for Vercel
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Simple test route
app.get('/', (req, res) => {
  res.send('¡Hola! La aplicación está funcionando en Vercel.');
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Aplicación funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
module.exports = app;
