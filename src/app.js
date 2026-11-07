import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/authRoutes.js';
import bookRoutes from './routes/bookRoutes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, '..', 'public');

const app = express();
app.use(express.json());
app.use(express.static(publicDir));
app.use('/api', authRoutes);
app.use('/api', bookRoutes);

// Vercel menjalankan aplikasi ini sebagai satu Serverless Function: ia
// mengambil handler dari default export. Tanpa baris ini build Vercel gagal
// dengan "Can't detect handler export shape".
export default app;
