import { loadEnvFile } from 'node:process';
import { createApp } from './src/app.js';

try {
  loadEnvFile();
} catch {
  // .env opsional di produksi (variabel diset di environment server)
}

const port = Number(process.env.PORT) || 3000;

createApp().listen(port, () => {
  console.log(`Perpustakaan Digital berjalan di http://localhost:${port}`);
});
