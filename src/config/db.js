// backend/src/config/db.js
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gateway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00' // UTC timezone
};

const pool = mysql.createPool(config);

// Test connection
pool.getConnection()
  .then(conn => {
    console.log(`✅ Database connected: ${config.database}@${config.host}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Check your .env configuration:');
    console.error(`   - DB_HOST: ${config.host}`);
    console.error(`   - DB_USER: ${config.user}`);
    console.error(`   - DB_NAME: ${config.database}`);
    process.exit(1); // Exit jika database tidak terkoneksi
  });

module.exports = pool;