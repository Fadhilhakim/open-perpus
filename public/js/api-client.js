// Pembungkus fetch ke backend. Menambahkan token Firebase ID ke header Authorization.
// Dimuat sebagai script klasik (bukan module) supaya bisa dipakai dari index.html dan login.html.
async function apiFetch(path, options) {
  const { method = 'GET', body, token } = options || {};
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'HTTP ' + res.status);
    err.status = res.status;
    throw err;
  }
  return data;
}
