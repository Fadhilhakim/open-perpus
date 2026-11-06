# SIBI OPEN API
> API yang digunakan bersifat publik namun tidak resmi didokumentasikan; struktur endpoint dapat berubah sewaktu-waktu tanpa pemberitahuan.

## Tentang SIBI

**SIBI (Sistem Informasi Perbukuan Indonesia)** adalah sistem resmi yang menyediakan katalog buku digital gratis milik pemerintah Indonesia, dikelola oleh:

> **Pusat Perbukuan**
> Badan Kebijakan Pendidikan Dasar dan Menengah
> Kementerian Pendidikan Dasar dan Menengah Republik Indonesia

SIBI punya ke **767+ judul buku** dalam format PDF yang bisa didowload gratis, tersedia:

| Kategori | Deskripsi |
|---|---|
| **Buku Teks Kurikulum 2013** | Buku siswa K13 untuk jenjang SD/MI, SMP/MTs, SMA/MA/SMK |
| **Buku Teks Kurikulum Merdeka** | Buku Penggerak untuk Kurikulum Merdeka |
| **Buku Non-Teks** | Buku bacaan literasi anak, cerita rakyat, bacaan jenjang (PAUD–E) |
| **Buku bertag khusus (mis. STEM)** | Kumpulan buku berdasarkan tag tertentu |

> ⚠️ **Catatan:** API ini adalah endpoint publik yang ditemukan dan digunakan apa adanya.

## Base URL

```
https://api.buku.cloudapp.web.id/api/catalogue/
```

## Endpoint yang Tersedia

### 1. Buku Teks Kurikulum 2013
```
GET /getTextBooks
```
Contoh:
```
GET https://api.buku.cloudapp.web.id/api/catalogue/getTextBooks?limit=2000&order_by=updated_at
```

### 2. Buku Teks Kurikulum Merdeka
```
GET /getPenggerakTextBooks
```
Contoh:
```
GET https://api.buku.cloudapp.web.id/api/catalogue/getPenggerakTextBooks?limit=2000&order_by=updated_at
```

### 3. Buku Non-Teks
```
GET /getNonTextBooks
```
Contoh:
```
GET https://api.buku.cloudapp.web.id/api/catalogue/getNonTextBooks?limit=2000&order_by=updated_at&tag=Buku%20KURASI
```

### 4. Buku berdasarkan Tag (mis. STEM)
```
GET /getBooksByTag
```
Contoh:
```
GET https://api.buku.cloudapp.web.id/api/catalogue/getBooksByTag?tag=STEM&page=1&limit=24
```

### 5. Katalog Terbaru (semua kategori)
```
GET /
```

### 6. Detail Buku
```
GET /getDetails?id=[ID]
```
> Pada pengujian, endpoint ini sering mengembalikan `"Catalogue not found"` untuk ID yang valid. Disarankan mengambil detail langsung dari hasil `results[]` pada endpoint list, karena field yang dibutuhkan (penulis, ISBN, link PDF, dll) sudah lengkap di sana.

## Parameter Query Umum

| Parameter | Keterangan |
|---|---|
| `limit` | Jumlah data per request (mis. `limit=2000`) |
| `order_by` | Urutan data, mis. `order_by=updated_at` |
| `type_pdf` | Filter berdasarkan tipe file PDF |
| `tag` | Filter berdasarkan tag (mis. `tag=STEM`, `tag=Buku KURASI`) |
| `level` | Filter jenjang pembaca, mis. `level=E` (untuk buku non-teks) |
| `page` | Halaman (dipakai pada `getBooksByTag`) |

## Contoh Struktur Respons

```json
{
  "status": "success",
  "results": [
    {
      "id": "1",
      "title": "Kelas VI Tema 8 Bumiku",
      "image": "https://static-sc.cloudapp.web.id/content/thumbnail/....png",
      "attachment": "https://static-sc.cloudapp.web.id/content/pdf/....pdf",
      "writer": "Fransiska Susilawati, dkk",
      "publisher": "Pusat Kurikulum dan Perbukuan, Balitbang, Kemendikbud",
      "isbn": "978-602-427-226-5",
      "curriculum": "2013",
      "level": "SD/MI",
      "class": "6",
      "category": "buku_teks",
      "created_at": "2020-11-11 05:09:26",
      "updated_at": null
    }
  ],
  "totalSize": 767
}
```

