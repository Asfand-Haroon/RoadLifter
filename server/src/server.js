const http = require('http');
const { Server } = require('socket.io');
const createApp = require('./app');
const env = require('./config/env');
const { initSocketManager } = require('./sockets/socketManager');
const { startLocationSimulation } = require('./sockets/LocationHandler');
const { pool } = require('./config/db');

const startServer = async () => {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, !origin || env.ALLOWED_ORIGINS.includes(origin)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Make io accessible from Express routes via req.app.get('io')
  app.set('io', io);

  // Test DB connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection verified');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Make sure PostgreSQL is running and DATABASE_URL is correct');
    process.exit(1);
  }

  initSocketManager(io);
  startLocationSimulation(io);

  // Start HTTP server
  httpServer.listen(env.PORT, () => {
    console.log(`\n🚀 RoadLifter Server running on port ${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   API: http://localhost:${env.PORT}/api`);
    console.log(`   Health: http://localhost:${env.PORT}/health\n`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n⏳ Shutting down gracefully...');
    httpServer.close(async () => {
      await pool.end();
      console.log('✅ Server stopped');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
