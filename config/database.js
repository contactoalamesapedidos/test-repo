
rao// Create connection pool
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'a_la_mesa',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: process.env.MYSQLHOST ? { rejectUnauthorized: false } : false
});

// Create promise-based pool
const promisePool = pool.promise();

// Test connection
promisePool.execute('SELECT 1 as test')
  .then(() => {
    // Conexión a MySQL establecida correctamente
  })
  .catch((err) => {
    console.error('❌ Error conectando a MySQL:', err.message);
    process.exit(1);
  });

module.exports = promisePool;
