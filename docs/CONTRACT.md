# Kontrak Frontend ↔ Backend

Dokumen ini memetakan **tipe dan endpoint frontend PINTARA** ke implementasi
backend. Frontend adalah sumber kebenaran kontrak: nama field, nilai status,
dan bentuk respons harus cocok dengan tipe di aplikasi frontend.

## Sumber Kontrak

Kontrak diambil dari **gabungan** seluruh branch frontend yang relevan:

- `origin/develop`
- `origin/ui/wali-murid`
- `origin/ui/tutor`
- `origin/ui/pengelola-lbb`

Modul API frontend saat ini masih berupa *mock* dengan komentar `TODO(backend)`.
Komentar itulah yang mendefinisikan path yang diharapkan. Backend menerapkan
**union** dari semua path tersebut dan mengembalikan objek/array apa adanya.

## Aturan Umum

| Aspek | Kontrak |
| --- | --- |
| Base URL | `http://localhost:4000` — tanpa prefix `/api/v1` |
| Auth | `Authorization: Bearer <token>` |
| Sukses | objek/array langsung (tanpa pembungkus `data`) |
| Error | `{ "error": { "code", "message", "details"? } }` |
| Tanggal | ISO-8601 UTC (ditampilkan Asia/Jakarta oleh frontend) |
| Uang | integer rupiah |
| Peran | `wali`, `tutor`, `pengelola` |

## Paritas Endpoint

Seluruh endpoint yang dirujuk komentar frontend tersedia. Kolom **Alias** adalah
path tambahan agar sesuai persis dengan komentar frontend.

