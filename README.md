# PINTARA Backend

REST API untuk **PINTARA — SIM LBB Jelajah Ilmu**, sistem informasi manajemen lembaga bimbingan belajar. Backend menangani autentikasi berbasis peran (`wali`, `tutor`, `pengelola`), pendaftaran siswa, pencocokan tutor, penawaran, penjadwalan, presensi, tagihan & pembayaran, honor tutor, notifikasi, dan pengunggahan berkas.

Kontrak API mengikuti tipe dan pemanggilan pada repo frontend PINTARA (`wali`, `tutor`, `pengelola`). Semua respons sukses mengembalikan objek/array apa adanya (tanpa pembungkus `data`), sedangkan error memakai bentuk `{ "error": { "code", "message", "details" } }`.

## Tech Stack

| Bagian | Teknologi |
| --- | --- |
| Runtime | Node.js 22+ |
| Bahasa | TypeScript (CommonJS build) |
| Framework | NestJS 11 |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 |
| Cache & rate limit | Redis 7 (fallback memori bila Redis tidak tersedia) |
| Validasi | class-validator + class-transformer |
| Auth | JWT Bearer + bcrypt |
| Storage | Disk lokal (`uploads/`) atau S3-compatible (MinIO/R2/AWS S3) |
| Keamanan | Helmet, CORS, throttler global |

## Fitur per Peran

**Wali murid (`wali`)**
- Dashboard ringkasan, profil, dan akun (termasuk kontak LBB)
- Pendaftaran siswa baru, status pendaftaran, dan kontak LBB
- Jadwal les mingguan, detail jadwal rutin, pengajuan perubahan jadwal
- Presensi: daftar menunggu validasi, riwayat, setujui, keberatan, ulasan sesi
- Riwayat les per bulan dengan ringkasan per mapel
- Tagihan SPP, detail tagihan, pembayaran (payment gateway simulasi), riwayat & hasil pembayaran
- Notifikasi (baca satu / baca semua)

**Tutor (`tutor`)**
- Dashboard ringkasan, akun & data pengajaran
- Presensi: sesi yang harus diisi, status per bulan, detail sesi, kirim presensi
- Unggah dokumentasi sesi (multipart)
- Riwayat mengajar per bulan/siswa
- Jadwal mingguan (4 minggu), detail sesi, pengajuan perubahan jadwal
- Notifikasi (baca satu / baca semua)

**Pengelola (`pengelola`)**
- Dashboard operasional & menu "Lainnya"
- Verifikasi / penolakan pendaftaran
- Pencocokan tutor (kandidat, skor, pemilihan tutor)
- Penawaran ke tutor: draf, kirim, terima, tolak
- Papan jadwal, draf jadwal per penawaran/pair, simpan jadwal (deteksi bentrok)
- Review pengajuan perubahan jadwal
- Rekap presensi, finalisasi presensi, review keberatan
- Rekap honor, kalkulasi honor, detail honor, pembayaran honor (dengan bukti)
- Notifikasi (baca satu / baca semua)

## Struktur Proyek

```
prisma/
  schema.prisma          # model PostgreSQL
  seed.ts                # data demo (reset penuh)
  migrations/            # migrasi SQL
src/
  main.ts                # bootstrap NestJS, CORS, helmet, static uploads
  app.module.ts          # wiring modul, guard global, throttler
  common/                # DTO pipe, error filter, guard, decorator, util
  config/env.ts          # konfigurasi environment
  infrastructure/
    prisma/              # PrismaService
    redis/               # RedisService (cache + throttle, fallback memori)
    storage/             # StorageService (local / S3)
  modules/
    auth/ health/ shared/
    wali/ tutor/ pengelola/
scripts/smoke.mjs        # smoke test end-to-end (server harus aktif)
tests/                   # suite e2e berbasis node:test
docs/API.md              # referensi endpoint
docs/CONTRACT.md         # pemetaan kontrak frontend
```

## Menjalankan

