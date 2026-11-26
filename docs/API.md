# PINTARA API Reference

REST API untuk **PINTARA — SIM LBB Jelajah Ilmu**. Dokumen ini menjelaskan seluruh
endpoint yang dipakai oleh aplikasi frontend (`wali`, `tutor`, `pengelola`),
bentuk request, dan bentuk respons.

- **Base URL:** `http://localhost:4000` — **tanpa prefix** `/api/v1`.
- **Format:** JSON (kecuali unggah berkas yang memakai `multipart/form-data`).
- **Autentikasi:** JWT Bearer. Semua endpoint selain `POST /auth/login` dan
  `GET /health` memerlukan header:

  ```
  Authorization: Bearer <token>
  ```

- **Peran:** `wali`, `tutor`, `pengelola` (huruf kecil). Guard peran diterapkan
  per controller: `/wali/*` hanya `wali`, `/tutor/*` hanya `tutor`,
  `/pengelola/*` hanya `pengelola`.

---

## Format Respons

**Sukses** — objek/array dikembalikan apa adanya, tanpa pembungkus `data`:

```json
{
  "id": "reg-0118",
  "number": "REG-2026-0118",
  "studentName": "Nadia Salsabila",
  "stage": "menunggu_verifikasi"
}
```

**Error** — selalu berbentuk:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data yang dikirim tidak valid",
    "details": [
      { "field": "identifier", "message": "identifier should not be empty" }
    ]
  }
}
```

`details` hanya ada pada error validasi.

| Status | Arti |
| --- | --- |
| `200` | Berhasil (GET/POST aksi) |
| `201` | Berhasil membuat resource (unggah berkas) |
| `400` | Permintaan salah (mis. nominal tidak valid) |
| `401` | Belum login atau token tidak valid (`UNAUTHORIZED`, `invalid_credentials`) |
| `403` | Tidak punya akses / akun nonaktif (`FORBIDDEN`, `account_inactive`) |
| `404` | Data tidak ditemukan (`NOT_FOUND`) |
| `409` | Konflik state/duplikat/bentrok (`schedule_conflict`, `already_registered`, …) |
| `422` | Validasi DTO gagal (`VALIDATION_ERROR`, berisi `details`) |
| `429` | Rate limit terlampaui (`THROTTLE`) |
| `500` | Kesalahan server (`INTERNAL_ERROR`) |

Kode domain yang sering muncul: `invalid_credentials`, `account_inactive`,
`already_registered`, `schedule_conflict`, `tutor_unavailable`, `already_sent`,
`no_match`, `already_filled`, `not_started`, `already_processed`.

**Tanggal** dikirim sebagai ISO-8601 UTC; frontend menampilkannya dalam zona
Asia/Jakarta. **Uang** berupa integer rupiah (tanpa desimal).

---

## 1. Auth

| Method | Path | Akses | Keterangan |
| --- | --- | --- | --- |
| POST | `/auth/login` | Publik | Login dengan username **atau** email |
| GET | `/auth/me` | Semua login | Profil akun yang sedang login |
| POST | `/auth/logout` | Semua login | Logout (stateless) |

### POST `/auth/login`

```json
{ "identifier": "sari.wulandari", "password": "pintara123" }
```

`identifier` menerima username atau email (tidak peka huruf besar/kecil).

**200**

```json
{
  "id": "u-sari",
  "name": "Sari Wulandari",
  "role": "wali",
  "username": "sari.wulandari",
  "email": "sari.wulandari@gmail.com",
  "whatsapp": "0812-3456-7890",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Error: `401 invalid_credentials` (kredensial salah), `403 account_inactive`.

### GET `/auth/me`

```json
{
  "id": "u-budi",
  "name": "Kak Budi Santoso",
  "role": "tutor",
  "username": "budi.santoso",
  "email": "budi.santoso@gmail.com",
  "whatsapp": "0812-1111-2222"
}
```

### POST `/auth/logout`

```json
{ "ok": true }
```

Token tidak disimpan di server, sehingga logout cukup menghapus token di klien.

---

## 2. Health

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/health` | Publik |

```json
{
  "status": "ok",
  "database": "up",
  "redis": "down",
  "timestamp": "2026-11-26T14:03:16.802Z"
}
```

`status` menjadi `degraded` bila database tidak dapat dihubungi. `redis` bernilai
`down` bila Redis tidak tersedia (aplikasi tetap berjalan dengan fallback memori).

---

## 3. Wali Murid

Semua endpoint memerlukan role `wali`. Beberapa endpoint menerima query `?siswa=<studentId>`
untuk memilih anak saat wali memiliki lebih dari satu siswa.

### 3.1 Dashboard

| Method | Path |
| --- | --- |
| GET | `/wali/dashboard?siswa=<id>` |

```json
{
  "parent": { "name": "Sari Wulandari" },
  "students": [
    { "id": "s-aisyah", "name": "Aisyah Putri", "initials": "AP", "grade": "Kelas 8" }
  ],
  "activeStudentId": "s-aisyah",
  "nextSession": {
    "id": "cmwx3rvum000z...",
    "subject": "IPA",
    "start": "2026-11-27T09:00:00.000Z",
    "end": "2026-11-27T10:30:00.000Z",
    "tutor": {
      "name": "Kak Budi Santoso",
      "initials": "BS",
      "specialty": "Tutor Matematika & IPA"
    }
  },
  "tasks": [
    {
      "id": "validasi",
      "icon": "clipboard",
      "title": "1 sesi perlu divalidasi",
      "description": "Matematika · Aisyah Putri",
      "count": 1,
      "to": "/wali/absensi"
    }
  ],
  "weekSchedule": [
    {
      "id": "cmwx3rvri000d...",
      "subject": "Matematika",
      "start": "2026-11-26T09:00:00.000Z",
      "end": "2026-11-26T10:30:00.000Z",
      "tutorName": "Kak Budi Santoso"
    }
  ],
  "history": [
    {
      "id": "cmwx3rvri000d...",
      "subject": "Matematika",
      "date": "2026-11-25T09:00:00.000Z",
      "topic": "Persamaan linear satu variabel",
      "status": "keberatan"
    }
  ],
  "unreadNotifications": 3
}
```

### 3.2 Profil & Akun

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/wali/profil` | Data singkat untuk form pendaftaran |
| GET | `/wali/akun` | Layar Akun (W8) |

`GET /wali/profil`:

```json
{ "parentName": "Sari Wulandari", "parentPhone": "0812-3456-7890" }
```

`GET /wali/akun`:

```json
{
  "name": "Sari Wulandari",
  "initials": "SW",
  "role": "Wali Murid",
  "email": "sari.wulandari@gmail.com",
  "whatsapp": "0812-3456-7890",
  "username": "sari.wulandari",
  "students": [
    { "id": "s-aisyah", "name": "Aisyah Putri", "grade": "Kelas 8", "subjects": ["Matematika", "IPA"] }
  ],
  "lbbContact": {
    "name": "Kak Ila",
    "whatsapp": "6281234567890",
    "display": "0812-3456-7890"
  },
  "appVersion": "1.0.0"
}
```

### 3.3 Pendaftaran Siswa Baru

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/wali/pendaftaran/defaults` | Nilai awal form (nama & telepon wali) |
| POST | `/wali/pendaftaran` | Kirim pendaftaran |
| GET | `/wali/pendaftaran/terbaru` | Status pendaftaran terbaru |
| GET | `/wali/pendaftaran/:id` | Status pendaftaran tertentu |

`POST /wali/pendaftaran` — body:

```json
{
  "parentName": "Sari Wulandari",
  "parentPhone": "0812-3456-7890",
  "studentName": "Aisyah Putri",
  "grade": "8",
  "school": "SMP Negeri 3 Bangkalan",
  "address": "Jl. Raya Tanjung Bumi No. 3",
  "subjects": ["Matematika", "IPA"],
  "frequency": "2",
  "notes": "Lebih suka sore",
  "days": ["Rabu", "Jumat"],
  "startTime": "16.00"
}
```

**200** — ringkasan pendaftaran:

```json
{
  "id": "reg-0118",
  "registrationNumber": "REG-2026-0118",
  "submittedAt": "2026-11-26T08:06:46.429Z",
  "studentName": "Aisyah Putri"
}
```

Bila wali sudah punya pendaftaran aktif → `409 already_registered`.

`GET /wali/pendaftaran/terbaru` dan `GET /wali/pendaftaran/:id`:

```json
{
  "registration": {
    "id": "reg-0118",
    "number": "REG-2026-0118",
    "studentName": "Nadia Salsabila",
    "grade": "5 SD",
    "subjects": ["Matematika"],
    "days": ["Rabu"],
    "startTime": "15.30",
    "stage": "menunggu_verifikasi",
    "submittedAt": "2026-11-25T05:19:27.876Z"
  },
  "contact": {
    "name": "Pengelola LBB Jelajah Ilmu",
    "whatsapp": "6281234567890",
    "display": "0812-3456-7890"
  }
}
```

`stage`: `menunggu_verifikasi` → `pencocokan_tutor` → `selesai`, atau `ditolak`.
Bila belum ada pendaftaran, `registration` bernilai `null`.

Stage `selesai` menambahkan:

```json
{
  "match": { "tutorName": "Kak Budi Santoso", "matchedAt": "2026-11-26T…" },
  "firstSession": { "start": "2026-11-27T09:00:00.000Z", "confirmedAt": "2026-11-26T…" }
}
```

Stage `ditolak` menambahkan:

```json
{ "rejection": { "reason": "…", "rejectedAt": "2026-11-26T…" } }
```

### 3.4 Jadwal & Perubahan Jadwal

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/wali/jadwal?siswa=<id>` | Jadwal mingguan + rutin + pengajuan |
| GET | `/wali/jadwal/:id` | Detail jadwal rutin (**kontrak frontend**) |
| GET | `/wali/jadwal/rutin/:id` | Alias dari endpoint di atas |
| POST | `/wali/pengajuan-jadwal` | Ajukan perubahan jadwal |
| GET | `/wali/pengajuan-jadwal/:id` | Detail pengajuan |

`GET /wali/jadwal`:

```json
{
  "students": [{ "id": "s-aisyah", "name": "Aisyah Putri", "initials": "AP", "grade": "Kelas 8" }],
  "activeStudentId": "s-aisyah",
  "pendingRequests": [],
  "week": {
    "from": "2026-11-25T17:00:00.000Z",
    "to": "2026-12-02T17:00:00.000Z",
    "sessions": [
      {
        "id": "cmwx3rvum000z...",
        "routineId": "ps-pr-aisyah-ipa",
        "subject": "IPA",
        "start": "2026-11-27T09:00:00.000Z",
        "end": "2026-11-27T10:30:00.000Z",
        "tutorName": "Kak Budi Santoso"
      }
    ]
  },
  "routines": [
    {
      "id": "ps-pr-aisyah-matematika",
      "studentId": "s-aisyah",
      "subject": "Matematika",
      "weekday": 3,
      "startTime": "16.00",
      "durationMinutes": 90,
      "tutor": { "name": "Kak Budi Santoso", "shortName": "Kak Budi" },
      "location": "Rumah",
      "since": "2026-11-07T05:19:27.876Z",
      "studentName": "Aisyah Putri",
      "nextSession": "2026-12-02T09:00:00.000Z",
      "pendingRequest": null
    }
  ],
  "unreadNotifications": 3
}
```

`GET /wali/jadwal/:id`:

```json
{
  "id": "ps-pr-aisyah-matematika",
  "studentId": "s-aisyah",
  "subject": "Matematika",
  "weekday": 3,
  "startTime": "16.00",
  "durationMinutes": 90,
  "tutor": { "name": "Kak Budi Santoso", "shortName": "Kak Budi" },
  "location": "Rumah",
  "since": "2026-11-07T05:19:27.876Z",
  "studentName": "Aisyah Putri",
  "nextSession": "2026-12-02T09:00:00.000Z",
  "pendingRequest": null
}
```

`POST /wali/pengajuan-jadwal`:

```json
{
  "routineId": "ps-pr-aisyah-matematika",
  "scope": "sekali",
  "day": "Kamis",
  "startTime": "17.00",
  "reason": "Ada acara keluarga pada hari Rabu."
}
```

`scope`: `sekali` (satu sesi berikutnya) atau `selanjutnya` (berlaku seterusnya).

**200**:

```json
{
  "id": "cr-0001",
  "routineId": "ps-pr-aisyah-matematika",
  "studentId": "s-aisyah",
  "subject": "Matematika",
  "tutor": { "name": "Kak Budi Santoso", "shortName": "Kak Budi" },
  "durationMinutes": 90,
  "from": { "weekday": 3, "startTime": "16.00" },
  "to": { "weekday": 4, "startTime": "17.00" },
  "scope": "sekali",
  "effectiveDate": "2026-12-03T05:19:27.876Z",
  "reason": "Ada acara keluarga pada hari Rabu.",
  "status": "ditinjau_pengelola",
  "submittedAt": "2026-11-25T05:19:27.876Z"
}
```

### 3.5 Presensi

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/wali/presensi?siswa=<id>` | Sesi menunggu validasi + riwayat |
| GET | `/wali/presensi/:id` | Detail satu sesi |
| POST | `/wali/presensi/:id/setujui` | Setujui presensi |
| POST | `/wali/presensi/:id/keberatan` | Ajukan keberatan |
| POST | `/wali/presensi/:id/ulasan` | Kirim ulasan sesi |

`GET /wali/presensi`:

```json
{
  "pending": [ /* sesi presensi */ ],
  "history": [ /* sesi presensi */ ],
  "multipleStudents": false,
  "unreadNotifications": 3
}
```

Bentuk satu sesi presensi (`pending`/`history`/`GET /wali/presensi/:id`):

```json
{
  "id": "cmwx3rvri000d...",
  "studentId": "s-aisyah",
  "studentName": "Aisyah Putri",
  "subject": "Matematika",
  "start": "2026-11-25T09:00:00.000Z",
  "end": "2026-11-25T10:30:00.000Z",
  "tutor": { "name": "Kak Budi Santoso", "initials": "BS" },
  "tutorAttendance": "Hadir",
  "studentAttendance": "Hadir",
  "topic": "Persamaan linear satu variabel",
  "notes": "Lanjut latihan soal dan pembahasan.",
  "attachments": ["dokumentasi.pdf"],
  "status": "belum_divalidasi",
  "objection": { "reason": "…", "submittedAt": "…" },
  "review": { "rating": 5, "comment": "…", "submittedAt": "…" }
}
```

`status`: `belum_divalidasi` | `sudah_divalidasi` | `keberatan`.
Field `objection`/`review`/`validatedAt`/`cancelReason` hanya muncul bila relevan.

`POST /wali/presensi/:id/setujui` — tanpa body → mengembalikan sesi yang sudah divalidasi.

`POST /wali/presensi/:id/keberatan`:

```json
{ "reason": "Les hanya berlangsung 45 menit, bukan 90 menit." }
```

`POST /wali/presensi/:id/ulasan`:

```json
{ "rating": 5, "comment": "Tutor menjelaskan dengan jelas." }
```

`rating` integer 1–5.

### 3.6 Riwayat Les

| Method | Path |
| --- | --- |
| GET | `/wali/riwayat-les?siswa=<id>&bulan=YYYY-MM` |

```json
{
  "students": [{ "id": "s-aisyah", "name": "Aisyah Putri" }],
  "studentId": "s-aisyah",
  "months": ["2026-11-30T17:00:00.000Z", "2026-10-31T17:00:00.000Z"],
  "month": "2026-10-31T17:00:00.000Z",
  "sessions": [
    {
      "id": "cmwx3rvum000z...",
      "studentId": "s-aisyah",
      "studentName": "Aisyah Putri",
      "subject": "IPA",
      "start": "2026-11-27T09:00:00.000Z",
      "end": "2026-11-27T10:30:00.000Z",
      "tutor": { "name": "Kak Budi Santoso", "initials": "BS" },
      "tutorAttendance": "Hadir",
      "studentAttendance": "Hadir",
      "topic": "",
      "notes": "",
      "attachments": [],
      "status": "belum_divalidasi"
    }
  ],
  "summary": {
    "held": 7,
    "cancelled": 0,
    "upcoming": 1,
    "bySubject": [
      { "subject": "Matematika", "count": 4 },
      { "subject": "IPA", "count": 3 }
    ]
  }
}
```

`months` = daftar bulan yang memiliki data (terbaru dulu). Bila `bulan` tidak
dikirim, default bulan berjalan.

### 3.7 Tagihan & Pembayaran

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/wali/tagihan` | Tagihan prioritas + lainnya |
| GET | `/wali/tagihan/:id` | Detail tagihan |
| POST | `/wali/tagihan/:id/bayar` | Bayar (kontrak frontend) |
| POST | `/wali/tagihan/:id/pembayaran` | Alias dari endpoint di atas |
| GET | `/wali/pembayaran` | Riwayat transaksi |
| GET | `/wali/pembayaran/:trxId` | Hasil transaksi (id atau externalId) |

`GET /wali/tagihan`:

```json
{
  "priority": {
    "id": "bill-fikri-current",
    "number": "INV-2026-0104",
    "studentName": "Fikri Ramadhan",
    "period": "2026-10-31T17:00:00.000Z",
    "dueDate": "2026-11-15T17:00:00.000Z",
    "items": [
      { "subject": "Bahasa Inggris", "sessions": 4, "unitPrice": 75000 }
    ],
    "total": 300000,
    "paid": 0
  },
  "others": [ /* tagihan lain dengan bentuk sama */ ],
  "unreadNotifications": 3
}
```

`priority` bernilai `null` bila tidak ada tagihan mendesak.

`POST /wali/tagihan/:id/bayar` (JSON):

```json
{ "nominal": 300000, "simulateFailure": false }
```

- `nominal` wajib, minimal 1 dan tidak boleh melebihi sisa tagihan.
- `simulateFailure` opsional; `true` membuat transaksi berstatus `kedaluwarsa`.
- Payment gateway disimulasikan: metode `QRIS` untuk pelunasan, `Virtual Account BCA`
  untuk pembayaran sebagian (`GoPay` tersedia pada tipe frontend).

**200**:

```json
{
  "payment": {
    "id": "TRX-20261126-8845",
    "billId": "bill-fikri-current",
    "billPeriod": "2026-10-31T17:00:00.000Z",
    "amount": 300000,
    "method": "QRIS",
    "status": "berhasil",
    "createdAt": "2026-11-26T14:02:41.115Z"
  },
  "bill": {
    "id": "bill-fikri-current",
    "number": "INV-2026-0104",
    "studentName": "Fikri Ramadhan",
    "period": "2026-10-31T17:00:00.000Z",
    "dueDate": "2026-11-15T17:00:00.000Z",
    "items": [{ "subject": "Bahasa Inggris", "sessions": 4, "unitPrice": 75000 }],
    "total": 300000,
    "paid": 300000
  }
}
```

`payment.status`: `berhasil` | `kedaluwarsa` | `gagal`.
`bill.paid === bill.total` berarti lunas. Status tagihan turunan:
`belum_bayar` (paid 0), `sebagian` (0 < paid < total), `lunas` (paid ≥ total).

`GET /wali/pembayaran` → array `Payment`:

```json
[
  {
    "id": "TRX-20261126-8845",
    "billId": "bill-fikri-current",
    "billPeriod": "2026-10-31T17:00:00.000Z",
    "amount": 300000,
    "method": "QRIS",
    "status": "berhasil",
    "createdAt": "2026-11-26T14:02:41.115Z"
  }
]
```

`GET /wali/pembayaran/:trxId` → `{ "payment": Payment, "bill": Bill }`.

### 3.8 Notifikasi (wali)

| Method | Path |
| --- | --- |
| GET | `/wali/notifikasi` |
| POST | `/wali/notifikasi/:id/dibaca` |
| POST | `/wali/notifikasi/dibaca-semua` |
| POST | `/wali/notifikasi/:id/read` (alias) |
| POST | `/wali/notifikasi/read-all` (alias) |

Lihat [Notifikasi](#9-notifikasi-semua-peran).

---

## 4. Tutor

Semua endpoint memerlukan role `tutor`.

### 4.1 Dashboard & Akun

| Method | Path |
| --- | --- |
| GET | `/tutor/dashboard` |
| GET | `/tutor/akun` |

`GET /tutor/dashboard`:

```json
{
  "tutor": { "name": "Kak Budi Santoso" },
  "nextSession": {
    "id": "cmwx3rvxs001l...",
    "subject": "IPA",
    "start": "2026-11-24T11:30:00.000Z",
    "end": "2026-11-24T13:00:00.000Z",
    "student": "Rizky Ananda",
    "address": "…"
  },
  "tasks": [
    {
      "id": "presensi",
      "icon": "clipboard",
      "title": "Isi presensi 1 sesi",
      "description": "IPA · Rizky Ananda · Jumat",
      "count": 1,
      "to": "/tutor/presensi"
    }
  ],
  "upcoming": [
    { "id": "…", "subject": "IPA", "studentName": "Rizky Ananda", "start": "…", "end": "…" }
  ],
  "recap": {
    "month": "November",
    "held": 17,
    "validated": 13,
    "waitingParent": 3,
    "disputed": 1
  }
}
```

`GET /tutor/akun`:

```json
{
  "name": "Kak Budi Santoso",
  "initials": "BS",
  "role": "Tutor",
  "email": "budi.santoso@gmail.com",
  "teaching": {
    "subjects": ["Matematika", "IPA"],
    "levels": "SMP–SMA",
    "availability": "Senin–Sabtu, 15.00–21.00",
    "rate": 60000
  },
  "lbbContact": { "name": "Kak Ila", "whatsapp": "6281234567890", "display": "0812-3456-7890" },
  "appVersion": "1.0.0"
}
```

### 4.2 Presensi

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/tutor/presensi` | Sesi yang perlu diisi, nanti hari ini, sudah diisi |
| GET | `/tutor/presensi/status?bulan=YYYY-MM` | Rekap per bulan |
| GET | `/tutor/presensi/:id` | Detail sesi |
| POST | `/tutor/presensi/:id` | Kirim presensi |

`GET /tutor/presensi`:

```json
{
  "toFill": [ /* sesi */ ],
  "laterToday": [ /* sesi */ ],
  "filled": [ /* sesi */ ]
}
```

Bentuk sesi tutor (`serializeTutorSession`):

```json
{
  "id": "cmwx3rvxs001l...",
  "subject": "IPA",
  "student": {
    "name": "Rizky Ananda",
    "parentName": "Dewi Ananda",
    "parentSalutation": "Ibu"
  },
  "start": "2026-11-24T11:30:00.000Z",
  "end": "2026-11-24T13:00:00.000Z",
  "record": null
}
```

`record` berisi presensi yang sudah dikirim:

```json
{
  "held": true,
  "actualStart": "16.00",
  "actualEnd": "17.30",
  "studentPresent": true,
  "topic": "Latihan soal",
  "notes": "…",
  "attachment": { "name": "dokumentasi.pdf", "size": 12345 },
  "submittedAt": "2026-11-26T05:20:31.009Z",
  "validation": "belum_divalidasi",
  "objection": { "reason": "…", "at": "…" },
  "review": { "corrected": true, "note": "…", "at": "…" },
  "finalAt": "2026-11-30T…"
}
```

`validation`: `belum_divalidasi` | `sudah_divalidasi` | `keberatan`.
`review` muncul setelah pengelola meninjau keberatan.

`GET /tutor/presensi/status?bulan=YYYY-MM`:

```json
{
  "months": ["2026-11-30T17:00:00.000Z", "2026-10-31T17:00:00.000Z"],
  "month": "2026-10-31T17:00:00.000Z",
  "total": 18,
  "disputed": [ /* sesi */ ],
  "waiting": [ /* sesi */ ],
  "notCollected": [ /* sesi */ ],
  "verified": [ /* sesi */ ]
}
```

`POST /tutor/presensi/:id` (JSON):

```json
{
  "held": true,
  "actualStart": "16.00",
  "actualEnd": "17.30",
  "studentPresent": true,
  "topic": "Latihan soal",
  "notes": "Siswa aktif.",
  "attachment": { "name": "dokumentasi.pdf", "size": 12345 },
  "cancelReason": null
}
```

Bila `held: false`, sertakan `cancelReason`. Mengirim ulang sesi yang sudah ada
akan memperbarui presensi (kecuali sudah difinalisasi).

### 4.3 Unggah Dokumentasi

| Method | Path |
| --- | --- |
| POST | `/tutor/dokumentasi` (multipart `file`) |

```bash
curl -X POST http://localhost:4000/tutor/dokumentasi \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@dokumentasi.pdf"
```

**201**:

```json
{
  "name": "dokumentasi.pdf",
  "size": 12345,
  "url": "/uploads/139ad3a4-8e77-494e-a378-c44f960d6a5f.pdf"
}
```

Dengan `STORAGE_DRIVER=s3`, `url` berupa URL publik/presigned.

### 4.4 Riwayat

| Method | Path |
| --- | --- |
| GET | `/tutor/riwayat?bulan=YYYY-MM&siswa=<studentId>` |

```json
{
  "months": ["2026-11-30T17:00:00.000Z", "2026-10-31T17:00:00.000Z"],
  "month": "2026-10-31T17:00:00.000Z",
  "students": [{ "id": "s-aisyah", "name": "Aisyah Putri" }],
  "student": null,
  "sessions": [ /* sesi tutor */ ],
  "summary": {
    "held": 17,
    "cancelled": 0,
    "studentCount": 3,
    "byStudent": [
      { "name": "Aisyah Putri", "count": 7 },
      { "name": "Rizky Ananda", "count": 6 },
      { "name": "Dimas Pratama", "count": 4 }
    ]
  }
}
```

### 4.5 Jadwal

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/tutor/jadwal?minggu=0` | Jadwal 4 minggu (0 = minggu ini) |
| GET | `/tutor/jadwal/:id` | Detail sesi |
| POST | `/tutor/pengajuan-jadwal` | Ajukan perubahan jadwal |

`GET /tutor/jadwal`:

```json
{
  "week": 0,
  "weeks": [
    { "from": "2026-11-26T17:00:00.000Z", "to": "2026-12-02T17:00:00.000Z" },
    { "from": "2026-12-03T17:00:00.000Z", "to": "2026-12-09T17:00:00.000Z" },
    { "from": "2026-12-10T17:00:00.000Z", "to": "2026-12-16T17:00:00.000Z" },
    { "from": "2026-12-17T17:00:00.000Z", "to": "2026-12-23T17:00:00.000Z" }
  ],
  "days": [
    {
      "date": "2026-11-26T17:00:00.000Z",
      "sessions": [
        {
          "id": "cmwx3rvum000z...",
          "routineId": "ps-pr-aisyah-ipa",
          "subject": "IPA",
          "start": "2026-11-27T09:00:00.000Z",
          "end": "2026-11-27T10:30:00.000Z",
          "student": { "name": "Aisyah Putri", "grade": "Kelas 8 SMP" },
          "address": "Jl. Trunojoyo No. 12, Bangkalan",
          "shortAddress": "Jl. Trunojoyo No. 12"
        }
      ]
    }
  ],
  "freeDays": []
}
```

`GET /tutor/jadwal/:id`:

```json
{
  "id": "cmwx3rvum000z...",
  "subject": "IPA",
  "student": { "name": "Aisyah Putri", "grade": "8", "level": "SMP" },
  "start": "2026-11-27T09:00:00.000Z",
  "end": "2026-11-27T10:30:00.000Z",
  "record": null,
  "parent": { "name": "Sari Wulandari", "salutation": "Ibu", "whatsapp": "…" },
  "previous": null
}
```

`POST /tutor/pengajuan-jadwal` — body sama dengan wali
(`routineId`, `scope`, `day`, `startTime`, `reason`).

### 4.6 Notifikasi (tutor)

| Method | Path |
| --- | --- |
| GET | `/tutor/notifikasi` |
| POST | `/tutor/notifikasi/:id/dibaca` |
| POST | `/tutor/notifikasi/dibaca-semua` |
| POST | `/tutor/notifikasi/:id/read` (alias) |
| POST | `/tutor/notifikasi/read-all` (alias) |

---

## 5. Pengelola

Semua endpoint memerlukan role `pengelola`.

### 5.1 Dashboard & Menu

| Method | Path |
| --- | --- |
| GET | `/pengelola/dashboard` |
| GET | `/pengelola/lainnya` |

`GET /pengelola/dashboard`:

```json
{
  "admin": { "name": "Nurul Laila (Kak Ila)" },
  "today": {
    "date": "2026-11-26T14:03:47.941Z",
    "sessions": 2,
    "tutorsOnDuty": 2,
    "attendanceSubmitted": 0,
    "missingYesterday": 0
  },
  "tasks": [
    {
      "id": "verifikasi",
      "icon": "user-plus",
      "title": "Verifikasi pendaftaran",
      "description": "Pendaftaran menunggu verifikasi",
      "count": 3,
      "to": "/pengelola/pendaftaran"
    }
  ],
  "billing": {
    "month": "November",
    "paidAmount": 610000,
    "totalAmount": 900000,
    "invoices": 2,
    "dueDate": "2026-11-15T17:00:00.000Z",
    "lunas": 1,
    "sebagian": 1,
    "belumBayar": 0
  },
  "unreadNotifications": 2
}
```

`GET /pengelola/lainnya`:

```json
{
  "name": "Nurul Laila (Kak Ila)",
  "initials": "NL",
  "role": "Pengelola LBB",
  "email": "ila@jelajahilmu.id",
  "tutors": { "total": 4, "active": 4 },
  "students": { "total": 8, "active": 6 },
  "failedNotifications": 0
}
```

### 5.2 Pendaftaran

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/pengelola/pendaftaran?status=&q=&level=` | Daftar + hitungan per status |
| GET | `/pengelola/pendaftaran/:id` | Detail |
| POST | `/pengelola/pendaftaran/:id/verifikasi` | Verifikasi |
| POST | `/pengelola/pendaftaran/:id/tolak` | Tolak |

`GET /pengelola/pendaftaran`:

```json
{
  "counts": { "menunggu_verifikasi": 3, "terverifikasi": 7, "ditolak": 1 },
  "items": [
    {
      "id": "reg-0118",
      "number": "REG-2026-0118",
      "student": {
        "name": "Nadia Salsabila",
        "grade": "5",
        "level": "SD",
        "school": "SD Negeri Kemayoran 1",
        "address": "Jl. Halim Perdana Kusuma No. 8, Bangkalan"
      },
      "parent": {
        "name": "Rina Kartika",
        "salutation": "Ibu",
        "whatsapp": "0812-7788-9900",
        "email": "rina.kartika@gmail.com"
      },
      "needs": {
        "subjects": ["Matematika"],
        "perWeek": 1,
        "days": ["Rabu"],
        "startTime": "15.30"
      },
      "submittedAt": "2026-11-25T05:19:27.876Z",
      "status": "menunggu_verifikasi"
    }
  ]
}
```

`status`: `menunggu_verifikasi` | `terverifikasi` | `ditolak`.
Item `terverifikasi` menambahkan `verifiedAt` dan (bila sudah) `match`:

```json
{ "match": { "tutorId": "tt-budi", "tutorName": "Kak Budi Santoso", "at": "…" } }
```

Item `ditolak` menambahkan:

```json
{ "rejection": { "reason": "lainnya", "message": "…", "at": "…" } }
```

`POST /pengelola/pendaftaran/:id/tolak`:

```json
{ "reason": "jarak_terlalu_jauh", "message": "Tutor terdekat di luar jangkauan." }
```

`POST …/verifikasi` tanpa body → mengembalikan pendaftaran berstatus `terverifikasi`.
Verifikasi juga membuat akun siswa dan menautkannya ke wali.

### 5.3 Pencocokan Tutor

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/pengelola/pencocokan` | Antrean pendaftaran siap dicocokkan |
| GET | `/pengelola/pencocokan/:id` | Kandidat tutor + skor |
| POST | `/pengelola/pencocokan/:id` | Pilih tutor |

`GET /pengelola/pencocokan` → array pendaftaran `terverifikasi` (bentuk sama
dengan item pendaftaran).

`GET /pengelola/pencocokan/:id`:

```json
{
  "registration": { /* … */ },
  "candidates": [
    {
      "tutorId": "tt-budi",
      "name": "Kak Budi Santoso",
      "shortName": "Kak Budi",
      "initials": "BS",
      "education": "S1 Pendidikan Matematika",
      "rating": 4.9,
      "activeStudents": 3,
      "criteria": [
        { "label": "Matematika & IPA SMP", "met": true },
        { "label": "Tersedia Rabu, 16.00", "met": true },
        { "label": "Jarak 2.4 km dari alamat les", "met": true }
      ],
      "score": 92,
      "fullMatch": true
    }
  ],
  "fullMatches": 1
}
```

Skor dihitung dari kecocokan mapel (40%), ketersediaan hari/jam (30%), jarak
(hingga 20 poin), dan rating tutor. Jarak memakai Haversine bila koordinat
tersedia; jika tidak, memakai `defaultDistanceKm`/override per pendaftaran.
Kandidat yang sama sekali tidak mengajar mapel diminta tidak ditampilkan.

`POST /pengelola/pencocokan/:id`:

```json
{ "tutorId": "tt-budi" }
```

**200** → pendaftaran dengan `match` terisi.

### 5.4 Penawaran

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/pengelola/penawaran` | Belum dikirim, menunggu, riwayat |
| GET | `/pengelola/penawaran/draf/:registrationId` | Draf penawaran |
| POST | `/pengelola/penawaran` | Kirim penawaran |
| GET | `/pengelola/penawaran/:id` | Detail |
| POST | `/pengelola/penawaran/:id/diterima` | Tutor menerima |
| POST | `/pengelola/penawaran/:id/ditolak` | Tutor menolak |

`GET /pengelola/penawaran`:

```json
{
  "unsent": [
    { "registration": { /* … */ }, "tutorName": "Kak Budi Santoso" }
  ],
  "waiting": [ /* offer */ ],
  "history": [ /* offer */ ]
}
```

Bentuk `offer`:

```json
{
  "id": "cmwx3trg0000...",
  "registrationId": "reg-0115",
  "student": { "name": "Rafi Hidayat", "grade": "11", "level": "SMA" },
  "tutor": { "id": "tt-dimas", "name": "Kak Dimas Arya", "shortName": "Kak Dimas" },
  "subjects": ["Fisika", "Matematika"],
  "schedule": "Senin & Kamis, 19.00",
  "location": "Perum Griya Utama Blok C-7",
  "distanceKm": 4.2,
  "rate": 60000,
  "message": "Silakan konfirmasi",
  "sentAt": "2026-11-26T05:20:56.112Z",
  "status": "diterima",
  "answeredAt": "2026-11-26T05:20:56.151Z"
}
```

`status`: `menunggu_konfirmasi` | `diterima` | `ditolak`.
Penolakan menambahkan:

```json
{ "decline": { "reason": "jadwal_bentrok", "note": "…" } }
```

`POST /pengelola/penawaran`:

```json
{ "registrationId": "reg-0115", "message": "Silakan konfirmasi" }
```

Bila penawaran untuk tutor yang sama sudah dikirim → `409 already_sent`.

`POST /pengelola/penawaran/:id/ditolak`:

```json
{ "reason": "jadwal_bentrok", "note": "Bentrok dengan jadwal lain." }
```

### 5.5 Jadwal

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/pengelola/jadwal` | Papan jadwal |
| GET | `/pengelola/jadwal/draf/:offerId` | Draf dari penawaran |
| GET | `/pengelola/jadwal/:pairId` | Draf pair aktif |
| PUT | `/pengelola/jadwal` | Simpan jadwal |

`GET /pengelola/jadwal`:

```json
{
  "toSchedule": [ /* penawaran diterima, belum dijadwalkan */ ],
  "requests": [ /* pengajuan perubahan jadwal */ ],
  "active": [
    {
      "id": "pr-aisyah",
      "student": { "name": "Aisyah Putri", "grade": "8", "level": "SMP" },
      "parentName": "Sari Wulandari",
      "tutor": { "id": "tt-budi", "name": "Kak Budi Santoso", "shortName": "Kak Budi" },
      "subjects": ["Matematika", "IPA"],
      "sessions": [
        { "subject": "Matematika", "day": "Rabu", "start": "16.00", "end": "17.30" },
        { "subject": "IPA", "day": "Jumat", "start": "16.00", "end": "17.30" }
      ],
      "effectiveFrom": "2026-11-07T05:19:27.876Z",
      "offerId": "pw-0001"
    }
  ]
}
```

`GET /pengelola/jadwal/:pairId` (draf pair aktif):

```json
{
  "pairId": "pr-aisyah",
  "offerId": "pw-0001",
  "student": { "name": "Aisyah Putri", "grade": "8", "level": "SMP" },
  "parentName": "Sari Wulandari",
  "tutor": { "id": "tt-budi", "name": "Kak Budi Santoso", "shortName": "Kak Budi" },
  "subjects": ["Matematika", "IPA"],
  "sessions": [
    { "subject": "Matematika", "day": "Rabu", "start": "16.00", "end": "17.30" },
    { "subject": "IPA", "day": "Jumat", "start": "16.00", "end": "17.30" }
  ],
  "effectiveFrom": "2026-11-07T05:19:27.876Z"
}
```

`GET /pengelola/jadwal/draf/:offerId` (draf dari penawaran yang diterima,
sebelum pair dibuat) menambahkan `requested`:

```json
{
  "offerId": "pw-0001",
  "student": { "name": "Rafi Hidayat", "grade": "11", "level": "SMA" },
  "parentName": "Hendra Wijaya",
  "tutor": { "id": "tt-dimas", "name": "Kak Dimas Arya", "shortName": "Kak Dimas" },
  "subjects": ["Fisika", "Matematika"],
  "requested": "Senin & Kamis, 19.00 · 2× per minggu",
  "sessions": [
    { "subject": "Fisika", "day": "Senin", "start": "19.00", "end": "20.30" },
    { "subject": "Matematika", "day": "Kamis", "start": "19.00", "end": "20.30" }
  ],
  "effectiveFrom": "2026-11-30T17:00:00.000Z"
}
```

`PUT /pengelola/jadwal`:

```json
{
  "draft": { "pairId": "pr-aisyah", "offerId": "pw-0001" },
  "sessions": [
    { "subject": "Matematika", "day": "Rabu", "start": "16.00", "end": "17.30" },
    { "subject": "IPA", "day": "Jumat", "start": "16.00", "end": "17.30" }
  ],
  "effectiveFrom": "2026-11-07"
}
```

Bila bentrok dengan jadwal tutor lain → `409 schedule_conflict`.
Endpoint ini membuat/memperbarui `PairSession` dan mematerialisasi sesi les ke depan.

Catatan: `draft` bebas berisi `pairId`/`offerId` (dan metadata lain dari draf);
`pairId` dipakai untuk memperbarui pair yang ada, `offerId` untuk membuat pair baru.

### 5.6 Pengajuan Perubahan Jadwal

| Method | Path |
| --- | --- |
| GET | `/pengelola/pengajuan-jadwal/:id` |
| POST | `/pengelola/pengajuan-jadwal/:id` |

`GET` mengembalikan bentuk `ChangeReview`:

```json
{
  "request": {
    "id": "cr-0001",
    "routineId": "ps-pr-aisyah-matematika",
    "studentId": "s-aisyah",
    "subject": "Matematika",
    "tutor": { "name": "Kak Budi Santoso", "shortName": "Kak Budi" },
    "durationMinutes": 90,
    "from": { "weekday": 3, "startTime": "16.00" },
    "to": { "weekday": 4, "startTime": "17.00" },
    "scope": "sekali",
    "effectiveDate": "2026-12-03T05:19:27.876Z",
    "reason": "Ada acara keluarga pada hari Rabu.",
    "status": "ditinjau_pengelola",
    "submittedAt": "2026-11-25T05:19:27.876Z",
    "studentName": "Aisyah Putri",
    "parentName": "Sari Wulandari"
  },
  "pair": { /* Pair terkait, bila ada */ },
  "fromSession": { "subject": "Matematika", "day": "Rabu", "start": "16.00", "end": "17.30" },
  "toSession": { "subject": "Matematika", "day": "Kamis", "start": "17.00", "end": "18.30" },
  "conflict": null
}
```

`conflict` berisi detail bentrok bila jadwal baru beririsan dengan sesi lain.
`pair` hanya ada bila pengajuan terkait pair aktif.

`POST`:

```json
{ "approved": true }
```

- `approved: true` menerapkan perubahan (memindahkan sesi atau mengubah jadwal
  rutin bila `scope = seterusnya`), lalu memberi notifikasi ke tutor.
- `approved: false` menolak pengajuan dan memberi notifikasi ke wali.
- Bila jadwal baru bentrok, approval ditolak `409 schedule_conflict`.

### 5.7 Presensi

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/pengelola/presensi?bulan=YYYY-MM` | Rekap presensi semua tutor |
| POST | `/pengelola/presensi/final` | Finalisasi presensi bulan |
| GET | `/pengelola/presensi/:id/keberatan` | Detail keberatan |
| POST | `/pengelola/presensi/:id/keberatan` | Tinjau keberatan |

`GET /pengelola/presensi`:

```json
{
  "months": ["2026-11-30T17:00:00.000Z", "2026-10-31T17:00:00.000Z"],
  "month": "2026-10-31T17:00:00.000Z",
  "total": 25,
  "final": 9,
  "ready": 10,
  "waiting": 3,
  "disputed": 1,
  "notCollected": 1,
  "objections": [ /* sesi tutor dengan record.validation = keberatan */ ],
  "readyByTutor": [
    { "tutor": "Kak Budi Santoso", "count": 6 },
    { "tutor": "Kak Nadia Safitri", "count": 2 }
  ]
}
```

`POST /pengelola/presensi/final`:

```json
{ "bulan": "2026-11" }
```

**200** — jumlah presensi yang difinalisasi:

```json
9
```

Hanya presensi `sudah_divalidasi` yang belum final yang diproses.

`POST /pengelola/presensi/:id/keberatan`:

```json
{
  "corrected": true,
  "actualStart": "16.00",
  "actualEnd": "16.45",
  "note": "Durasi dikoreksi sesuai keberatan wali."
}
```

`corrected` menentukan apakah presensi dikoreksi; `actualStart`/`actualEnd`
diisi bila dikoreksi.

### 5.8 Honor

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/pengelola/honor?bulan=YYYY-MM` | Rekap honor |
| POST | `/pengelola/honor/hitung` | Hitung honor bulan |
| GET | `/pengelola/honor/:bulan/:tutorId` | Detail honor tutor |
| POST | `/pengelola/honor/:bulan/:tutorId/bayar` | Catat pembayaran (multipart) |

`GET /pengelola/honor` memiliki dua bentuk tergantung `state`.

Bila **`state = "belum_dihitung"`** (bulan belum dihitung):

```json
{
  "state": "belum_dihitung",
  "months": ["2026-11-30T17:00:00.000Z", "2026-10-31T17:00:00.000Z"],
  "month": "2026-10-31T17:00:00.000Z",
  "final": 10,
  "total": 26,
  "tutorsWithoutRate": []
}
```

Bila **`state = "dihitung"`**:

```json
{
  "state": "dihitung",
  "months": ["2026-11-30T17:00:00.000Z", "2026-10-31T17:00:00.000Z"],
  "month": "2026-10-31T17:00:00.000Z",
  "calculatedAt": "2026-11-26T14:09:50.048Z",
  "total": 590000,
  "sessions": 10,
  "paid": { "amount": 0, "tutors": 0 },
  "unpaid": { "amount": 590000, "tutors": 3 },
  "unpaidHonors": [
    {
      "tutorId": "tt-budi",
      "name": "Kak Budi Santoso",
      "shortName": "Kak Budi",
      "lines": [
        { "rate": 60000, "amount": 180000, "subject": "Matematika", "sessions": 3 },
        { "rate": 60000, "amount": 300000, "subject": "IPA", "sessions": 5 }
      ],
      "sessions": 8,
      "total": 480000,
      "method": "tunai",
      "methodNote": "Diambil langsung tiap awal bulan"
    }
  ],
  "paidHonors": [ /* bentuk sama, ditambah data payment */ ],
  "skipped": []
}
```

`method`: `tunai` | `transfer` (mengikuti pengaturan tutor).
`POST /pengelola/honor/hitung` dengan body `{ "bulan": "2026-11" }` menghitung
honor dari sesi yang sudah difinalisasi. Tanpa `bulan`, memakai bulan berjalan.

**200**:

```json
{ "tutors": 3, "total": 590000 }
```

`GET /pengelola/honor/:bulan/:tutorId` mengembalikan detail honor satu tutor:

```json
{
  "tutorId": "tt-budi",
  "name": "Kak Budi Santoso",
  "shortName": "Kak Budi",
  "lines": [
    { "rate": 60000, "amount": 180000, "subject": "Matematika", "sessions": 3 }
  ],
  "sessions": 8,
  "total": 480000,
  "method": "tunai",
  "methodNote": "Diambil langsung tiap awal bulan",
  "month": "2026-11",
  "status": "belum_bayar",
  "sessionList": [ /* sesi tutor yang difinalisasi */ ]
}
```

`status`: `belum_bayar` | `sebagian` | `lunas`.

`POST /pengelola/honor/:bulan/:tutorId/bayar` — `multipart/form-data`:

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `method` | ya | mis. `transfer` |
| `paidAt` | ya | tanggal `YYYY-MM-DD` |
| `amount` | ya | nominal (integer rupiah) |
| `proof` | tidak | berkas bukti transfer |

**200**:

```json
{
  "status": "lunas",
  "month": "2026-11",
  "payment": {
    "amount": 420000,
    "method": "transfer",
    "paidAt": "2026-11-26T00:00:00.000Z",
    "proof": { "name": "bukti.pdf", "size": 10 },
    "recordedAt": "2026-11-26T08:06:53.859Z"
  }
}
```

`status` menjadi `sebagian` bila nominal < total honor.

### 5.9 Notifikasi (pengelola)

| Method | Path |
| --- | --- |
| GET | `/pengelola/notifikasi` |
| POST | `/pengelola/notifikasi/:id/dibaca` |
| POST | `/pengelola/notifikasi/dibaca-semua` |
| POST | `/pengelola/notifikasi/:id/read` (alias) |
| POST | `/pengelola/notifikasi/read-all` (alias) |

### 5.10 Data Master · Tutor & Siswa

| Method | Path | Catatan |
| --- | --- | --- |
| GET | `/pengelola/tutor` | query `query`, `subject`, `district`, `status` |
| POST | `/pengelola/tutor` | buat tutor + akun login |
| GET | `/pengelola/tutor/:id` | detail tutor |
| PUT | `/pengelola/tutor/:id` | ubah tutor |
| PATCH | `/pengelola/tutor/:id/status` | body `{ "status": "aktif" | "nonaktif" }` |
| GET | `/pengelola/siswa` | query `query`, `subject`, `district`, `status` |
| GET | `/pengelola/siswa/:id` | detail siswa |
| PATCH | `/pengelola/siswa/:id/status` | body `{ "status": "aktif" | "nonaktif" }` |

`GET /pengelola/tutor` → array `TutorRow`:

```json
[
  {
    "id": "tt-budi",
    "name": "Kak Budi Santoso",
    "subjects": ["Matematika", "IPA"],
    "levels": ["SMP", "SMA"],
    "district": "Bangkalan",
    "rate": 60000,
    "status": "aktif"
  }
]
```

`GET /pengelola/tutor/:id` → `Tutor` (menambah `phone`, `email`, `education`,
`days`, `from`, `until`, `address`, `pickup`, `joinedAt`, `activeStudents`,
`activeSchedules`).

`POST`/`PUT` body `TutorInput`:

```json
{
  "name": "Budi Santoso",
  "phone": "0812-1111-2222",
  "email": "budi.santoso@gmail.com",
  "education": "S1 Pendidikan Matematika",
  "subjects": ["Matematika", "IPA"],
  "levels": ["SMP"],
  "days": ["Senin", "Rabu"],
  "from": "15.00",
  "until": "21.00",
  "address": "Jl. Trunojoyo No. 10, Bangkalan",
  "rate": 60000
}
```

`GET /pengelola/siswa` → array `StudentRow`:

```json
[
  {
    "id": "s-aisyah",
    "name": "Aisyah Putri",
    "grade": "8 SMP",
    "subjects": ["Matematika", "IPA"],
    "status": "aktif",
    "tutorNames": ["Kak Budi Santoso"]
  }
]
```

`GET /pengelola/siswa/:id` → `Student`:

```json
{
  "id": "s-aisyah",
  "name": "Aisyah Putri",
  "grade": "8 SMP",
  "school": "SMP Negeri 1 Bangkalan",
  "address": "Jl. Trunojoyo No. 12, Bangkalan",
  "district": "Bangkalan",
  "subjects": ["Matematika", "IPA"],
  "needs": "Persiapan ulangan",
  "guardian": {
    "name": "Sari Wulandari",
    "phone": "0812-3456-7890",
    "accountActive": true,
    "linkedStudents": 2
  },
  "lessons": [
    {
      "subject": "Matematika",
      "day": "Rabu",
      "from": "16.00",
      "until": "17.30",
      "tutorName": "Kak Budi Santoso"
    }
  ],
  "status": "aktif"
}
```

Aturan: tutor/siswa **tidak pernah dihapus**, hanya dinonaktifkan. Penonaktifan
ditolak `409 active_schedule` bila masih ada jadwal les aktif:

```json
{
  "error": {
    "code": "active_schedule",
    "message": "Masih ada 5 jadwal les aktif.",
    "details": { "schedules": 5 }
  }
}
```

`POST /pengelola/tutor` membuat akun login tutor dengan password sementara
(default `pintara123`) yang **tidak pernah dikembalikan** API.

### 5.11 Manajemen Akun

| Method | Path | Catatan |
| --- | --- | --- |
| GET | `/pengelola/akun` | query `peran` (`wali`/`tutor`/`pengelola`), `q` |
| GET | `/pengelola/akun/siswa` | siswa aktif untuk pilihan tautan |
| POST | `/pengelola/akun` | buat akun |
| GET | `/pengelola/akun/:id` | detail akun |
| PUT | `/pengelola/akun/:id` | ubah akun |
| POST | `/pengelola/akun/:id/reset-password` | kirim password sementara |
| PATCH | `/pengelola/akun/:id/status` | body `{ "status": "aktif" | "nonaktif" }` |
| PUT | `/pengelola/akun/:id/siswa` | body `{ "siswaIds": ["s-aisyah"] }` |

`GET /pengelola/akun?peran=wali`:

```json
{
  "counts": { "wali": 9, "tutor": 6, "pengelola": 1 },
  "items": [
    {
      "id": "u-sari",
      "role": "wali",
      "name": "Sari Wulandari",
      "email": "sari.wulandari@gmail.com",
      "status": "aktif",
      "students": 2
    }
  ]
}
```

`GET /pengelola/akun/:id` → `AccountDetail`:

```json
{
  "id": "u-sari",
  "role": "wali",
  "name": "Sari Wulandari",
  "email": "sari.wulandari@gmail.com",
  "username": "sari.wulandari",
  "phone": "0812-3456-7890",
  "createdAt": "2026-01-02T00:00:00.000Z",
  "lastLoginAt": "2026-11-26T08:00:00.000Z",
  "status": "aktif",
  "studentIds": ["s-aisyah", "s-fikri"],
  "students": [
    { "id": "s-aisyah", "name": "Aisyah Putri", "grade": "8 SMP", "status": "aktif" }
  ]
}
```

`POST`/`PUT` body `AccountInput`:

```json
{
  "role": "wali",
  "name": "Sari Wulandari",
  "email": "sari.wulandari@gmail.com",
  "username": "sari.wulandari",
  "phone": "0812-3456-7890",
  "studentIds": ["s-aisyah"]
}
```

`GET /pengelola/akun/siswa` → `LinkedStudent[]`:

```json
[{ "id": "s-aisyah", "name": "Aisyah Putri", "grade": "8 SMP", "status": "aktif" }]
```

`POST /pengelola/akun/:id/reset-password` → `{ "email": "sari.wulandari@gmail.com" }`.
Password sementara hanya dikirim ke email dan **tidak pernah** dikembalikan.
Email/username duplikat → `409 duplicate_field` dengan `details.field`.

### 5.12 Rekap & Riwayat Les

| Method | Path | Catatan |
| --- | --- | --- |
| GET | `/pengelola/riwayat-les` | query `bulan`, `tutorId`, `siswaId` |

`GET /pengelola/riwayat-les?bulan=2026-11` → `LessonRecap`:

```json
{
  "months": ["2026-10-31T17:00:00.000Z", "2026-09-30T17:00:00.000Z"],
  "month": "2026-10-31T17:00:00.000Z",
  "tutorOptions": [{ "id": "tt-budi", "name": "Kak Budi Santoso" }],
  "studentOptions": [{ "id": "s-aisyah", "name": "Aisyah Putri" }],
  "held": 14,
  "missed": 1,
  "pairs": 5,
  "byTutor": [
    { "id": "tt-budi", "name": "Kak Budi Santoso", "sessions": 8, "missed": 0, "students": 3 }
  ],
  "byStudent": [
    { "id": "s-aisyah", "name": "Aisyah Putri", "sessions": 4, "missed": 0, "tutors": ["Kak Budi Santoso"] }
  ],
  "sessions": [
    {
      "id": "cmwx...",
      "date": "2026-11-25T09:00:00.000Z",
      "subject": "Matematika",
      "topic": "Persamaan linear satu variabel",
      "tutorId": "tt-budi",
      "tutorName": "Kak Budi Santoso",
      "studentId": "s-aisyah",
      "studentName": "Aisyah Putri",
      "status": "sudah_divalidasi"
    }
  ]
}
```

`status` sesi: `belum_dikumpulkan`, `belum_divalidasi`, `sudah_divalidasi`,
`keberatan`, atau `tidak_terlaksana`.

### 5.13 Laporan Keuangan

| Method | Path | Catatan |
| --- | --- | --- |
| GET | `/pengelola/laporan-keuangan` | query `bulan` |
| GET | `/pengelola/tagihan` | query `bulan` |
| GET | `/pengelola/tagihan/:id` | rincian tagihan |
| POST | `/pengelola/tagihan/:id/pembayaran` | catat pembayaran manual |
| POST | `/pengelola/laporan-keuangan/unduh` | buat PDF/XLSX |

`GET /pengelola/laporan-keuangan` → `FinanceSummary`:

```json
{
  "state": "ada",
  "months": ["2026-11-30T17:00:00.000Z", "2026-10-31T17:00:00.000Z", "2026-09-30T17:00:00.000Z"],
  "month": "2026-10-31T17:00:00.000Z",
  "bills": { "total": 900000, "count": 2, "lunas": 0, "sebagian": 1, "belum": 1 },
  "payments": { "received": 450000, "transactions": 1, "failed": 0 },
  "honor": { "total": 2400000, "sessions": 40, "tutors": 4, "calculated": false },
  "honorPaid": { "amount": 0, "tutors": 0 },
  "institutionShare": -1500000
}
```

Bila belum ada tagihan pada periode: `{ "state": "kosong", "months": [...], "month": "..." }`.
Honor memakai rekap P7 bila sudah dihitung; bila belum, `calculated: false` dan
nilai diestimasi dari presensi final bulan itu.

`GET /pengelola/tagihan` → `StudentBillList`:

```json
{
  "months": ["...", "...", "..."],
  "month": "2026-10-31T17:00:00.000Z",
  "total": 900000,
  "paid": 450000,
  "remaining": 450000,
  "unpaid": [
    { "id": "bill-fikri-current", "studentName": "Fikri Ramadhan", "sessions": 4, "dueDate": "2026-11-15T17:00:00.000Z", "total": 300000, "remaining": 300000, "status": "belum_bayar" }
  ],
  "partial": [
    { "id": "bill-aisyah-current", "studentName": "Aisyah Putri", "sessions": 8, "dueDate": "2026-11-15T17:00:00.000Z", "total": 600000, "remaining": 150000, "status": "sebagian" }
  ],
  "paidOff": []
}
```

`GET /pengelola/tagihan/:id` → `StudentBill`:

```json
{
  "id": "bill-aisyah-current",
  "number": "INV-2026-0112",
  "studentName": "Aisyah Putri",
  "guardianName": "Sari Wulandari",
  "period": "2026-10-31T17:00:00.000Z",
  "dueDate": "2026-11-15T17:00:00.000Z",
  "items": [{ "subject": "Matematika", "sessions": 4, "unitPrice": 75000 }],
  "payments": [
    {
      "id": "TRX-SEED-0001",
      "amount": 450000,
      "method": "QRIS",
      "status": "berhasil",
      "createdAt": "2026-11-21T00:00:00.000Z"
    }
  ]
}
```

`POST /pengelola/tagihan/:id/pembayaran` body `ManualPaymentInput`:

```json
{
  "amount": 150000,
  "paidAt": "2026-11-26T00:00:00.000Z",
  "method": "Tunai di LBB",
  "proof": { "name": "bukti.jpg", "size": 120000 }
}
```

Nominal harus `> 0` dan `<= sisa tagihan`, jika tidak → `422 VALIDATION_ERROR`
dengan `details.remaining`. Respons berupa `StudentBill` terbaru. Wali pemilik
tagihan menerima notifikasi `pembayaran`.

`POST /pengelola/laporan-keuangan/unduh` body `ReportInput`:

```json
{ "month": "2026-11-01", "type": "lengkap", "format": "pdf" }
```

`type`: `ringkasan` | `tagihan` | `honor` | `lengkap`; `format`: `pdf` | `xlsx`.
Respons `ReportFile`:

```json
{
  "name": "Laporan_Keuangan_Nov2026.pdf",
  "size": 2082,
  "url": "/uploads/92433ff1-...pdf"
}
```

Berkas benar-benar dibuat (PDF via `pdfkit`, XLSX via `exceljs`) dan disimpan
lewat `StorageService` (lokal atau S3).

### 5.14 Pengaturan Notifikasi

| Method | Path |
| --- | --- |
| GET | `/pengelola/pengaturan-notifikasi` |
| GET | `/pengelola/pengaturan-notifikasi/:id` |
| PUT | `/pengelola/pengaturan-notifikasi/:id` |

`GET` → array `NotificationSetting`:

```json
[
  {
    "id": "pengingat-jadwal",
    "group": "pengingat",
    "title": "Pengingat jadwal les",
    "screenTitle": "Pengingat jadwal",
    "recipient": "Wali murid",
    "trigger": "H-1 jadwal les",
    "activeNote": "Dikirim otomatis",
    "enabled": true,
    "channel": "whatsapp",
    "timing": { "kind": "sebelum_sesi", "hoursBefore": 24 },
    "template": "Halo {nama_wali}, ...",
    "variables": ["nama_wali", "nama_siswa"],
    "sample": { "nama_wali": "Sari", "nama_siswa": "Aisyah" },
    "previewNote": "Pratinjau"
  }
]
```

`PUT /pengelola/pengaturan-notifikasi/:id` body `SettingInput`:

```json
{
  "enabled": true,
  "channel": "email",
  "timing": { "kind": "sebelum_sesi", "hoursBefore": 3 },
  "template": "Halo {nama_wali}, sesi {nama_siswa} ..."
}
```

Template memakai `{variabel}`. Variabel yang tidak ada di `variables` ditolak
`422 VALIDATION_ERROR` dengan `details.variables`.

`channel`: `whatsapp` | `email` | `aplikasi`.
`timing`: `{ "kind": "sebelum_sesi", "hoursBefore": 24 }` |
`{ "kind": "setelah_sesi", "daysAfter": 1, "time": "08.00", "maxRepeat": 3 }` |
`{ "kind": "kejadian" }`.

### 5.15 Riwayat Notifikasi

| Method | Path | Catatan |
| --- | --- | --- |
| GET | `/pengelola/riwayat-notifikasi` | query `status`, `jenis`, `periode` |
| GET | `/pengelola/riwayat-notifikasi/:id` | detail log |
| POST | `/pengelola/riwayat-notifikasi/:id/kirim-ulang` | kirim ulang satu |
| POST | `/pengelola/riwayat-notifikasi/kirim-ulang` | kirim ulang semua gagal |

`GET` → `LogList`:

```json
{
  "failed": [
    {
      "id": "log-1",
      "kind": "pengingat-jadwal",
      "channel": "whatsapp",
      "recipients": [
        { "name": "Sari Wulandari", "role": "wali", "contact": "6281234567890", "accountId": "u-sari" }
      ],
      "sentAt": "2026-11-26T01:00:00.000Z",
      "status": "gagal",
      "message": "Halo Sari, ...",
      "attempts": 2,
      "lastAttemptAt": "2026-11-26T01:05:00.000Z",
      "reason": "Nomor WhatsApp tidak valid",
      "reasonShort": "Kontak tidak valid",
      "permanent": true
    }
  ],
  "sent": []
}
```

`status`: `terkirim` | `gagal`. `periode`: `hari-ini` | `7-hari` | `bulan-ini` | `bulan-lalu`.
`kind`: `pengingat-jadwal`, `pengingat-presensi`, `pendaftaran-baru`,
`hasil-verifikasi`, `penawaran-tutor`, `keberatan-presensi`, `rekap-honor`.

`POST /pengelola/riwayat-notifikasi/:id/kirim-ulang`:
- Log biasa → status menjadi `terkirim`, `resentAt` diisi, `attempts` bertambah.
- Log `permanent` (kontak tidak valid) → tetap gagal; `409 resend_failed`.

`POST /pengelola/riwayat-notifikasi/kirim-ulang` body
`{ "jenis"?: "...", "periode"?: "bulan-ini" }` → `{ "sent": ["Sari Wulandari"], "stillFailed": 1 }`.

---

## 6. Notifikasi (semua peran)

Tersedia untuk `wali`, `tutor`, dan `pengelola` dengan prefix peran masing-masing.

### GET `/{peran}/notifikasi`

```json
{
  "unread": [
    {
      "id": "ntf-1",
      "kind": "tagihan",
      "title": "Tagihan baru",
      "body": "Tagihan November Rp300.000",
      "createdAt": "2026-11-26T05:20:56.000Z",
      "read": false,
      "to": "/wali/tagihan"
    }
  ],
  "read": [ /* notifikasi yang sudah dibaca */ ]
}
```

`kind`: `validasi` | `tagihan` | `jadwal` | `pembayaran` | `les`
(tutor juga memakai `presensi`, `keberatan`, `pengingat`, `rekap`, `honor`
pada tipe frontend; backend menyimpannya sebagai string bebas).
`to` adalah rute frontend tujuan saat notifikasi diketuk.

### POST `/{peran}/notifikasi/:id/dibaca`

```json
{ "ok": true }
```

### POST `/{peran}/notifikasi/dibaca-semua`

```json
{ "ok": true }
```

Alias `/:id/read` dan `/read-all` berperilaku sama.

---

## 7. Enum & Status

| Domain | Nilai |
| --- | --- |
| Peran | `wali`, `tutor`, `pengelola` |
| Status pendaftaran | `menunggu_verifikasi`, `terverifikasi`, `ditolak` |
| Stage pendaftaran (wali) | `menunggu_verifikasi`, `pencocokan_tutor`, `selesai`, `ditolak` |
| Status penawaran | `menunggu_konfirmasi`, `diterima`, `ditolak` |
| Validasi presensi | `belum_divalidasi`, `sudah_divalidasi`, `keberatan` |
| Status perubahan jadwal | `ditinjau_pengelola`, `konfirmasi_tutor`, `disetujui`, `ditolak` |
| Status pembayaran | `berhasil`, `kedaluwarsa`, `gagal` |
| Status tagihan (turunan) | `belum_bayar`, `sebagian`, `lunas` |
| Status honor | `belum_dihitung`, `dihitung` |
| Status akun (tutor/siswa/akun) | `aktif`, `nonaktif` |
| Status sesi rekap les | `belum_dikumpulkan`, `belum_divalidasi`, `sudah_divalidasi`, `keberatan`, `tidak_terlaksana` |
| Kanal notifikasi | `whatsapp`, `email`, `aplikasi` |
| Status log notifikasi | `terkirim`, `gagal` |
| Jenis log notifikasi | `pengingat-jadwal`, `pengingat-presensi`, `pendaftaran-baru`, `hasil-verifikasi`, `penawaran-tutor`, `keberatan-presensi`, `rekap-honor` |
| Jenis laporan | `ringkasan`, `tagihan`, `honor`, `lengkap` |
| Format laporan | `pdf`, `xlsx` |

---

## 8. Aturan Penting

- **Tidak ada registrasi publik.** Akun dibuat lewat seed/operasional.
- **Jadwal → sesi les.** `PairSession` dimaterialisasi menjadi `LessonSession`
  untuk minggu-minggu ke depan. Sesi lampau tidak dibuat ulang; sesi yang sudah
  memiliki presensi tidak dihapus saat jadwal diubah.
- **Bentrok jadwal.** Disimpan/ditolak bila tutor sudah mengajar pada hari dan
  jam yang beririsan (termasuk buffer 15 menit).
- **Presensi.** Hanya tutor pemilik sesi yang boleh mengisi. Wali dapat
  menyetujui, mengajukan keberatan, atau memberi ulasan. Pengelola memfinalisasi
  presensi tervalidasi dan meninjau keberatan.
- **Pembayaran.** Disimulasikan; nominal tidak boleh melebihi sisa tagihan.
- **Honor.** Dihitung dari sesi terfinalisasi pada bulan berjalan memakai tarif
  tutor per mapel.
- **Data master.** Tutor dan siswa tidak pernah dihapus, hanya dinonaktifkan.
  Penonaktifan ditolak `409 active_schedule` selama masih ada jadwal les aktif.
  Membuat tutor juga membuat akun login dengan password sementara.
- **Akun.** Password tidak pernah dikembalikan API. Buat akun dan reset password
  memakai password sementara (default `pintara123`) yang dikirim ke email.
  Email/username duplikat → `409 duplicate_field`.
- **Laporan.** `POST /pengelola/laporan-keuangan/unduh` membuat berkas PDF/XLSX
  sungguhan dan menyimpannya lewat storage (lokal/S3), lalu mengembalikan URL.
- **Pengaturan notifikasi.** Template memakai variabel `{nama}`; variabel tak
  dikenal → `422 VALIDATION_ERROR` dengan `details.variables`.
- **Riwayat notifikasi.** Log dicatat dari kejadian nyata (pendaftaran,
  verifikasi, penawaran, keberatan, finalisasi presensi, rekap honor). Log gagal
  dapat dikirim ulang; log dengan kontak tidak valid tetap gagal (`permanent`).
- **Rate limit.** Global `THROTTLE_LIMIT` per `THROTTLE_TTL` detik per IP; login
  memakai `AUTH_THROTTLE_LIMIT`.
- **Cache.** Dashboard/daftar tertentu memakai Redis dengan TTL
  `CACHE_TTL_SECONDS`; tanpa Redis memakai memori.

Akun demo dan cara menjalankan ada di [`README.md`](../README.md).
Pemetaan tipe frontend ada di [`CONTRACT.md`](./CONTRACT.md).