| Peran | Path frontend | Backend | Catatan |
| --- | --- | --- | --- |
| auth | `POST /auth/login` | ✅ | body `{ identifier, password }` |
| auth | `POST /auth/logout` | ✅ | `{ ok: true }` |
| auth | `GET /auth/me` | ✅ | tambahan backend |
| health | `GET /health` | ✅ | tambahan backend |
| wali | `GET /wali/dashboard` | ✅ | |
| wali | `GET /wali/profil` | ✅ | |
| wali | `GET /wali/akun` | ✅ | |
| wali | `POST /wali/pendaftaran` | ✅ | |
| wali | `GET /wali/pendaftaran/terbaru` | ✅ | |
| wali | `GET /wali/pendaftaran/:id` | ✅ | |
| wali | `GET /wali/pendaftaran/defaults` | ✅ | tambahan backend |
| wali | `GET /wali/jadwal` | ✅ | |
| wali | `GET /wali/jadwal/${id}` | ✅ **alias** | kanonik: `/wali/jadwal/rutin/:id` |
| wali | `POST /wali/pengajuan-jadwal` | ✅ | |
| wali | `GET /wali/pengajuan-jadwal/${id}` | ✅ | |
| wali | `GET /wali/presensi` | ✅ | |
| wali | `GET /wali/presensi/${id}` | ✅ | |
| wali | `POST /wali/presensi/${id}/setujui` | ✅ | |
| wali | `POST /wali/presensi/${id}/keberatan` | ✅ | |
| wali | `POST /wali/presensi/${id}/ulasan` | ✅ | |
| wali | `GET /wali/riwayat-les` | ✅ | |
| wali | `GET /wali/tagihan` | ✅ | |
| wali | `GET /wali/tagihan/${id}` | ✅ | |
| wali | `POST /wali/tagihan/${id}/bayar` | ✅ **alias** | kanonik: `/wali/tagihan/:id/pembayaran` |
| wali | `GET /wali/pembayaran` | ✅ | |
| wali | `GET /wali/pembayaran/${trxId}` | ✅ | terima `id` atau `externalId` |
| wali | `GET /wali/notifikasi` | ✅ | |
| wali | `POST /wali/notifikasi/${id}/dibaca` | ✅ | |
| wali | `POST /wali/notifikasi/dibaca-semua` | ✅ | |
| tutor | `GET /tutor/dashboard` | ✅ | |
| tutor | `GET /tutor/akun` | ✅ | |
| tutor | `GET /tutor/presensi` | ✅ | |
| tutor | `GET /tutor/presensi/status` | ✅ | |
| tutor | `GET /tutor/presensi/${id}` | ✅ | |
| tutor | `POST /tutor/presensi/${id}` | ✅ | |
| tutor | `POST /tutor/dokumentasi` | ✅ | multipart `file` |
| tutor | `GET /tutor/riwayat` | ✅ | |
| tutor | `GET /tutor/jadwal` | ✅ | query `?minggu=` |
| tutor | `GET /tutor/jadwal/${id}` | ✅ | |
| tutor | `POST /tutor/pengajuan-jadwal` | ✅ | tambahan backend |
| tutor | `GET /tutor/notifikasi` | ✅ | |
| tutor | `POST /tutor/notifikasi/${id}/dibaca` | ✅ | |
| tutor | `POST /tutor/notifikasi/dibaca-semua` | ✅ | |
| pengelola | `GET /pengelola/dashboard` | ✅ | |
| pengelola | `GET /pengelola/lainnya` | ✅ | |
| pengelola | `GET /pengelola/pendaftaran` | ✅ | query `status`, `q`, `level` |
| pengelola | `GET /pengelola/pendaftaran/${id}` | ✅ | |
| pengelola | `POST /pengelola/pendaftaran/${id}/verifikasi` | ✅ | |
| pengelola | `POST /pengelola/pendaftaran/${id}/tolak` | ✅ | |
| pengelola | `GET /pengelola/pencocokan` | ✅ | |
| pengelola | `GET /pengelola/pencocokan/${id}` | ✅ | |
| pengelola | `POST /pengelola/pencocokan/${id}` | ✅ | |
| pengelola | `GET /pengelola/penawaran` | ✅ | |
| pengelola | `GET /pengelola/penawaran/draf/${regId}` | ✅ | |
| pengelola | `POST /pengelola/penawaran` | ✅ | |
| pengelola | `GET /pengelola/penawaran/${id}` | ✅ | |
| pengelola | `POST /pengelola/penawaran/${id}/diterima` | ✅ | |
| pengelola | `POST /pengelola/penawaran/${id}/ditolak` | ✅ | |
| pengelola | `GET /pengelola/jadwal` | ✅ | |
| pengelola | `GET /pengelola/jadwal/draf/${offerId}` | ✅ | |
| pengelola | `GET /pengelola/jadwal/${pairId}` | ✅ | |
| pengelola | `PUT /pengelola/jadwal` | ✅ | deteksi bentrok |
| pengelola | `GET /pengelola/pengajuan-jadwal/${id}` | ✅ | |
| pengelola | `POST /pengelola/pengajuan-jadwal/${id}` | ✅ | |
| pengelola | `GET /pengelola/presensi` | ✅ | |
| pengelola | `POST /pengelola/presensi/final` | ✅ | |
| pengelola | `GET /pengelola/presensi/${id}/keberatan` | ✅ | |
| pengelola | `POST /pengelola/presensi/${id}/keberatan` | ✅ | |
| pengelola | `GET /pengelola/honor` | ✅ | |
| pengelola | `POST /pengelola/honor/hitung` | ✅ | |
| pengelola | `GET /pengelola/honor/${bulan}/${tutorId}` | ✅ | |
| pengelola | `POST /pengelola/honor/${bulan}/${id}/bayar` | ✅ | multipart, field `proof` |
| pengelola | `GET /pengelola/notifikasi` | ✅ | tambahan backend |
| pengelola | `GET /pengelola/tutor` | ✅ | query `query`, `subject`, `district`, `status` |
| pengelola | `POST /pengelola/tutor` | ✅ | body `TutorInput` |
| pengelola | `GET /pengelola/tutor/:id` | ✅ | |
| pengelola | `PUT /pengelola/tutor/:id` | ✅ | |
| pengelola | `PATCH /pengelola/tutor/:id/status` | ✅ | `409` bila jadwal aktif |
| pengelola | `GET /pengelola/siswa` | ✅ | query `query`, `subject`, `district`, `status` |
| pengelola | `GET /pengelola/siswa/:id` | ✅ | |
| pengelola | `PATCH /pengelola/siswa/:id/status` | ✅ | `409` bila jadwal aktif |
| pengelola | `GET /pengelola/akun` | ✅ | query `peran`, `q` |
| pengelola | `GET /pengelola/akun/siswa` | ✅ | siswa aktif untuk tautan |
| pengelola | `POST /pengelola/akun` | ✅ | body `AccountInput` |
| pengelola | `GET /pengelola/akun/:id` | ✅ | |
| pengelola | `PUT /pengelola/akun/:id` | ✅ | |
| pengelola | `POST /pengelola/akun/:id/reset-password` | ✅ | `{ email }`, password tidak dikembalikan |
| pengelola | `PATCH /pengelola/akun/:id/status` | ✅ | |
| pengelola | `PUT /pengelola/akun/:id/siswa` | ✅ | body `{ siswaIds }` |
| pengelola | `GET /pengelola/riwayat-les` | ✅ | query `bulan`, `tutorId`, `siswaId` |
| pengelola | `GET /pengelola/laporan-keuangan` | ✅ | query `bulan` |
| pengelola | `GET /pengelola/tagihan` | ✅ | query `bulan` |
| pengelola | `GET /pengelola/tagihan/:id` | ✅ | |
| pengelola | `POST /pengelola/tagihan/:id/pembayaran` | ✅ | body `ManualPaymentInput` |
| pengelola | `POST /pengelola/laporan-keuangan/unduh` | ✅ | PDF/XLSX nyata |
| pengelola | `GET /pengelola/pengaturan-notifikasi` | ✅ | |
| pengelola | `GET /pengelola/pengaturan-notifikasi/:id` | ✅ | |
| pengelola | `PUT /pengelola/pengaturan-notifikasi/:id` | ✅ | `422` bila variabel tak dikenal |
| pengelola | `GET /pengelola/riwayat-notifikasi` | ✅ | query `status`, `jenis`, `periode` |
| pengelola | `GET /pengelola/riwayat-notifikasi/:id` | ✅ | |
| pengelola | `POST /pengelola/riwayat-notifikasi/:id/kirim-ulang` | ✅ | |
| pengelola | `POST /pengelola/riwayat-notifikasi/kirim-ulang` | ✅ | kirim ulang semua gagal |

