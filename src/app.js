import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/authRoutes.js';
import bookRoutes from './routes/bookRoutes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, '..', 'public');

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));
  app.use('/api', authRoutes);
  app.use('/api', bookRoutes);
  return app;
}
