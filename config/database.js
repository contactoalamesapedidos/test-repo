
rao// Create connection pool
const mysql = require('mysql2');

console.log('🔧 Configuración de base de datos:');
console.log('Host:', process.env.MYSQLHOST || process.env.DB_HOST || 'localhost');
console.log('Database:', process.env.MYSQLDATABASE || process.env.DB_NAME || 'a_la_mesa');
console.log('Port:', process.env.MYSQLPORT || process.env.DB_PORT || 3306);

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'a_la_mesa',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: process.env.NODE_ENV === 'production' ? 5 : 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  ssl: process.env.MYSQLHOST ? { rejectUnauthorized: false } : false
});

// Create promise-based pool
const promisePool = pool.promise();

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
