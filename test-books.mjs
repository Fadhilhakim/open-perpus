// Uji endpoint katalog: GET /api/books (filter kategori, cari judul, pagination)
// Jalankan: node test-books.mjs   (butuh auth emulator + server di localhost:3000)
import assert from 'node:assert';
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile();
} catch {
  // .env opsional kalau env sudah diset di shell
}

const BASE = 'http://localhost:3000';
const EMU = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const API_KEY = 'AIzaSyBbAR68X-JB2UXMJl-CHrfAFRjJYvTc2-E';

// Server dev berjalan terhadap Firestore emulator. SDK firebase-admin di
// bawah honor FIRESTORE_EMULATOR_HOST, jadi env ini wajib diset SEBELUM
// `src/config/firebase.js` di-import — kalau tidak, tulisan langsung ke
// Firestore landing di project produksi dan menghabiskan kuota harian.
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';

const email = `test-buku-${Date.now()}@sekolah.sch.id`;
const password = 'Test#12345';

async function signUp(body) {
  return fetch(`${EMU}/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const signIn = (body) =>
  fetch(`${EMU}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// 1) Daftar + login
let res = await signUp({ email, password, returnSecureToken: true });
const signupText = await res.text();
assert.equal(res.status, 200, `signUp gagal: ${res.status} ${signupText}`);
let body = JSON.parse(signupText);
const uid = body.localId;

res = await signIn({ email, password, returnSecureToken: true });
assert.equal(res.status, 200, 'signIn gagal');
const token = (await res.json()).idToken;
console.log('OK  daftar + login, uid=', uid);

// 2) Buat profil (role student)
let api = await fetch(`${BASE}/api/auth/profile`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: 'Siswa Buku', level: 'SD/MI' }),
});
assert.equal(api.status, 201, `profile gagal: ${api.status} ${await api.text()}`);
console.log('OK  profil dibuat');

// 3) Tanpa token -> katalog tetap terbuka (login cuma buat unduh)
api = await fetch(`${BASE}/api/books`);
assert.equal(api.status, 200, `katalog harus publik, dapat ${api.status}`);
const anon = await api.json();
assert.ok(anon.items.length > 0, 'katalog publik kosong');
console.log('OK  /api/books terbuka tanpa login');

// 4) Kategori ngawur -> 400
api = await fetch(`${BASE}/api/books?category=ngawur`, { headers: { Authorization: `Bearer ${token}` } });
assert.equal(api.status, 400, `kategori ngawur harus 400, dapat ${api.status}`);
console.log('OK  kategori tidak dikenal ditolak (400)');

// 5) Daftar buku (halaman 1)
api = await fetch(`${BASE}/api/books`, { headers: { Authorization: `Bearer ${token}` } });
const listText = await api.text();
assert.equal(api.status, 200, `books gagal: ${api.status} ${listText}`);
let list = JSON.parse(listText);
assert.ok(list.items.length > 0, 'daftar buku kosong');
assert.ok(list.total > list.items.length, `total (${list.total}) harus > items (${list.items.length})`);
assert.ok(list.items.length <= 30, `items per halaman maksimal 30, dapat ${list.items.length}`);
assert.equal(list.page, 1);
console.log(`OK  /api/books halaman 1: ${list.items.length} buku, total=${list.total}, halaman=${list.totalPages}`);

// 6) Filter kategori
api = await fetch(`${BASE}/api/books?category=stem&limit=30`, {
  headers: { Authorization: `Bearer ${token}` },
});
list = await api.json();
assert.ok(list.items.length > 0, 'filter kategori stem kosong');
assert.ok(list.items.every((b) => b.category === 'stem'), 'ada buku dari kategori lain');
console.log(`OK  filter kategori stem: ${list.items.length} buku`);

// 7) Pencarian judul
const sample = list.items[0];
const word = sample.title.split(' ')[0];
api = await fetch(`${BASE}/api/books?q=${encodeURIComponent(word)}&limit=30`, {
  headers: { Authorization: `Bearer ${token}` },
});
list = await api.json();
assert.ok(list.items.length > 0, `pencarian "${word}" kosong`);
assert.ok(
  list.items.every((b) => b.title.toLowerCase().includes(word.toLowerCase())),
  'hasil pencarian tidak semua memuat kata kunci',
);
console.log(`OK  pencarian "${word}": ${list.items.length} buku`);

// 8) Pagination: halaman 2 != halaman 1, dan item tidak kembar
api = await fetch(`${BASE}/api/books?limit=10&page=1`, { headers: { Authorization: `Bearer ${token}` } });
const p1 = await api.json();
api = await fetch(`${BASE}/api/books?limit=10&page=2`, { headers: { Authorization: `Bearer ${token}` } });
const p2 = await api.json();
assert.equal(p1.items.length, 10);
assert.equal(p2.items.length, 10);
const ids1 = p1.items.map((b) => b.id);
const ids2 = p2.items.map((b) => b.id);
assert.equal(ids1.filter((id) => ids2.includes(id)).length, 0, 'halaman 1 dan 2 tumpang tindih');
console.log('OK  pagination: halaman 1 dan 2 tidak tumpang tindih');

