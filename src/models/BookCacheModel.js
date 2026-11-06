import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../config/firebase.js';

export const CATEGORIES = ['k13', 'merdeka', 'nonteks', 'stem'];

const col = () => getDb().collection('books_cache');

// ID dokumen digabung kategori+sourceId: id yang sama bisa muncul di dua
// kategori (mis. 93 buku merdeka juga berlabel STEM), dan bentuk datanya beda.
export const bookDocId = (category, sourceId) => `${category}_${sourceId}`;

export const isValidCategory = (c) => CATEGORIES.includes(c);

// Field yang berasal dari API sumber (dibandingkan saat sinkronisasi).
export const SOURCE_FIELDS = [
  'sourceId', 'category', 'title', 'writer', 'publisher', 'level', 'bookClass',
  'isbn', 'curriculum', 'language', 'edition', 'subject', 'format', 'status',
  'image', 'attachment', 'raw',
];

// Stringify dengan urutan key stabil — Firestore tidak menjamin urutan key
// sama seperti respons API sumber, jadi JSON.stringify biasa selalu beda.
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

// Hash isi sumber — dipakai untuk melewati penulisan dokumen yang isinya
// tidak berubah. Tanpa ini, tiap refresh menulis ulang ~1.8k dokumen dan
// menghabiskan kuota tulis harian Firestore.
export function contentHash(fields) {
  const payload = {};
  for (const f of SOURCE_FIELDS) payload[f] = fields[f] ?? null;
  return createHash('sha1').update(stableStringify(payload)).digest('hex');
}

// Sinkronkan cache dengan hasil tarik dari API sumber.
// - Dokumen baru: ditulis dengan isPublished true (default, admin belum pernah menyentuh).
// - Dokumen lama yang isinya berubah: ditulis ulang, isPublished TIDAK ikut berubah.
// - Dokumen lama yang isinya sama: dilewati, jadi tidak ada write.
// - Dokumen yang hilang dari API sumber: dihapus, tapi hanya untuk kategori
//   yang sukses ditarik (kalau request sumber gagal, memangkas akan menghapus
//   seluruh cache kategori itu).
//
// `existing` = peta dokumen cache yang sudah dibaca, supaya sinkronisasi tidak
// perlu query Firestore kedua kali.
export async function syncBooks(docs, okCategories, existing) {
  const db = getDb();
  const now = Timestamp.now();
  const known = existing || new Map((await col().get()).docs.map((d) => [d.id, d.data()]));

  const writes = [];
  const validIds = new Set();
  for (const doc of docs) {
    const id = bookDocId(doc.category, doc.sourceId);
    validIds.add(id);
    const prev = known.get(id);
    const changed = !prev || prev.srcHash !== doc.srcHash;
    // Dokumen lama yang belum pernah disentuh admin (isPublished belum ada)
    // tetap ditulis ulang supaya flag-nya terisi default true.
    if (!changed && prev.isPublished !== undefined) continue;
    const payload = { ...doc, cachedAt: now };
    if (!prev || prev.isPublished === undefined) payload.isPublished = true;
    writes.push({ id, payload });
  }

  let written = 0;
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) batch.set(col().doc(w.id), w.payload, { merge: true });
    await batch.commit();
    written += Math.min(400, writes.length - i);
  }

  const stale = [...known.keys()].filter((id) => {
    const category = known.get(id).category;
    return okCategories.includes(category) && !validIds.has(id);
  });
  for (let i = 0; i < stale.length; i += 400) {
    const batch = db.batch();
    for (const id of stale.slice(i, i + 400)) batch.delete(col().doc(id));
    await batch.commit();
  }

  return { written, skipped: docs.length - written, pruned: stale.length };
}

// Semua dokumen cache — dipakai untuk membangun indeks in-memory di service.
export async function loadAllBooks() {
  const snap = await col().get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Dokumen yang disembunyikan admin (isPublished: false). Query ini kecil
// (hanya buku yang disembunyikan) dan dibaca fresh tiap request, jadi perubahan
// status terbit dari admin langsung terlihat tanpa perlu invalidasi cache.
export async function getUnpublishedIds() {
  const snap = await col().where('isPublished', '==', false).get();
  return new Set(snap.docs.map((d) => d.id));
}