Alias notifikasi: `POST .../notifikasi/:id/read` dan
`POST .../notifikasi/read-all` juga tersedia untuk ketiga peran.

## Pemetaan Tipe

### Wali Murid

| Tipe frontend | Endpoint | Bentuk backend |
| --- | --- | --- |
| `WaliDashboard` | `GET /wali/dashboard` | `{ parent, students, activeStudentId, nextSession, tasks, weekSchedule, history, unreadNotifications }` |
| `WaliStudent` | di dalam `students` | `{ id, name, initials, grade }` |
| `DashboardTask` | di dalam `tasks` | `{ id, icon, title, description, count, to }` |
| `Routine` | `GET /wali/jadwal` → `routines[]` | `{ id, studentId, subject, weekday, startTime, durationMinutes, tutor, location, since, studentName, nextSession, pendingRequest }` |
| `RoutineDetail` | `GET /wali/jadwal/:id` | bentuk `Routine` |
| `WaliSchedule` | `GET /wali/jadwal` | `{ students, activeStudentId, pendingRequests, week, routines, unreadNotifications }` |
| `ChangeRequest` | `POST/GET /wali/pengajuan-jadwal…` | `{ id, routineId, studentId, subject, tutor, durationMinutes, from, to, scope, effectiveDate, reason, status, submittedAt }` |
| `AttendanceSession` | `GET /wali/presensi`, `/wali/presensi/:id` | `{ id, studentId, studentName, subject, start, end, tutor, tutorAttendance, studentAttendance, topic, notes, attachments, status, … }` |
| `AttendanceOverview` | `GET /wali/presensi` | `{ pending, history, multipleStudents, unreadNotifications }` |
| `LessonHistory` | `GET /wali/riwayat-les` | `{ students, studentId, months, month, sessions, summary }` |
| `BillsOverview` | `GET /wali/tagihan` | `{ priority, others, unreadNotifications }` |
| `Bill` / `BillItem` | `GET /wali/tagihan`, `/wali/tagihan/:id` | `{ id, number, studentName, period, dueDate, items:[{subject,sessions,unitPrice}], total, paid }` |
| `PaymentResult` | `POST /wali/tagihan/:id/bayar` | `{ payment, bill }` |
| `Payment` | `GET /wali/pembayaran`, `/wali/pembayaran/:trxId` | `{ id, billId, billPeriod, amount, method, status, createdAt }` |
| `WaliAccount` | `GET /wali/akun` | `{ name, initials, role, email, whatsapp, username, students, lbbContact, appVersion }` |
| `RegistrationStatus` | `GET /wali/pendaftaran/…` | `{ registration, contact }` |
| `NotificationList` | `GET /wali/notifikasi` | `{ unread, read }` |
| `AppNotification` | di dalam notifikasi | `{ id, kind, title, body, createdAt, read, to }` |

