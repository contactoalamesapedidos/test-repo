module.exports = {
    CLIENT_ID: process.env.MP_APP_ID || 'YOUR_MP_APP_ID',
    CLIENT_SECRET: process.env.MP_CLIENT_SECRET || 'YOUR_MP_CLIENT_SECRET',
    REDIRECT_URI: process.env.MP_RESTAURANT_REDIRECT_URI || 'http://localhost:3000/dashboard/mercadopago/callback'
};