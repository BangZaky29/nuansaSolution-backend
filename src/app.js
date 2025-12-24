// backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const rateLimit = require('express-rate-limit');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// Parse allowed origins from environment
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim().replace(/\/$/, '')) // Remove trailing slash
  .filter(Boolean);

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow webhook & server-to-server requests (no origin header)
    if (!origin) {
      return callback(null, true);
    }

    // Normalize origin (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '');

    // Check if origin is in allowed list
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Reject but don't throw error
    console.warn(`⚠️ CORS blocked origin: ${origin} (allowed: ${allowedOrigins.join(', ')})`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id']
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));

// Logging middleware
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
const tablesRoutes = require('./tables/tables.routes');
const featureRoutes = require('./routes/feature.routes');
const notificationRoutes = require('./routes/notification.routes');

// API Prefix (default: /api)
const apiPrefix = process.env.API_PREFIX || '/api';

// Mount routes
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const paymentLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 50 });

app.use(`${apiPrefix}/auth`, authLimiter, authRoutes);
app.use(`${apiPrefix}/user`, userRoutes);
app.use(`${apiPrefix}/payment`, paymentLimiter, paymentRoutes);
app.use(`${apiPrefix}/webhook`, webhookRoutes);
app.use(`${apiPrefix}/protected`, protectedRoutes);
app.use(`${apiPrefix}/session`, sessionRoutes);
app.use(`${apiPrefix}/tables`, tablesRoutes);
app.use(`${apiPrefix}/features`, featureRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);

// ============================================
// HEALTH & INFO ENDPOINTS
// ============================================

// Health check endpoint
app.get(`${apiPrefix}/health`, (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    database: {
      host: process.env.DB_HOST || 'localhost',
      name: process.env.DB_NAME || 'gateway'
    },
    midtrans: {
      mode: process.env.MIDTRANS_IS_PRODUCTION === 'true' ? 'PRODUCTION' : 'SANDBOX'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Nuansa Solution - Payment Gateway API',
    version: '1.0.0',
    documentation: 'https://docs.nuansasolution.com',
    endpoints: {
      health: `${apiPrefix}/health`,
      auth: `${apiPrefix}/auth`,
      user: `${apiPrefix}/user`,
      payment: `${apiPrefix}/payment`,
      webhook: `${apiPrefix}/webhook`,
      protected: `${apiPrefix}/protected`,
      session: `${apiPrefix}/session`,
      tables: `${apiPrefix}/tables`
    }
  });
});

// ============================================
// ERROR HANDLERS
// ============================================

// 404 handler - Route not found
app.use((req, res) => {
  console.warn(`⚠️ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requested_url: req.originalUrl,
    method: req.method,
    available_endpoints: `${apiPrefix}/health`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error Handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err 
    })
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Nuansa Solution - Payment Gateway API            ║
║                                                        ║
║   📡 Server: http://localhost:${PORT}                    ║
║   🌍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(28)}║
║   💾 Database: ${(process.env.DB_NAME || 'gateway').padEnd(32)}║
║                                                        ║
║   ✅ 1 User = 1 Paket Aktif System                    ║
║   🔐 JWT Authentication Enabled                       ║
║   💳 Midtrans Integration Active                      ║
║   🔔 Webhook Handler Ready                            ║
║                                                        ║
║   📚 API Docs: http://localhost:${PORT}/api              ║
║   ❤️  Health: http://localhost:${PORT}/api/health        ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);

  // Log important configurations
  console.log('📋 Configuration:');
  console.log(`   - API Prefix: ${apiPrefix}`);
  console.log(`   - Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  console.log(`   - Midtrans: ${process.env.MIDTRANS_IS_PRODUCTION === 'true' ? '🔴 PRODUCTION' : '🟡 SANDBOX'}`);
  console.log(`   - CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log(`   - Log Level: ${process.env.LOG_LEVEL || 'dev'}`);
  console.log('');
  console.log('📝 Available Routes:');
  console.log(`   - POST   ${apiPrefix}/auth/register`);
  console.log(`   - POST   ${apiPrefix}/auth/login`);
  console.log(`   - POST   ${apiPrefix}/payment/create`);
  console.log(`   - POST   ${apiPrefix}/payment/resume/:order_id`);
  console.log(`   - POST   ${apiPrefix}/payment/cancel/:order_id`);
  console.log(`   - GET    ${apiPrefix}/payment/status/:order_id`);
  console.log(`   - POST   ${apiPrefix}/webhook/midtrans`);
  console.log(`   - GET    ${apiPrefix}/webhook/verify/:orderId`);
  console.log(`   - GET    ${apiPrefix}/features/all`);
  console.log(`   - GET    ${apiPrefix}/features/my-subscription`);
  console.log(`   - GET    ${apiPrefix}/features/usage-history`);
  console.log(`   - POST   ${apiPrefix}/features/check-access`);
  console.log(`   - GET    ${apiPrefix}/notifications`);
  console.log(`   - GET    ${apiPrefix}/health`);
  console.log('');
  console.log('✅ Server is ready to accept connections!');
  console.log('');
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  app.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  app.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