### 1. Prasyarat

- Node.js 22+
- PostgreSQL 16 (wajib)
- Redis 7 (opsional; tanpa Redis aplikasi tetap berjalan memakai memori)
- MinIO/S3 (opsional; default storage disk lokal)

Cara cepat dengan Docker:

```bash
docker compose up -d postgres redis
# opsional, untuk storage S3:
docker compose --profile storage up -d minio
```

### 2. Install & konfigurasi

```bash
npm install
cp .env.example .env
```

Sesuaikan `DATABASE_URL`, `JWT_SECRET`, dan `REDIS_URL` di `.env`.

### 3. Migrasi & seed

```bash
npx prisma migrate dev      # buat/terapkan migrasi + generate client
npx prisma db seed          # isi data demo
```

Atau reset total:

```bash
npm run db:reset
```

### 4. Jalankan

```bash
npm run start:dev           # watch mode
# atau
npm run build && npm start
```

API tersedia di `http://localhost:4000` (tanpa prefix `/api/v1`). Health check: `GET /health`.

## Akun Demo

Semua akun memakai password **`pintara123`**.

| Peran | Username | Nama |
| --- | --- | --- |
| wali | `sari.wulandari` | Sari Wulandari |
| wali | `dewi.ananda` | Dewi Ananda |
| wali | `arif.pratama` | Arif Pratama |
| wali | `lina.marlina` | Lina Marlina |
| wali | `hendra.wijaya` | Hendra Wijaya |
| tutor | `budi.santoso` | Kak Budi Santoso |
| tutor | `dimas.arya` | Kak Dimas Arya |
| tutor | `laila.fitri` | Kak Laila Fitri |
| tutor | `nadia.safitri` | Kak Nadia Safitri |
| pengelola | `ila` | Nurul Laila (Kak Ila) |

Login juga menerima email (mis. `sari.wulandari@gmail.com`).

## Scripts

| Perintah | Fungsi |
| --- | --- |
| `npm run start:dev` | Server development (watch) |
| `npm run build` | Kompilasi TypeScript ke `dist/` |
| `npm start` | Jalankan hasil build |
| `npm run typecheck` | Cek tipe tanpa emit |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run db:migrate` | Buat/terapkan migrasi baru |
| `npm run db:seed` | Isi ulang data demo |
| `npm run db:reset` | Reset database + migrasi + seed |
| `npm run db:studio` | Prisma Studio |
| `npm test` | Suite e2e (`node:test`) terhadap server aktif |
| `npm run smoke` | Smoke test ringkas terhadap server aktif |

> Test e2e dan smoke membutuhkan server yang sudah berjalan dan database demo yang sudah di-seed. Beberapa pemeriksaan bersifat mutasi (mis. pembayaran tagihan); jalankan `npm run db:seed` untuk mengembalikan data demo.

## Environment

```env
NODE_ENV=development
PORT=4000

DATABASE_URL="postgresql://pintara:pintara@localhost:5432/pintara?schema=public"
REDIS_URL="redis://localhost:6379"

JWT_SECRET="ganti-dengan-string-acak-minimal-16-karakter"
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
THROTTLE_TTL=900          # detik
THROTTLE_LIMIT=300        # request per TTL per IP
AUTH_THROTTLE_LIMIT=20    # request login per TTL per IP
CACHE_TTL_SECONDS=60

# Storage: local | s3
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=uploads

