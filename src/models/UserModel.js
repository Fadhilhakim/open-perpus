import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../config/firebase.js';

export const ROLES = ['student', 'admin'];
export const LEVELS = ['SD/MI', 'SMP/MTS', 'SMA/MA/SMK/MAK'];

const usersCol = () => getDb().collection('users');

export async function getUserByUid(uid) {
  const snap = await usersCol().doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function createUserProfile(uid, { email, name, role, level }) {
  const ref = usersCol().doc(uid);
  const data = {
    email,
    name: name || '',
    role,
    level: level || '',
    status: 'active',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  await ref.set(data);
  return { id: uid, ...data };
}

// Profil yang sudah ada hanya boleh diperbarui di field milik pengguna.
// `role` sengaja tidak bisa diubah lewat endpoint ini.
export async function updateUserProfile(uid, { name, level }) {
  const ref = usersCol().doc(uid);
  const patch = { updatedAt: Timestamp.now() };
  if (name !== undefined) patch.name = name;
  if (level !== undefined) patch.level = level;
  await ref.update(patch);
  const snap = await ref.get();
  return { id: snap.id, ...snap.data() };
}

export function isBootstrapAdmin(email) {
  const list = (process.env.ADMIN_BOOTSTRAP_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || '').toLowerCase());
}
