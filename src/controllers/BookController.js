import { isValidCategory } from '../models/BookCacheModel.js';
import { queryBooks, refreshCatalog } from '../services/CatalogCacheService.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 30;

// GET /api/books — daftar buku dengan filter kategori, pencarian judul, pagination.
export async function listBooks(req, res) {
  const { category, q, page, limit } = req.query;

  if (category && !isValidCategory(category)) {
    return res.status(400).json({ error: 'Kategori tidak dikenal' });
  }

  const parsedLimit = Number(limit);
  const finalLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const parsedPage = Number(page);
  const finalPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  const search = typeof q === 'string' ? q.trim().slice(0, 100) : '';

  try {
    const result = await queryBooks({
      category: category || null,
      q: search,
      page: finalPage,
      limit: finalLimit,
      // Endpoint ini terbuka untuk umum, jadi tidak ada peran admin di sini.
      // Buku yang disembunyikan admin tetap tidak muncul untuk siapa pun.
    });
    return res.json({ ...result, query: { category: category || null, q: search } });
  } catch (err) {
    console.error('[books]', err);
    return res.status(500).json({ error: 'Gagal memuat katalog' });
  }
}

// POST /api/books/refresh — tarik ulang cache dari API sumber (admin saja).
export async function refreshBooks(req, res) {
  try {
    const result = await refreshCatalog();
    return res.json(result);
  } catch (err) {
    console.error('[books/refresh]', err);
    return res.status(502).json({ error: 'Gagal menarik katalog dari API sumber' });
  }
}
