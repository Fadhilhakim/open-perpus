import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import { validateProfileBody } from '../middleware/validationMiddleware.js';
import { getMe, upsertProfile } from '../controllers/AuthController.js';

const router = Router();

// Konfigurasi publik Firebase untuk sisi browser.
// Nilai ini memang terlihat oleh klien (bukan rahasia) — keamanan tetap
// di Firebase Security Rules. DisINI supaya tidak di-hardcode di HTML.
router.get('/config', (req, res) => {
  res.json({
    firebase: {
      apiKey: process.env.FIREBASE_WEB_API_KEY || '',
      authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_WEB_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_WEB_APP_ID || '',
    },
    // Non-null saat memakai Firebase Auth Emulator (dev).
    // Browser SDK butuh skema (http://), sedangkan Admin SDK butuh host:port tanpa skema.
    authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST
      ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`
      : null,
  });
});

// Semua endpoint di bawah wajib lewat authMiddleware (verifikasi token Admin SDK).
router.post('/auth/profile', authMiddleware, validateProfileBody, upsertProfile);
router.get('/users/me', authMiddleware, roleMiddleware('student', 'admin'), getMe);

export default router;