`RegistrationStage`: `menunggu_verifikasi` | `pencocokan_tutor` | `selesai` | `ditolak`.
`BillStatus` diturunkan dari `paid`/`total`: `belum_bayar` | `sebagian` | `lunas`.
`PaymentStatus`: `berhasil` | `kedaluwarsa` | `gagal`.

### Tutor

| Tipe frontend | Endpoint | Bentuk backend |
| --- | --- | --- |
| `TutorDashboard` | `GET /tutor/dashboard` | `{ tutor, nextSession, tasks, upcoming, recap }` |
| `TutorAccount` | `GET /tutor/akun` | `{ name, initials, role, email, teaching, lbbContact, appVersion }` |
| `TutorSession` | `/tutor/presensi*`, `/tutor/jadwal/:id` | `{ id, subject, student:{name,parentName,parentSalutation}, start, end, record }` |
| `TutorSessionList` | `GET /tutor/presensi` | `{ toFill, laterToday, filled }` |
| `AttendanceStatusOverview` | `GET /tutor/presensi/status` | `{ months, month, total, disputed, waiting, notCollected, verified }` |
| `AttendanceRecord` | di dalam `record` | `{ held, actualStart, actualEnd, studentPresent, topic, notes, attachment, submittedAt, validation, … }` |
| `AttendanceInput` | `POST /tutor/presensi/:id` | body `AttendanceDto` |
| `TutorHistory` | `GET /tutor/riwayat` | `{ months, month, students, student, sessions, summary }` |
| `TutorSchedule` | `GET /tutor/jadwal` | `{ week, weeks, days, freeDays }` |
| `TutorScheduleDay` | di dalam `days` | `{ date, sessions }` |
| `TutorScheduleSession` | di dalam `sessions` | `{ id, routineId, subject, start, end, studentName, address, status }` |
| `TutorScheduleDetail` | `GET /tutor/jadwal/:id` | `{ id, subject, student, start, end, record, parent, previous }` |
| `TutorNotification` / `TutorNotificationKind` | `GET /tutor/notifikasi` | bentuk `AppNotification`, `kind` string |

`ValidationStatus`: `belum_divalidasi` | `sudah_divalidasi` | `keberatan`.
`Student.parentSalutation` bernilai `Ibu`/`Bapak` (bukan `Bapak/Ibu`) untuk data valid.

### Pengelola

