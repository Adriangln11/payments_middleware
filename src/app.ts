import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from './config/logger';
import redisClient from './config/redis';

import paymentRoutes from './routes/payment.routes';
import callbackRoutes from './routes/callback.routes';
import webhookRoutes from './routes/webhook.routes';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';

import './queues/callback.queue';

const app: express.Application = express();
const PORT = process.env.PORT || 3000;


app.use(helmet());


app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


app.use((req, res, next) => {
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});


app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.use('/api/payment', paymentRoutes);
app.use('/api/callback', callbackRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);


app.use('*', (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});


app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message }),
  });
});

async function startServer() {
  try {

    //await redisClient.connect();
    //logger.info('✅ Connected to Redis');


    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}


// process.on('SIGTERM', async () => {
//   logger.info('SIGTERM received, shutting down gracefully');
//   await redisClient.disconnect();
//   process.exit(0);
// });

// process.on('SIGINT', async () => {
//   logger.info('SIGINT received, shutting down gracefully');
//   await redisClient.disconnect();
//   process.exit(0);
// });

// process.on('unhandledRejection', (reason, promise) => {
//   logger.error('Unhandled Promise Rejection', {
//     reason,
//     promise,
//   });
// });


// process.on('uncaughtException', (error) => {
//   logger.error('Uncaught Exception', {
//     error: error.message,
//     stack: error.stack,
//   });
//   process.exit(1);
// });

startServer();

export default app;