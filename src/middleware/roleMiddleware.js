import { ROLES, getUserByUid } from '../models/UserModel.js';

// Cek role dari dokumen users/{uid} di Firestore (bukan dari token/body).
export function roleMiddleware(...allowed) {
  const allowedRoles = allowed.length ? allowed : ROLES;
  return async (req, res, next) => {
    try {
      const profile = await getUserByUid(req.user.uid);
      if (!profile) {
        return res.status(403).json({ error: 'Profil belum dibuat' });
      }
      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: 'Akses ditolak' });
      }
      req.profile = profile;
      return next();
    } catch (err) {
      return res.status(500).json({ error: 'Gagal memeriksa role' });
    }
  };
}
