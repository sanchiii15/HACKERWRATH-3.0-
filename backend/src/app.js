import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import scanRoutes from './routes/scans.js';
import messageRoutes from './routes/messages.js';
import liveRoutes from './routes/live.js';
import { detectorStatus } from './services/detectors/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      detector: detectorStatus().summary,
      detectors: detectorStatus(),
    });
  });

  app.use('/api/scans', scanRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/live', liveRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
