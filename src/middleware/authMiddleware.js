import { getAdminAuth } from '../config/firebase.js';

// Verifikasi Firebase ID token dari header Authorization: Bearer <token>.
// Token diverifikasi ulang di backend; jangan percaya uid/role dari body request.
export async function authMiddleware(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      emailVerified: decoded.email_verified || false,
    };
    return next();
  } catch (err) {
    const expired = err.code === 'auth/id-token-expired';
    return res.status(401).json({
      error: expired ? 'Token kedaluwarsa, silakan login ulang' : 'Token tidak valid',
    });
  }
}
