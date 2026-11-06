// Uji login di browser sungguhan: daftar akun baru -> isi form -> masuk -> redirect ke beranda.
// Jalankan: node test-browser.mjs   (butuh auth emulator + server di localhost:3000)
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const email = `browser-${Date.now()}@sekolah.sch.id`;
const password = 'Browser#12345';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

// Pastikan request auth benar-benar_goes ke emulator, bukan produksi.
const authHosts = new Set();
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('identitytoolkit') || u.includes('accounts:')) {
    authHosts.add(new URL(u).host);
  }
});

// 1) Buka halaman login
await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
console.log('OK  login.html terbuka, judul =', await page.title());

// Class CSS yang dipakai harus sudah ada di index.html (tanpa CSS baru).
const cls = await page.evaluate(() => ({
  box: !!document.querySelector('.box'),
  btn: !!document.querySelector('.btn'),
  row: !!document.querySelector('.row'),
  input: !!document.querySelector('input#email'),
}));
console.log('OK  class CSS dipakai:', JSON.stringify(cls));
if (!cls.box || !cls.btn || !cls.row || !cls.input) throw new Error('class CSS tidak lengkap');

// 2) Daftar akun baru lewat form
await page.fill('#email', email);
await page.fill('#password', password);
await page.fill('#name', 'Siswa Browser');
await page.selectOption('#level', 'SD/MI');
await page.click('#btnRegister');
await page.waitForURL(BASE + '/', { timeout: 15000 });
console.log('OK  daftar + auto login -> redirect ke', new URL(page.url()).pathname);

console.log('    host auth yang dipakai:', [...authHosts].join(', ') || '(tidak ada request)');
if (![...authHosts].some((h) => h.includes('9099') || h.includes('127.0.0.1'))) {
  throw new Error('request auth tidak mengarah ke emulator: ' + [...authHosts].join(','));
}

// 3) Beranda harus memuat data profil dari backend
await page.waitForFunction(() => document.querySelector('#nav')?.innerText.includes('Keluar'), { timeout: 15000 });
const navText = await page.textContent('#nav');
console.log('OK  navbar:', navText.replace(/\s+/g, ' ').trim());

// 4) Muat ulang -> sesi bertahan (token Firebase di IndexedDB)
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('#nav')?.innerText.includes('Keluar'), { timeout: 15000 });
console.log('OK  sesi bertahan setelah reload');

// 5) Logout -> kembali ke beranda (beranda kini terbuka untuk umum)
await page.click('text=Keluar');
await page.waitForURL(BASE + '/', { timeout: 15000 });
await page.waitForFunction(() => document.querySelector('#nav')?.innerText.includes('Masuk'), { timeout: 15000 });
console.log('OK  logout -> kembali ke beranda, navbar menampilkan Masuk');

// 6) Buka beranda tanpa login -> TIDAK dialihkan, katalog tetap terbuka
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
if (new URL(page.url()).pathname !== '/') {
  throw new Error('beranda tanpa login tidak boleh dialihkan, ada di ' + new URL(page.url()).pathname);
}
await page.waitForFunction(() => document.querySelector('#nav')?.innerText.includes('Masuk'), { timeout: 15000 });
console.log('OK  beranda tanpa login tetap terbuka, navbar punya tombol Masuk');

// 6b) Tombol unduh harus minta login dulu
page.on('dialog', async (d) => {
  console.log('    dialog:', d.message());
  await d.accept();
});
await page.click('text=Katalog');
await page.waitForSelector('.card', { timeout: 20000 });
await page.click('.card');
await page.waitForSelector('button:has-text("Unduh PDF")', { timeout: 15000 });
await page.click('button:has-text("Unduh PDF")');
await page.waitForURL('**/login.html', { timeout: 15000 });
console.log('OK  unduh tanpa login -> diarahkan ke', new URL(page.url()).pathname);

// 7) Login salah password -> pesan error, tidak redirect
await page.fill('#email', email);
await page.fill('#password', 'PasswordSalah#1');
await page.click('#btnLogin');
await page.waitForFunction(() => document.getElementById('msg')?.textContent.trim().length > 0, { timeout: 15000 });
const msg = (await page.textContent('#msg')).trim();
console.log('OK  login salah -> pesan:', msg);
if (!/salah|gagal|tidak valid/i.test(msg)) throw new Error('pesan error tidak muncul: ' + msg);
if (new URL(page.url()).pathname !== '/login.html') throw new Error('seharusnya tetap di login.html');
console.log('    tetap di', new URL(page.url()).pathname);

// 8) Login benar -> masuk
await page.fill('#password', password);
await page.click('#btnLogin');
await page.waitForURL(BASE + '/', { timeout: 15000 });
console.log('OK  login benar ->', new URL(page.url()).pathname);

if (errors.length) {
  console.log('\nError browser yang tercatat:');
  for (const e of errors) console.log('  -', e);
}

await browser.close();
console.log('\nUji browser LULUS.');