| Tipe frontend | Endpoint | Bentuk backend |
| --- | --- | --- |
| `PengelolaDashboard` | `GET /pengelola/dashboard` | `{ admin, today, tasks, billing, unreadNotifications }` |
| `PengelolaMenu` | `GET /pengelola/lainnya` | `{ name, initials, role, email, tutors, students, failedNotifications }` |
| `RegistrationList` | `GET /pengelola/pendaftaran` | `{ counts, items }` |
| `PengelolaRegistration` | daftar/detail/pencocokan | `{ id, number, student, parent, needs, submittedAt, status, verifiedAt?, match?, rejection?, declinedTutorIds? }` |
| `MatchingCandidates` | `GET /pengelola/pencocokan/:id` | `{ registration, candidates, fullMatches }` |
| `Candidate` | di dalam `candidates` | `{ tutorId, name, shortName, initials, education, rating, activeStudents, criteria, score, fullMatch }` |
| `Criterion` | di dalam `criteria` | `{ label, met }` |
| `OfferList` | `GET /pengelola/penawaran` | `{ unsent, waiting, history }` |
| `Offer` / `OfferSummary` | `/pengelola/penawaran…` | `{ id, registrationId, student, tutor, subjects, schedule, location, distanceKm, rate, message?, sentAt, status, answeredAt?, decline? }` |
| `OfferDraft` | `GET /pengelola/penawaran/draf/:regId` | `{ registration, tutorName, … }` |
| `ScheduleBoard` | `GET /pengelola/jadwal` | `{ toSchedule, requests, active }` |
| `Pair` | di dalam `active` | `{ id, student, parentName, tutor, subjects, sessions, effectiveFrom, offerId? }` |
| `ScheduleDraft` | `GET /pengelola/jadwal/draf/:offerId`, `/:pairId` | `{ pairId?/offerId?, student, parentName, tutor, subjects, sessions, effectiveFrom, requested? }` |
| `ScheduleSession` | di dalam `sessions` | `{ subject, day, start, end }` |
| `SaveScheduleInput` | `PUT /pengelola/jadwal` | `{ draft, sessions, effectiveFrom }` |
| `ChangeReview` | `GET /pengelola/pengajuan-jadwal/:id` | `{ request, pair?, fromSession, toSession, conflict }` |
| `ChangeRequestForReview` | `request` di dalam `ChangeReview` | `{ …ChangeRequest, studentName, parentName }` |
| Keputusan review | `POST /pengelola/pengajuan-jadwal/:id` | body `{ approved }` |
| `FinalOverview` | `GET /pengelola/presensi` | `{ months, month, total, final, ready, waiting, disputed, notCollected, objections, readyByTutor }` |
| `ObjectionResolution` | `POST /pengelola/presensi/:id/keberatan` | `{ corrected, actualStart?, actualEnd?, note? }` |
| `HonorRecap` | `GET /pengelola/honor` | `{ state, months, month, calculatedAt, total, sessions, paid, unpaid, unpaidHonors, paidHonors, skipped }` |
| `TutorHonor` | di dalam `unpaidHonors` | `{ tutorId, name, shortName, lines, sessions, total, method }` |
| `HonorLine` | di dalam `lines` | `{ rate, amount, subject, sessions }` |
| `HonorDetail` | `GET /pengelola/honor/:bulan/:tutorId` | detail honor + sesi |
| `HonorPaymentInput` | `POST /pengelola/honor/:bulan/:tutorId/bayar` | multipart `{ method, paidAt, amount, proof? }` |
| `HonorPayment` | hasil pembayaran | `{ amount, method, paidAt, proof?, recordedAt }` |

`OfferStatus`: `menunggu_konfirmasi` | `diterima` | `ditolak`.
`ChangeRequestStatus`: `ditinjau_pengelola` | `konfirmasi_tutor` | `disetujui` | `ditolak`.
`RegistrationStatus`: `menunggu_verifikasi` | `terverifikasi` | `ditolak`.

### Pengelola · Data Master, Akun, Rekap, Laporan & Notifikasi

