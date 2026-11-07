import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';
import { listBooks, getBook, refreshBooks } from '../controllers/BookController.js';

const router = Router();

// Katalog terbuka untuk umum — tanpa login. Login baru dibutuhkan saat
// ingin mengunduh buku (backend kuota unduhan memeriksa token).
router.get('/books', listBooks);

// Detail buku juga terbuka untuk umum (baca buku gratis tanpa login).
router.get('/books/:id', getBook);

// Refresh cache dari API sumber — hanya admin. Tanpa endpoint ini cache hanya
// pernah terisi saat boot pertama (cache juga kedaluwarsa otomatis per TTL).
router.post('/books/refresh', authMiddleware, roleMiddleware('admin'), refreshBooks);

export default router;
