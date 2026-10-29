const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/error');

// Route modules
const authRoutes = require('./modules/auth/auth.routes');
const cargoRoutes = require('./modules/cargo/cargo.routes');
const driverRoutes = require('./modules/driver/driver.routes');
const trucksRoutes = require('./modules/trucks/trucks.routes');
const ratingsRoutes = require('./modules/ratings/ratings.routes');
const adminRoutes = require('./modules/admin/admin.routes');

const createApp = () => {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);

  // Security headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  }));

  // CORS
  app.use(cors({
    origin: (origin, callback) => callback(null, env.isOriginAllowed(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'bypass-tunnel-reminder',
      'ngrok-skip-browser-warning',
      'x-requested-with',
      'Accept',
    ],
  }));

  // Request logging
  morgan.token('safe-url', (req) => req.path);
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : ':method :safe-url :status :response-time ms'));

  // Body parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));

  // Global rate limit
  app.use('/api', apiLimiter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/cargo', cargoRoutes);
  app.use('/api/drivers', driverRoutes);
  app.use('/api/trucks', trucksRoutes);
  app.use('/api/ratings', ratingsRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 handler
  app.use(notFound);

  // Global error handler
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