| Tipe frontend | Endpoint | Bentuk backend |
| --- | --- | --- |
| `TutorRow` | `GET /pengelola/tutor` | `{ id, name, subjects, levels, district, rate, status }` |
| `Tutor` | `GET /pengelola/tutor/:id` | `TutorRow` + `phone, email, education, days, from, until, address, pickup, joinedAt, activeStudents, activeSchedules` |
| `TutorInput` | `POST/PUT /pengelola/tutor` | `{ name, phone?, email?, education?, subjects, levels, days, from, until, address?, rate }` |
| `StudentRow` | `GET /pengelola/siswa` | `{ id, name, grade, subjects, status, endedAt?, tutorNames }` |
| `Student` | `GET /pengelola/siswa/:id` | `{ id, name, grade, school, address, district, subjects, needs, guardian, lessons, status, endedAt? }` |
| `AccountList` | `GET /pengelola/akun` | `{ counts: { wali, tutor, pengelola }, items: AccountRow[] }` |
| `AccountRow` | di dalam `items` | `{ id, role, name, email, status, students }` |
| `AccountDetail` | `GET /pengelola/akun/:id` | `Account` + `students: LinkedStudent[]` |
| `Account` | detail | `{ id, role, name, email, username, phone, createdAt, lastLoginAt, status, studentIds }` |
| `LinkedStudent` | `GET /pengelola/akun/siswa`, detail akun | `{ id, name, grade, status }` |
| `AccountInput` | `POST/PUT /pengelola/akun` | `{ role, name, email, username, phone, studentIds }` |
| `LessonRecap` | `GET /pengelola/riwayat-les` | `{ months, month, tutorOptions, studentOptions, held, missed, pairs, byTutor, byStudent, sessions }` |
| `RecapSession` | di dalam `sessions` | `{ id, date, subject, topic, tutorId, tutorName, studentId, studentName, status }` |
| `TutorSummary` | di dalam `byTutor` | `{ id, name, sessions, missed, students }` |
| `StudentSummary` | di dalam `byStudent` | `{ id, name, sessions, missed, tutors }` |
| `FinanceSummary` | `GET /pengelola/laporan-keuangan` | `{ state, months, month, bills, payments, honor, honorPaid, institutionShare }` |
| `StudentBillList` | `GET /pengelola/tagihan` | `{ months, month, total, paid, remaining, unpaid, partial, paidOff }` |
| `StudentBillRow` | di dalam daftar | `{ id, studentName, sessions, dueDate, total, remaining, status }` |
| `StudentBill` | `GET /pengelola/tagihan/:id` | `{ id, number, studentName, guardianName, period, dueDate, items, payments }` |
| `BillPayment` | di dalam `payments` | `{ id, amount, method, status, createdAt, manual? }` |
| `ManualPaymentInput` | `POST /pengelola/tagihan/:id/pembayaran` | `{ amount, paidAt, method, proof? }` |
| `ReportInput` / `ReportFile` | `POST /pengelola/laporan-keuangan/unduh` | `{ month, type, format }` → `{ name, size, url }` |
| `NotificationSetting` | `GET/PUT /pengelola/pengaturan-notifikasi` | `{ id, group, title, screenTitle, recipient, trigger, activeNote, enabled, channel, timing, template, variables, sample, previewNote }` |
| `SettingInput` | `PUT /pengelola/pengaturan-notifikasi/:id` | `{ enabled?, channel?, timing?, template? }` |
| `LogList` | `GET /pengelola/riwayat-notifikasi` | `{ failed, sent }` |
| `NotificationLog` | list/detail | `{ id, kind, channel, recipients, sentAt, status, message, attempts, lastAttemptAt, reason?, reasonShort?, permanent?, resentAt? }` |
| `Recipient` | di dalam `recipients` | `{ name, role, contact, accountId? }` |
| Kirim ulang semua | `POST /pengelola/riwayat-notifikasi/kirim-ulang` | `{ sent: string[], stillFailed: number }` |

Status sesi rekap: `belum_dikumpulkan` | `belum_divalidasi` |
`sudah_divalidasi` | `keberatan` | `tidak_terlaksana`.
Status akun: `aktif` | `nonaktif`. Status log: `terkirim` | `gagal`.

## Perbedaan & Keputusan

