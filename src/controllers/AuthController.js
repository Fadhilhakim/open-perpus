import {
  createUserProfile,
  getUserByUid,
  isBootstrapAdmin,
  updateUserProfile,
} from '../models/UserModel.js';

// POST /api/auth/profile — buat profil pada login pertama, atau lengkapi profil yang sudah ada.
export async function upsertProfile(req, res) {
  const { uid, email } = req.user;
  const { name, level, role } = req.body || {};

  try {
    const existing = await getUserByUid(uid);
    if (existing) {
      // Profil sudah ada: hanya field milik pengguna yang boleh diubah.
      const updated = await updateUserProfile(uid, { name, level });
      return res.json({ profile: serialize(updated), created: false });
    }

    // Profil baru: role default 'student', kecuali email ada di daftar bootstrap admin.
    const finalRole = isBootstrapAdmin(email) ? 'admin' : 'student';
    const profile = await createUserProfile(uid, {
      email,
      name: name || email?.split('@')[0] || '',
      level: level || '',
      role: finalRole,
    });
    return res.status(201).json({ profile: serialize(profile), created: true });
  } catch (err) {
    console.error('[auth/profile]', err);
    return res.status(500).json({ error: 'Gagal menyimpan profil' });
  }
}

// GET /api/users/me — profil pengguna yang sedang login.
export async function getMe(req, res) {
  try {
    const profile = await getUserByUid(req.user.uid);
    if (!profile) {
      return res.status(404).json({ error: 'Profil belum dibuat' });
    }
    return res.json({ profile: serialize(profile) });
  } catch (err) {
    console.error('[users/me]', err);
    return res.status(500).json({ error: 'Gagal memuat profil' });
  }
}

// Timestamp Firestore tidak dikirim apa adanya ke JSON — ubah ke ISO string.
function serialize(profile) {
  const { createdAt, updatedAt, ...rest } = profile;
  return {
    ...rest,
    createdAt: createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: updatedAt?.toDate?.().toISOString() ?? null,
  };
}
