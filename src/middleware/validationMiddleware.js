import { LEVELS } from '../models/UserModel.js';

// Validasi input di backend (bukan hanya frontend).
// Body profil hanya boleh berisi `name` dan `level`. Role TIDAK bisa dikirim
// dari browser — role ditentukan backend saat profil pertama dibuat.
export function validateProfileBody(req, res, next) {
  const body = req.body || {};
  if (body.role !== undefined) {
    return res.status(400).json({ error: 'Role tidak bisa diubah dari klien' });
  }
  const { name, level } = body;
  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json({ error: 'Format nama tidak valid' });
  }
  if (name !== undefined && name.length > 100) {
    return res.status(400).json({ error: 'Nama terlalu panjang (maks 100 karakter)' });
  }
  if (level !== undefined && level !== '' && !LEVELS.includes(level)) {
    return res.status(400).json({ error: `Level tidak dikenal. Pilihan: ${LEVELS.join(', ')}` });
  }
  return next();
}
