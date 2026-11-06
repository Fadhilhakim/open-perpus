// Integrasi Firebase Authentication (email/password) untuk sisi browser.
// Dimuat sebagai script klasik; fungsi dipakai inline dari login.html.
var auth = null;

function setMsg(text, isError) {
  var el = document.getElementById('msg');
  el.textContent = text;
  el.style.color = isError ? '#c00' : '';
}

function setBusy(busy) {
  document.getElementById('btnLogin').disabled = busy;
  document.getElementById('btnRegister').disabled = busy;
  document.getElementById('btnLogin').textContent = busy ? 'Memproses...' : 'Masuk';
}

async function init() {
  var cfg = await apiFetch('/api/config');
  firebase.initializeApp(cfg.firebase);
  auth = firebase.auth();
  if (cfg.authEmulatorHost) {
    // Hanya dipakai saat backend diarahkan ke Auth Emulator (dev).
    // SDK browser wajib punya skema; kalau env hanya "host:port", tambahkan.
    var host = cfg.authEmulatorHost;
    if (host.indexOf('http://') !== 0 && host.indexOf('https://') !== 0) {
      host = 'http://' + host;
    }
    auth.useEmulator(host);
  }

  // Sudah login? Langsung ke beranda.
  if (auth.currentUser) {
    location.replace('/');
  }
}

function toAuthError(e) {
  var code = (e && e.code) || '';
  if (code === 'auth/invalid-email') return 'Format email tidak valid.';
  if (code === 'auth/missing-password') return 'Password wajib diisi.';
  if (code === 'auth/weak-password') return 'Password minimal 6 karakter.';
  if (code === 'auth/email-already-in-use') return 'Email sudah terdaftar.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password'
      || code === 'auth/user-not-found') return 'Email atau password salah.';
  if (code === 'auth/too-many-requests') return 'Terlalu banyak percobaan. Coba lagi nanti.';
  if (code === 'auth/network-request-failed') return 'Koneksi ke server auth gagal.';
  return (e && e.message) || 'Terjadi kesalahan.';
}

// Setelah login berhasil: buat/lengkapi profil di backend, lalu ke beranda.
async function afterAuth(user) {
  var token = await user.getIdToken();
  await apiFetch('/api/auth/profile', {
    method: 'POST',
    token: token,
    body: {
      name: document.getElementById('name').value.trim(),
      level: document.getElementById('level').value,
    },
  });
  location.replace('/');
}

async function doLogin() {
  var email = document.getElementById('email').value.trim();
  var password = document.getElementById('password').value;
  if (!email || !password) {
    return setMsg('Email dan password wajib diisi.', true);
  }
  setBusy(true);
  setMsg('');
  try {
    var res = await auth.signInWithEmailAndPassword(email, password);
    await afterAuth(res.user);
  } catch (e) {
    setMsg(toAuthError(e), true);
    setBusy(false);
  }
}

async function doRegister() {
  var email = document.getElementById('email').value.trim();
  var password = document.getElementById('password').value;
  if (!email || !password) {
    return setMsg('Email dan password wajib diisi.', true);
  }
  setBusy(true);
  setMsg('');
  try {
    var res = await auth.createUserWithEmailAndPassword(email, password);
    var name = document.getElementById('name').value.trim();
    if (name) await res.user.updateProfile({ displayName: name });
    await afterAuth(res.user);
  } catch (e) {
    setMsg(toAuthError(e), true);
    setBusy(false);
  }
}

init().catch(function (e) { setMsg('Gagal memuat konfigurasi: ' + e.message, true); });
