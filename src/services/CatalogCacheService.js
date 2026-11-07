import {
  CATEGORIES,
  contentHash,
  getUnpublishedIds,
  loadAllBooks,
  syncBooks,
} from '../models/BookCacheModel.js';
// API sumber katalog (dipakai juga oleh index.html).
const SOURCE_API = process.env.CATALOG_SOURCE_API_BASE || 'https://api.buku.cloudapp.web.id/api/catalogue/';

// Peta kategori → endpoint sumber.
// STEM diambil lewat `getBooksByTag?tag=STEM` (butuh `page`),
// tiga kategori lain lewat endpoint buku teks (pakai `order_by`).
const SOURCE_ENDPOINTS = {
  stem: { path: 'getBooksByTag', query: { tag: 'STEM', page: 1 } },
  k13: { path: 'getTextBooks', query: { order_by: 'updated_at' } },
  merdeka: { path: 'getPenggerakTextBooks', query: { order_by: 'updated_at' } },
  nonteks: { path: 'getNonTextBooks', query: { order_by: 'updated_at' } },
};

const PAGE_SIZE = 1000;
const FETCH_TIMEOUT_MS = 30000;

// Cache in-memory: satu snapshot penuh katalog, dipakai untuk filter/paginasi
// tanpa query Firestore per request (cache Firestore sendiri ~1.7k dokumen).
let snapshot = null;     // Map<docId, book>
let snapshotAt = 0;
let refreshing = null;   // Promise refresh yang sedang berjalan

// Daftar buku yang disembunyikan admin. Katalog terbuka untuk umum, jadi ini
// di-cache supaya tiap request anonim tidak kena query Firestore.
// TTL pendek supaya status terbit yang baru diubah admin cepat berlaku.
let hiddenIds = null;
let hiddenAt = 0;

async function getHiddenIds() {
  const ttl = Number(process.env.CATALOG_HIDDEN_TTL_MS) || 15 * 1000;
  if (hiddenIds && Date.now() - hiddenAt < ttl) return hiddenIds;
  hiddenIds = await getUnpublishedIds();
  hiddenAt = Date.now();
  return hiddenIds;
}

function normalize(raw, category) {
  const fields = {
    sourceId: String(raw.id),
    category,
    title: raw.title || '',
    writer: raw.writer || '',
    publisher: raw.publisher || '',
    level: raw.level || '',
    bookClass: raw.class || '',
    isbn: raw.isbn || '',
    curriculum: raw.curriculum || '',
    language: raw.language || '',
    edition: raw.edition || '',
    subject: raw.subject || '',
    format: raw.format || '',
    status: raw.status || '',
    image: raw.image || '',
    attachment: raw.attachment || '',
    raw,
  };
  return { ...fields, srcHash: contentHash(fields) };
}

async function requestSource(path, query) {
  const url = new URL(path, SOURCE_API);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCategory(category) {
  const { path, query } = SOURCE_ENDPOINTS[category];
  // Satu request besar per kategori: pagination `offset` di API sumber tidak
  // stabil (urutan `updated_at` berubah antar request, jadi 5 buku nonteks
  // terlewat saat di-paginate). Satu request besar justru lengkap & stabil.
  const payload = await requestSource(path, { ...query, limit: PAGE_SIZE });
  const arr = payload?.results || payload?.data || [];
  if (!Array.isArray(arr)) return [];
  return arr.map((raw) => normalize(raw, category));
}

// Refresh cache: tarik 4 kategori dari API sumber, tulis ke books_cache.
// `isPublished` tidak pernah ditulis di sini — itu milik admin.
export async function refreshCatalog() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const all = [];
    const okCategories = [];
    for (const category of CATEGORIES) {
      try {
        const books = await fetchCategory(category);
        all.push(...books);
        okCategories.push(category);
      } catch (err) {
        console.error(`[catalog] refresh ${category} gagal:`, err.message);
      }
    }
    if (!all.length) throw new Error('Tidak ada data dari API sumber');
    // Baca cache yang ada sekali saja, lalu pakai untuk melewati penulisan
    // yang isinya tidak berubah sekaligus untuk menentukan dokumen yang dihapus.
    const existing = new Map((await loadAllBooks()).map((b) => [b.id, b]));
    const result = await syncBooks(all, okCategories, existing);
    await reloadSnapshot();
    hiddenIds = null; // paksa muat ulang daftar buku tersembunyi
    return { refreshed: all.length, ...result };
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

async function reloadSnapshot() {
  const docs = await loadAllBooks();
  snapshot = new Map(docs.map((d) => [d.id, d]));
  snapshotAt = Date.now();
  return snapshot;
}

async function ensureSnapshot() {
  const ttl = Number(process.env.CATALOG_CACHE_TTL_MS) || 6 * 60 * 60 * 1000;
  if (snapshot && Date.now() - snapshotAt < ttl) return snapshot;

  if (snapshot) {
    // Cache kedaluwarsa: layani request ini dari cache lama, tarik ulang di
    // latar belakang supaya request berikutnya cepat.
    refreshCatalog().catch((err) => console.error('[catalog] refresh:', err.message));
    return snapshot;
  }

  // Cache belum pernah dimuat (mis. deploy pertama) — tarik dari API sumber.
  if (!(await loadAllBooks()).length) {
    console.log('[catalog] cache kosong, refresh pertama…');
    await refreshCatalog();
  }
  return reloadSnapshot();
}

// Query katalog: filter kategori, pencarian judul, pagination.
export async function queryBooks({ category, q, page = 1, limit = 25 }) {
  const snap = await ensureSnapshot();
  let list = [...snap.values()];

  if (category) list = list.filter((b) => b.category === category);
  // Buku yang disembunyikan admin (isPublished: false) tidak muncul untuk siapa pun.
  const hidden = await getHiddenIds();
  list = list.filter((b) => !hidden.has(b.id));

  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((b) => (b.title || '').toLowerCase().includes(needle));
  }

  list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'id'));

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;

  return {
    items: list.slice(start, start + limit).map(serialize),
    page: safePage,
    limit,
    total,
    totalPages,
  };
}

function serialize(book) {
  // `raw` disimpan di Firestore sebagai jaring pengaman kalau field API sumber
  // berubah, dan `srcHash` dipakai untuk deteksi perubahan saat sinkronisasi.
  // Keduanya tidak ada artinya bagi klien — tidak dikirim.
  const { cachedAt, raw, srcHash, ...rest } = book;
  return {
    ...rest,
    cachedAt: cachedAt?.toDate?.().toISOString() ?? null,
  };
}

// Detail satu buku: cari di snapshot yang sama dengan queryBooks. Buku yang
// disembunyikan admin (isPublished: false) juga tidak ditemukan di sini —
// halaman detail harus konsisten dengan katalog.
export async function getBookById(id) {
  const snap = await ensureSnapshot();
  const book = snap.get(id);
  if (!book) return null;
  const hidden = await getHiddenIds();
  if (hidden.has(id)) return null;
  return serialize(book);
}