1. **Path alias.** Dua path frontend berbeda dari penamaan internal backend;
   backend menyediakan keduanya agar tidak ada perubahan di frontend:
   - `GET /wali/jadwal/:id` ↔ `GET /wali/jadwal/rutin/:id`
   - `POST /wali/tagihan/:id/bayar` ↔ `POST /wali/tagihan/:id/pembayaran`
2. **Bentuk pembayaran.** Frontend memanggil `createPayment(id, nominal)` dengan
   body `{ nominal }` dan mengharapkan `PaymentResult = { payment, bill }`.
   Backend mengikuti bentuk itu; `simulateFailure` opsional menghasilkan
   `kedaluwarsa` (sesuai mock frontend dan layar "Pembayaran gagal").
3. **Metode pembayaran.** Backend memilih `QRIS` untuk pelunasan dan
   `Virtual Account BCA` untuk pembayaran sebagian, sama seperti mock frontend.
   Tipe `GoPay` tetap didukung pada level data.
4. **Notifikasi.** Backend menyimpan `kind` sebagai string sehingga dapat
   memuat seluruh nilai yang dipakai tiap layar: wali (`validasi`, `tagihan`,
   `pembayaran`, `les`, `jadwal`), tutor (`presensi`, `keberatan`, `pengingat`,
   `rekap`, `honor`), dan pengelola (`pendaftaran`, `perubahan-jadwal`,
   `notifikasi-gagal`, `keberatan`, `penawaran`, `pembayaran`).
5. **Registrasi.** Frontend memakai `PendaftaranResult` ringkas setelah submit;
   backend mengembalikan `{ id, registrationNumber, submittedAt, studentName }`.
6. **`?hasil=gagal`.** Frontend menambahkan parameter ini saat development untuk
   mensimulasikan kegagalan. Backend tidak membaca query tersebut; gunakan
   `simulateFailure: true` pada body pembayaran.
7. **Data mock vs nyata.** Beberapa layar frontend masih memakai data contoh
   (mis. `PengelolaMenu.failedNotifications`). Backend menghitung nilai nyata
   dari database dan mengembalikan tipe yang sama.
8. **Data master tanpa hapus.** Tutor/siswa hanya bisa dinonaktifkan. Penonaktifan
   mengembalikan `409 active_schedule` (dengan `details.schedules`) selama masih
   ada jadwal les aktif. Endpoint `GET` mendukung filter `query`, `subject`,
   `district`, dan `status`.
9. **Akun & password.** Membuat akun/tutor dan reset password memakai password
   sementara (default `pintara123`). Password tidak pernah dikembalikan; reset
   hanya mengembalikan `{ email }`. Email/username duplikat → `409 duplicate_field`.
10. **Laporan.** `POST /pengelola/laporan-keuangan/unduh` menghasilkan PDF
    (`pdfkit`) atau XLSX (`exceljs`) sungguhan, disimpan lewat `StorageService`,
    lalu mengembalikan `{ name, size, url }`.
11. **Pengaturan notifikasi.** Template divalidasi terhadap daftar `variables`
    milik pengaturan; variabel tak dikenal → `422 VALIDATION_ERROR` dengan
    `details.variables`.
12. **Riwayat notifikasi.** Setiap kejadian penting menulis `NotificationLog`
    (pendaftaran, verifikasi, penawaran, keberatan, finalisasi presensi, rekap
    honor). Log gagal dapat dikirim ulang; log `permanent` tetap gagal sampai
    kontak penerima diperbarui.

## Ringkasan Parity

- Seluruh path pada komentar `TODO(backend)` frontend tersedia (lihat tabel),
  termasuk enam area pengelola baru: Data Master, Manajemen Akun, Rekap & Riwayat
  Les, Laporan Keuangan, Pengaturan Notifikasi, dan Riwayat Notifikasi.
- Nama field respons mengikuti serializer yang memetakan model database ke tipe
  frontend (`src/modules/shared/serializers.ts`).
- Status memakai string huruf kecil Bahasa Indonesia agar cocok dengan
  `StatusOf<...>` di frontend.
- Tidak ada pembungkus `data`; error memakai `{ error: { code, message } }`.