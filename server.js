const dotenv = require('dotenv');
dotenv.config(); // Must be first

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const loggerMiddleware = require('./middleware/loggerMiddleware');
const encryptionMiddleware = require('./middleware/encryptionMiddleware');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

connectDB();

const http = require('http');
const { Server } = require('socket.io');
const { connectKafka } = require('./services/kafka');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

global.io = io;

app.use(cors());
app.use(express.json());
app.use(loggerMiddleware);
app.use(encryptionMiddleware);

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Blood Donation API Docs',
}));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/blood', require('./routes/bloodRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/push', require('./routes/pushRoutes'));

// Connect Kafka
connectKafka();

const PORT = process.env.PORT || 5000;

const httpServer = server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs\n`);
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Received kill signal, shutting down gracefully');
  httpServer.close(() => {
    logger.info('Closed out remaining connections');
    process.exit(0);
  });

  // Force close after 10s
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle nodemon restart
process.once('SIGUSR2', () => {
  logger.info('Received SIGUSR2 (nodemon restart), shutting down gracefully');
  httpServer.close(() => {
    logger.info('Closed out remaining connections');
    process.kill(process.pid, 'SIGUSR2');
  });
});
