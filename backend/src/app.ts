import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { buildContainer } from './container.js';
import { createApiRouter } from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — permissive for development; tighten via env config for production
  app.use(cors());

  // Request logging
  const logFormat = process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev';
  app.use(morgan(logFormat));

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Build DI container and mount API routes
  const container = buildContainer();
  app.use('/api/v1', createApiRouter(container));

  // 404 catch-all (must come after routes)
  app.use(notFound);

  // Centralised error handler (must be last)
  app.use(errorHandler);

  return app;
}

