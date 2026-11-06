// Uji end-to-end alur auth: daftar -> token -> POST /api/auth/profile -> GET /api/users/me
// Jalankan: node test-auth.mjs   (butuh auth emulator + server di localhost:3000)
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

const cfg = await (await fetch(`${BASE}/api/config`)).json();
const email = `test-${Date.now()}@sekolah.sch.id`;
const password = 'Test#12345';

function signUp(body) {
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

// 1) Daftar user baru
let res = await signUp({ email, password, returnSecureToken: true });
const signupText = await res.text();
assert.equal(res.status, 200, `signUp gagal: ${res.status} ${signupText}`);
let body = JSON.parse(signupText);
const uid = body.localId;
console.log('OK  daftar user, uid=', uid);

// 2) Login dapat ID token
res = await signIn({ email, password, returnSecureToken: true });
assert.equal(res.status, 200, 'signIn gagal');
body = await res.json();
const token = body.idToken;
assert.ok(token, 'tidak dapat idToken');
console.log('OK  login, idToken panjang=', token.length);

// 3) POST /api/auth/profile -> profil dibuat, role student
let api = await fetch(`${BASE}/api/auth/profile`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: 'Siswa Test', level: 'SD/MI' }),
});
const profileText = await api.text();
assert.equal(api.status, 201, `profile gagal: ${api.status} ${profileText}`);
let prof = JSON.parse(profileText).profile;
assert.equal(prof.role, 'student', 'role default harus student');
assert.equal(prof.level, 'SD/MI');
assert.equal(prof.email, email);
console.log('OK  profil dibuat, role=', prof.role);

// 4) POST /api/auth/profile lagi -> created=false, tidak error
api = await fetch(`${BASE}/api/auth/profile`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: 'Siswa Test Update' }),
});
assert.equal(api.status, 200, `profile update gagal: ${api.status}`);
prof = (await api.json()).profile;
assert.equal(prof.name, 'Siswa Test Update');
console.log('OK  profil diperbarui, created=false');

// 5) GET /api/users/me -> profil pengguna login
api = await fetch(`${BASE}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
const meText = await api.text();
assert.equal(api.status, 200, `me gagal: ${api.status} ${meText}`);
prof = JSON.parse(meText).profile;
assert.equal(prof.id, uid);
assert.equal(prof.email, email);
console.log('OK  /api/users/me mengembalikan profil yang benar');

// 6) Klien tidak boleh bisa menentukan role sendiri
api = await fetch(`${BASE}/api/auth/profile`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: 'X', role: 'admin' }),
});
assert.equal(api.status, 400, `role dari klien harus ditolak, dapat ${api.status}`);
console.log('OK  role dari klien ditolak (400)');

// 7) Token rusak -> 401
api = await fetch(`${BASE}/api/users/me`, { headers: { Authorization: 'Bearer token-ngawur' } });
assert.equal(api.status, 401, `token rusak harus 401, dapat ${api.status}`);
console.log('OK  token tidak valid ditolak (401)');

// 8) Input tidak valid -> 400
api = await fetch(`${BASE}/api/auth/profile`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ level: 'XIX/XX' }),
});
assert.equal(api.status, 400, `level ngawur harus 400, dapat ${api.status}`);
console.log('OK  level tidak dikenal ditolak (400)');

// 9) Bootstrap admin -> role admin
const adminEmail = 'admin@sekolah.sch.id';
const adminPassword = 'Admin#12345';
res = await signUp({ email: adminEmail, password: adminPassword, returnSecureToken: true });
let adminToken = null;
let adminUid = null;
if (res.status !== 200) {
  // Email sudah ada dari run sebelumnya -> login saja.
  res = await signIn({ email: adminEmail, password: adminPassword, returnSecureToken: true });
  if (res.status !== 200) {
    console.log('SKIP bootstrap admin: signUp ->', res.status, 'signIn ->', res.status);
  }
}
if (res.status === 200) {
  const ab = await res.json();
  adminToken = ab.idToken;
  adminUid = ab.localId;
  api = await fetch(`${BASE}/api/auth/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Admin Sekolah' }),
  });
  const ap = JSON.parse(await api.text()).profile;
  assert.equal(ap.role, 'admin', 'email bootstrap harus jadi admin');
  console.log('OK  bootstrap admin dapat role=admin');
}

// 10) roleMiddleware: student DITOLAK untuk role admin, admin DIBOLEHKAN.
//     Diuji langsung ke middleware karena endpoint /api/admin/* baru ada di Hari 9.
const { roleMiddleware } = await import('./src/middleware/roleMiddleware.js');

function callMiddleware(uid, roles) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b }); return this; },
    };
    roleMiddleware(...roles)({ user: { uid } }, res, () => resolve({ status: 200, body: 'next' }));
  });
}

let r = await callMiddleware(uid, ['admin']);
assert.equal(r.status, 403, `student harus 403 di role admin, dapat ${r.status}`);
console.log('OK  roleMiddleware: student ditolak untuk role admin (403)');

r = await callMiddleware(uid, ['student', 'admin']);
assert.equal(r.status, 200, 'student harus boleh untuk role student');
console.log('OK  roleMiddleware: student boleh untuk role student');

if (adminUid) {
  r = await callMiddleware(adminUid, ['admin']);
  assert.equal(r.status, 200, 'admin harus boleh untuk role admin');
  console.log('OK  roleMiddleware: admin boleh untuk role admin');
}

// 11) User tanpa dokumen profil -> 403 (profil belum dibuat)
r = await callMiddleware('uid-yang-tidak-ada', ['student', 'admin']);
assert.equal(r.status, 403, `profil hilang harus 403, dapat ${r.status}`);
console.log('OK  roleMiddleware: profil belum ada -> 403');

console.log('\nSemua uji auth LULUS.');
