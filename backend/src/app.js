import path from 'node:path';
import fs from 'node:fs';
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
  app.set('trust proxy', env.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'blob:'], // blob: loads Live Call Guard's audio worklet
          styleSrc: ["'self'", "'unsafe-inline'"], // inline style attributes on charts and gauges
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:', 'data:'], // plays the user's own file back from memory
          connectSrc: ["'self'", 'blob:'],
          fontSrc: ["'self'", 'data:'],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'", 'https://huggingface.co'], // the Space page embeds the app
          upgradeInsecureRequests: env.production ? [] : null,
        },
      },
      frameguard: false, // replaced by frame-ancestors above
    }),
  );
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

  if (env.serveFrontend && fs.existsSync(path.join(env.frontendDir, 'index.html'))) {
    // Hashed build assets can be cached for a long time; index.html must always be fresh.
    app.use('/assets', express.static(path.join(env.frontendDir, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(env.frontendDir, { index: false, maxAge: '1h' }));
    // Client-side routes (/live, /scans/:id…) all load the app shell.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(env.frontendDir, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