# S3-compatible (dipakai bila STORAGE_DRIVER=s3)
S3_ENDPOINT=
S3_REGION=us-east-1
S3_BUCKET=pintara
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=
```

`CORS_ORIGIN` menerima beberapa origin dipisah koma.

### Perilaku Redis

- Rate limit global dan login memakai Redis (`INCR` + `EXPIRE`) bila tersedia.
- Cache dashboard/daftar memakai Redis dengan TTL `CACHE_TTL_SECONDS`.
- Bila Redis tidak dapat dihubungi, aplikasi otomatis memakai implementasi memori dan `/health` melaporkan `"redis": "down"`. Tidak ada kegagalan startup.

### Storage

- `STORAGE_DRIVER=local` menyimpan berkas di `STORAGE_LOCAL_DIR` dan menyajikannya pada `/uploads/<file>`.
- `STORAGE_DRIVER=s3` mengunggah ke bucket S3-compatible dan mengembalikan URL publik (atau presigned URL bila `S3_PUBLIC_BASE_URL` kosong).

## Format Respons

**Sukses** — objek/array langsung sesuai tipe frontend:

```json
{
  "id": "reg-0100",
  "number": "REG-2026-0100",
  "studentName": "Aisyah Putri",
  "stage": "selesai"
}
```

**Error**:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data yang dikirim tidak valid",
    "details": [
      { "field": "identifier", "message": "identifier must be longer than or equal to 1 characters" }
    ]
  }
}
```

Kode status: `400` permintaan salah, `401` belum login/token tidak valid, `403` tidak punya akses, `404` data tidak ditemukan, `409` konflik (bentrok jadwal, duplikat, state tidak valid), `422` validasi, `429` rate limit, `500` error server.

Semua endpoint selain `POST /auth/login` dan `GET /health` memerlukan header:

```
Authorization: Bearer <token>
```

Guard peran diterapkan di level controller: `/wali/*` hanya untuk `wali`, `/tutor/*` hanya untuk `tutor`, `/pengelola/*` hanya untuk `pengelola`.

## Ringkasan Endpoint

Base URL: `http://localhost:4000` (tanpa prefix).

| Method | Endpoint | Akses |
| --- | --- | --- |
| GET | `/health` | Publik |
| POST | `/auth/login` | Publik |
| GET | `/auth/me` | Semua login |
| POST | `/auth/logout` | Semua login (stateless) |
| GET | `/wali/dashboard` | wali |
| GET | `/wali/profil`, `/wali/akun` | wali |
| GET | `/wali/pendaftaran/defaults`, `/wali/pendaftaran/terbaru`, `/wali/pendaftaran/:id` | wali |
| POST | `/wali/pendaftaran` | wali |
| GET | `/wali/jadwal`, `/wali/jadwal/:id`, `/wali/jadwal/rutin/:id` | wali |
| POST | `/wali/pengajuan-jadwal` | wali |
| GET | `/wali/pengajuan-jadwal/:id` | wali |
| GET | `/wali/presensi`, `/wali/presensi/:id` | wali |
| POST | `/wali/presensi/:id/setujui`, `/wali/presensi/:id/keberatan`, `/wali/presensi/:id/ulasan` | wali |
| GET | `/wali/riwayat-les` | wali |
| GET | `/wali/tagihan`, `/wali/tagihan/:id` | wali |
| POST | `/wali/tagihan/:id/bayar`, `/wali/tagihan/:id/pembayaran` | wali |
| GET | `/wali/pembayaran`, `/wali/pembayaran/:trxId` | wali |
| GET | `/tutor/dashboard`, `/tutor/akun` | tutor |
| GET | `/tutor/presensi`, `/tutor/presensi/status`, `/tutor/presensi/:id` | tutor |
| POST | `/tutor/presensi/:id` | tutor |
| POST | `/tutor/dokumentasi` | tutor (multipart `file`) |
| GET | `/tutor/riwayat` | tutor |
| GET | `/tutor/jadwal`, `/tutor/jadwal/:id` | tutor |
| POST | `/tutor/pengajuan-jadwal` | tutor |
| GET | `/pengelola/dashboard`, `/pengelola/lainnya` | pengelola |
| GET | `/pengelola/pendaftaran`, `/pengelola/pendaftaran/:id` | pengelola |
| POST | `/pengelola/pendaftaran/:id/verifikasi`, `/pengelola/pendaftaran/:id/tolak` | pengelola |
| GET | `/pengelola/pencocokan`, `/pengelola/pencocokan/:id` | pengelola |
| POST | `/pengelola/pencocokan/:id` | pengelola |
| GET | `/pengelola/penawaran`, `/pengelola/penawaran/draf/:registrationId`, `/pengelola/penawaran/:id` | pengelola |
| POST | `/pengelola/penawaran`, `/pengelola/penawaran/:id/diterima`, `/pengelola/penawaran/:id/ditolak` | pengelola |
| GET | `/pengelola/jadwal`, `/pengelola/jadwal/draf/:offerId`, `/pengelola/jadwal/:pairId` | pengelola |
| PUT | `/pengelola/jadwal` | pengelola |
| GET/POST | `/pengelola/pengajuan-jadwal/:id` | pengelola |
| GET | `/pengelola/presensi` | pengelola |
| POST | `/pengelola/presensi/final` | pengelola |
| GET/POST | `/pengelola/presensi/:id/keberatan` | pengelola |
| GET | `/pengelola/honor`, `/pengelola/honor/:bulan/:tutorId` | pengelola |
| POST | `/pengelola/honor/hitung`, `/pengelola/honor/:bulan/:tutorId/bayar` | pengelola |
| GET | `/{wali,tutor,pengelola}/notifikasi` | peran masing-masing |
| POST | `/{wali,tutor,pengelola}/notifikasi/:id/dibaca`, `/notifikasi/dibaca-semua` | peran masing-masing |
| POST | `/{wali,tutor,pengelola}/notifikasi/:id/read`, `/notifikasi/read-all` | alias |

