
// Create connection pool
const mysql = require('mysql2');

console.log('🔧 Configuración de base de datos:');
console.log('Host:', process.env.DB_HOST || 'localhost');
console.log('Database:', process.env.DB_NAME || 'a_la_mesa');
console.log('Port:', process.env.DB_PORT || 3306);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'a_la_mesa',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: process.env.NODE_ENV === 'production' ? 5 : 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false
});

const promisePool = pool.promise();

// promisePool is already declared above

// Test connection (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  promisePool.execute('SELECT 1 as test')
    .then(() => {
      console.log('✅ Conexión a MySQL establecida correctamente');
    })
    .catch((err) => {
      console.error('❌ Error conectando a MySQL:', err.message);
      console.error('Stack:', err.stack);
    });
}

module.exports = promisePool;
