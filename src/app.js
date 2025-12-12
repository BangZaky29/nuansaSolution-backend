// backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = express();

// ============================================
// ENV
// ============================================
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_PREFIX = process.env.API_PREFIX || '/api';

// ============================================
// HELMET (SAFE FOR API & MIDTRANS WEBHOOK)
// ============================================
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// ============================================
// CORS CONFIGURATION (PRODUCTION SAFE)
// ============================================
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow Postman, server-to-server, Midtrans webhook
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (NODE_ENV === 'development') {
      console.warn('❌ CORS blocked:', origin);
    }

    // IMPORTANT: do NOT throw error
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============================================
// BODY PARSER
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// LOGGER (MORGAN)
// ============================================
morgan.token('result', (req, res) =>
  res.statusCode < 400 ? 'success' : 'error'
);
morgan.token('user', (req) =>
  req.user?.user_id ? String(req.user.user_id) : '-'
);

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
const tablesRoutes = require('./tables/tables.routes');

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/user`, userRoutes);
app.use(`${API_PREFIX}/payment`, paymentRoutes);
app.use(`${API_PREFIX}/webhook`, webhookRoutes);
app.use(`${API_PREFIX}/protected`, protectedRoutes);
app.use(`${API_PREFIX}/session`, sessionRoutes);
app.use(`${API_PREFIX}/tables`, tablesRoutes);

// ============================================
// HEALTH CHECK
// ============================================
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    port: PORT,
  });
});

// ============================================
// ROOT
// ============================================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Nuansa Legal - Payment Gateway API',
    version: '1.0.0',
    endpoints: {
      health: `${API_PREFIX}/health`,
      auth: `${API_PREFIX}/auth`,
      user: `${API_PREFIX}/user`,
      payment: `${API_PREFIX}/payment`,
      webhook: `${API_PREFIX}/webhook`,
      protected: `${API_PREFIX}/protected`,
    },
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requested_url: req.originalUrl,
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Nuansa Legal - Payment Gateway                   ║
║                                                        ║
║   📡 Server: http://localhost:${PORT}                    ║
║   🌍 Environment: ${NODE_ENV.padEnd(28)}║
║   💾 Database: ${(process.env.DB_NAME || 'gateway').padEnd(30)}║
║                                                        ║
║   🔐 JWT Authentication Enabled                       ║
║   💳 Midtrans Integration Active                      ║
║                                                        ║
║   ❤️  Health Check: /api/health                        ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);

  console.log('📋 Configuration:');
  console.log(`   - DB: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  console.log(
    `   - Midtrans: ${
      process.env.MIDTRANS_IS_PRODUCTION === 'true'
        ? 'PRODUCTION'
        : 'SANDBOX'
    }`
  );
  console.log(`   - CORS: ${allowedOrigins.join(', ') || 'ALL'}`);
  console.log('');
});

module.exports = app;
