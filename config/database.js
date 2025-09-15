
// Create connection pool
const mysql = require('mysql2');

// Check if DATABASE_URL is provided (Railway format)
let poolConfig;

if (process.env.DATABASE_URL) {
  // Parse DATABASE_URL (Clever Cloud, Railway, etc.)
  const url = new URL(process.env.DATABASE_URL);
  console.log('🔧 Configuración de base de datos:');
  console.log('Host:', url.hostname);
  console.log('Database:', url.pathname.substring(1));
  console.log('Port:', url.port);

  poolConfig = {
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1), // Remove leading slash
    port: parseInt(url.port),
    waitForConnections: true,
    connectionLimit: process.env.NODE_ENV === 'production' ? 2 : 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    acquireTimeout: 30000, // 30 segundos para Clever Cloud
    timeout: 30000, // 30 segundos de timeout de query
    connectTimeout: 30000, // 30 segundos para conectar
    ssl: { rejectUnauthorized: false }
  };
} else {
  // Fallback to individual environment variables
  console.log('🔧 Configuración de base de datos (variables individuales):');
  console.log('Host:', process.env.DB_HOST || 'localhost');
  console.log('Database:', process.env.DB_NAME || 'a_la_mesa');
  console.log('Port:', process.env.DB_PORT || 3306);

  poolConfig = {
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
  };
}

const pool = mysql.createPool(poolConfig);

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