// 9) Page di luar rentang -> diklem ke halaman terakhir
api = await fetch(`${BASE}/api/books?limit=10&page=9999`, { headers: { Authorization: `Bearer ${token}` } });
const clamped = await api.json();
assert.equal(clamped.page, clamped.totalPages, 'page di luar rentang harus diklem');
console.log('OK  page di luar rentang diklem ke', clamped.page);

// 10) limit melebihi batas -> dipotong ke 30
api = await fetch(`${BASE}/api/books?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
const capped = await api.json();
assert.equal(capped.limit, 30, `limit harus dipotong ke 30, dapat ${capped.limit}`);
console.log('OK  limit 500 dipotong ke 30');

// 11) Refresh cache -> student DITOLAK (403)
api = await fetch(`${BASE}/api/books/refresh`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
assert.equal(api.status, 403, `student tidak boleh refresh, dapat ${api.status}`);
console.log('OK  refresh ditolak untuk student (403)');

// 11b) Refresh cache -> tanpa token juga DITOLAK (401)
api = await fetch(`${BASE}/api/books/refresh`, { method: 'POST' });
assert.equal(api.status, 401, `tanpa token harus 401, dapat ${api.status}`);
console.log('OK  refresh ditolak tanpa token (401)');

// 12) Refresh cache -> admin BOLEH, dan hasilnya konsisten
const adminEmail = 'admin@sekolah.sch.id';
const adminPassword = 'Admin#12345';
let adminToken = null;
res = await signUp({ email: adminEmail, password: adminPassword, returnSecureToken: true });
if (res.status !== 200) {
  res = await signIn({ email: adminEmail, password: adminPassword, returnSecureToken: true });
}
if (res.status === 200) {
  adminToken = (await res.json()).idToken;
  api = await fetch(`${BASE}/api/auth/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Admin Sekolah' }),
  });
  const ap = JSON.parse(await api.text()).profile;
  assert.equal(ap.role, 'admin', 'email bootstrap harus jadi admin');

  api = await fetch(`${BASE}/api/books/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const refreshText = await api.text();
  assert.equal(api.status, 200, `refresh admin gagal: ${api.status} ${refreshText}`);
  const refreshed = JSON.parse(refreshText).refreshed;
  assert.ok(refreshed > 1500, `refresh harus menarik >1500 buku, dapat ${refreshed}`);
  console.log('OK  refresh oleh admin: ', refreshed, 'buku');

  // Refresh kedua harus idempotent: tidak ada dokumen yang ditulis ulang.
  // Kalau tidak, tiap refresh menghabiskan kuota tulis harian Firestore.
  api = await fetch(`${BASE}/api/books/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const second = JSON.parse(await api.text());
  assert.equal(second.written, 0, `refresh kedua harus menulis 0 dokumen, ditulis ${second.written}`);
  assert.equal(second.skipped, refreshed, `refresh kedua harus skip semua, di-skip ${second.skipped}`);
  console.log('OK  refresh kedua idempotent (0 dokumen ditulis)');

  // Total katalog setelah refresh harus sama dengan jumlah cache.
  api = await fetch(`${BASE}/api/books?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  const after = await api.json();
  assert.equal(after.total, refreshed, `total ${after.total} harus = refresh ${refreshed}`);
  console.log('OK  total katalog konsisten dengan jumlah hasil refresh');
} else {
  console.log('SKIP refresh admin: emulator auth tidak bisa membuat admin');
}

// 13) isPublished: false disembunyikan dari katalog, dan bertahan saat refresh
const { getDb } = await import('./src/config/firebase.js');
const db = getDb();
const hiddenId = 'stem_1491';
const hiddenRef = db.collection('books_cache').doc(hiddenId);
await hiddenRef.update({ isPublished: false });
try {
  // Refresh (admin) wajib invalidated cache buku tersembunyi, supaya status
  // terbit yang baru diubah langsung berlaku.
  if (adminToken) {
    api = await fetch(`${BASE}/api/books/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(api.status, 200, 'refresh untuk uji flag gagal');
  } else {
    const { refreshCatalog } = await import('./src/services/CatalogCacheService.js');
    await refreshCatalog();
  }

  api = await fetch(`${BASE}/api/books?q=${encodeURIComponent('Matematika untuk SD/MI Kelas I')}&limit=30`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const hiddenList = await api.json();
  assert.ok(
    !hiddenList.items.some((b) => b.id === hiddenId),
    'buku isPublished=false tidak boleh muncul di katalog',
  );
  console.log('OK  buku isPublished=false disembunyikan dari katalog');

  // Refresh cache tidak boleh menimpa flag milik admin.
  if (adminToken) {
    api = await fetch(`${BASE}/api/books/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(api.status, 200, 'refresh untuk uji flag gagal');
  } else {
    const { refreshCatalog } = await import('./src/services/CatalogCacheService.js');
    await refreshCatalog();
  }
  const afterRefresh = await hiddenRef.get();
  assert.equal(
    afterRefresh.data().isPublished,
    false,
    'refresh cache menimpa isPublished milik admin',
  );
  console.log('OK  refresh cache tidak menimpa isPublished milik admin');
} finally {
  await hiddenRef.update({ isPublished: true });
}

console.log('\nSemua uji katalog LULUS.');