Detail payload, contoh `curl`, dan bentuk respons ada di [`docs/API.md`](docs/API.md). Pemetaan tipe frontend ada di [`docs/CONTRACT.md`](docs/CONTRACT.md).

## Aturan Penting

- **Peran**: hanya `wali`, `tutor`, `pengelola` (lowercase). Tidak ada registrasi publik; akun dibuat lewat seed/operasional.
- **Jadwal & presensi**: jadwal rutin (`PairSession`) dimaterialisasi menjadi sesi les (`LessonSession`) untuk 8 minggu ke depan. Sesi lampau tidak dibuat ulang; sesi yang sudah memiliki presensi tidak dihapus saat jadwal diubah.
- **Bentrok jadwal**: disimpan/ditolak jika tutor sudah mengajar pada hari dan jam yang beririsan (termasuk buffer 15 menit).
- **Pembayaran**: disimulasikan. Metode `QRIS`, `Virtual Account BCA`, `GoPay`; status `berhasil`, `kedaluwarsa`, `gagal`. Nominal tidak boleh melebihi sisa tagihan. `simulateFailure: true` menghasilkan status `kedaluwarsa` (sesuai mock frontend dan layar "Pembayaran gagal").
- **Honor**: dihitung dari sesi yang sudah difinalisasi pada bulan berjalan, memakai tarif tutor per mapel. Pembayaran honor mengurangi total belum dibayar.
- **Notifikasi**: setiap aksi penting (verifikasi, penawaran, jadwal, presensi, pembayaran) membuat notifikasi untuk peran terkait.
- **Tanggal**: dikirim sebagai ISO-8601 UTC. Frontend menampilkan dalam zona Asia/Jakarta.
- **Uang**: integer rupiah tanpa desimal.
- **Password**: bcrypt (10 salt rounds), tidak pernah dikembalikan API.
- **Seed**: bersifat reset — seluruh data lama dihapus sebelum data demo dibuat.

## Catatan Pengembangan

- `package.json` memakai pemanggilan langsung `node node_modules/@nestjs/cli/bin/nest.js` agar tidak bergantung pada `node_modules/.bin` yang mungkin belum ter-link.
- Prisma Client di-generate lewat `postinstall` dan `npm run prisma:generate`.
- Untuk mengubah skema: edit `prisma/schema.prisma`, jalankan `npm run db:migrate`, lalu `npm run db:seed` bila perlu data demo baru.
