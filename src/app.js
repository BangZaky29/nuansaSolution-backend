// backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow server-to-server, Postman, webhook
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 🔴 PENTING: biar gampang debug
    return callback(
      new Error(`CORS blocked: ${origin} not allowed`)
    );
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ⚠️ handle preflight explicitly
app.options('*', cors());




app.use(express.json());
app.use(express.urlencoded({ extended: true }));
morgan.token('result', (req, res) => (res.statusCode < 400 ? 'success' : 'error'));
morgan.token('user', (req) => (req.user?.user_id ? String(req.user.user_id) : '-'));
const logFormat =
  process.env.LOG_LEVEL === 'debug'
    ? ':result :method :url :status :response-time ms :res[content-length] user=:user ip=:remote-addr time=:date[iso]'
    : process.env.LOG_LEVEL || 'dev';
app.use(morgan(logFormat));

// ============================================
// ROUTES
// ============================================
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const paymentRoutes = require('./routes/payment.routes');
const webhookRoutes = require('./routes/webhook.routes');
const protectedRoutes = require('./routes/protected.routes');
const sessionRoutes = require('./routes/session.routes');

// API Prefix (default: /api)
const apiPrefix = process.env.API_PREFIX || '/api';

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/user`, userRoutes);
app.use(`${apiPrefix}/payment`, paymentRoutes);
app.use(`${apiPrefix}/webhook`, webhookRoutes);
app.use(`${apiPrefix}/protected`, protectedRoutes);
app.use(`${apiPrefix}/session`, sessionRoutes);

// Health check
app.get(`${apiPrefix}/health`, (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Nuansa Legal - Payment Gateway API',
    version: '1.0.0',
    endpoints: {
      health: `${apiPrefix}/health`,
      auth: `${apiPrefix}/auth`,
      user: `${apiPrefix}/user`,
      payment: `${apiPrefix}/payment`,
      webhook: `${apiPrefix}/webhook`,
      protected: `${apiPrefix}/protected`
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requested_url: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Nuansa Legal - Payment Gateway                   ║
║                                                        ║
║   📡 Server: http://localhost:${PORT}                    ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                         ║
║   💾 Database: ${process.env.DB_NAME || 'gateway'}@${process.env.DB_HOST || 'localhost'}               ║
║                                                        ║
║   ✅ 1 User = 1 Paket Aktif System                    ║
║   🔐 JWT Authentication Enabled                       ║
║   💳 Midtrans Integration Active                      ║
║                                                        ║
║   📚 API Docs: http://localhost:${PORT}/api              ║
║   ❤️  Health Check: http://localhost:${PORT}/api/health   ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);

  // Log important configs
  console.log('📋 Configuration:');
  console.log(`   - Database: ${process.env.DB_NAME}`);
  console.log(`   - Midtrans: ${process.env.MIDTRANS_IS_PRODUCTION === 'true' ? 'PRODUCTION' : 'SANDBOX'}`);
  console.log(`   - CORS: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
  console.log('');
});

module.exports = app;
