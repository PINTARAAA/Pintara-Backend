import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'pintara123';

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 86_400_000);

const at = (date: Date, time: string) => {
  const [hours, minutes] = time.split('.').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

async function clear() {
  await prisma.attendanceRecord.deleteMany();
  await prisma.lessonSession.deleteMany();
  await prisma.scheduleChangeRequest.deleteMany();
  await prisma.honorPayment.deleteMany();
  await prisma.honorLine.deleteMany();
  await prisma.honorRecap.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.billItem.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.pairSession.deleteMany();
  await prisma.pair.deleteMany();
  await prisma.tutorOffer.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.student.deleteMany();
  await prisma.tutorProfile.deleteMany();
  await prisma.file.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clear();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await prisma.appSetting.createMany({
    data: [
      { key: 'lbb_name', value: 'Pengelola LBB Jelajah Ilmu' },
      { key: 'lbb_whatsapp', value: '6281234567890' },
      { key: 'lbb_display', value: '0812-3456-7890' },
      { key: 'app_version', value: '1.0.0' },
    ],
  });

  await prisma.user.createMany({
    data: [
      { id: 'u-sari', name: 'Sari Wulandari', username: 'sari.wulandari', email: 'sari.wulandari@gmail.com', passwordHash, role: 'wali', whatsapp: '0812-3456-7890' },
      { id: 'u-dewi', name: 'Dewi Ananda', username: 'dewi.ananda', email: 'dewi.ananda@gmail.com', passwordHash, role: 'wali', whatsapp: '0813-5566-7788' },
      { id: 'u-arif', name: 'Arif Pratama', username: 'arif.pratama', email: 'arif.pratama@gmail.com', passwordHash, role: 'wali', whatsapp: '0857-1122-3344' },
      { id: 'u-lina', name: 'Lina Marlina', username: 'lina.marlina', email: 'lina.marlina@gmail.com', passwordHash, role: 'wali', whatsapp: '0812-2233-4455' },
      { id: 'u-wahyu', name: 'Wahyu Hidayat', username: 'wahyu.hidayat', email: 'wahyu.hidayat@gmail.com', passwordHash, role: 'wali', whatsapp: '0821-4455-6677' },
      { id: 'u-rina', name: 'Rina Kartika', username: 'rina.kartika', email: 'rina.kartika@gmail.com', passwordHash, role: 'wali', whatsapp: '0812-7788-9900' },
      { id: 'u-hendra', name: 'Hendra Wijaya', username: 'hendra.wijaya', email: 'hendra.wijaya@gmail.com', passwordHash, role: 'wali', whatsapp: '0813-2233-4455' },
      { id: 'u-andi', name: 'Andi Saputra', username: 'andi.saputra', email: 'andi.saputra@gmail.com', passwordHash, role: 'wali', whatsapp: '0857-3344-5566' },
      { id: 'u-yuni', name: 'Yuni Lestari', username: 'yuni.lestari', email: 'yuni.lestari@gmail.com', passwordHash, role: 'wali', whatsapp: '0813-9988-7766' },
      { id: 'u-budi', name: 'Kak Budi Santoso', username: 'budi.santoso', email: 'budi.santoso@gmail.com', passwordHash, role: 'tutor', whatsapp: '0812-1111-2222' },
      { id: 'u-dimas', name: 'Kak Dimas Arya', username: 'dimas.arya', email: 'dimas.arya@gmail.com', passwordHash, role: 'tutor', whatsapp: '0812-3333-4444' },
      { id: 'u-laila', name: 'Kak Laila Fitri', username: 'laila.fitri', email: 'laila.fitri@gmail.com', passwordHash, role: 'tutor', whatsapp: '0812-5555-6666' },
      { id: 'u-nadia', name: 'Kak Nadia Safitri', username: 'nadia.safitri', email: 'nadia.safitri@gmail.com', passwordHash, role: 'tutor', whatsapp: '0812-7777-8888' },
      { id: 'u-yoga', name: 'Kak Yoga Pratama', username: 'yoga.pratama', email: 'yoga.pratama@gmail.com', passwordHash, role: 'tutor', whatsapp: '0812-9999-0000' },
      { id: 'u-rina-tutor', name: 'Kak Rina Oktavia', username: 'rina.oktavia', email: 'rina.oktavia@gmail.com', passwordHash, role: 'tutor', whatsapp: '0812-1212-3434' },
      { id: 'u-ila', name: 'Nurul Laila (Kak Ila)', username: 'ila', email: 'ila@jelajahilmu.id', passwordHash, role: 'pengelola', whatsapp: '0812-0000-1122' },
    ],
  });

  await prisma.tutorProfile.createMany({
    data: [
      { id: 'tt-budi', userId: 'u-budi', shortName: 'Kak Budi', initials: 'BS', education: 'S1 Pendidikan Matematika · Univ. Negeri Surabaya', subjects: ['Matematika', 'IPA'], levels: ['SMP', 'SMA'], days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], availableFrom: '15.00', availableUntil: '21.00', rating: 4.8, ratePerSession: 60000, honorMethod: 'tunai', honorMethodNote: 'Diambil langsung tiap awal bulan', address: 'Jl. Trunojoyo No. 10, Bangkalan', lat: -7.156, lng: 112.723, defaultDistanceKm: 2.5 },
      { id: 'tt-dimas', userId: 'u-dimas', shortName: 'Kak Dimas', initials: 'DA', education: 'S1 Pendidikan Fisika · Univ. Trunojoyo', subjects: ['Fisika', 'Matematika'], levels: ['SMP', 'SMA'], days: ['Senin', 'Selasa', 'Kamis'], availableFrom: '16.00', availableUntil: '21.00', rating: 4.8, ratePerSession: 60000, honorMethod: 'transfer', address: 'Jl. Raya Kamal No. 8, Bangkalan', lat: -7.12, lng: 112.68, defaultDistanceKm: 4.2 },
      { id: 'tt-laila', userId: 'u-laila', shortName: 'Kak Laila', initials: 'LF', education: 'S1 Matematika · Univ. Negeri Surabaya', subjects: ['Matematika'], levels: ['SD', 'SMP', 'SMA'], days: ['Kamis', 'Sabtu'], availableFrom: '15.00', availableUntil: '21.00', rating: 4.9, ratePerSession: 60000, honorMethod: 'transfer', address: 'Jl. Halim Perdana Kusuma No. 2, Bangkalan', lat: -7.16, lng: 112.72, defaultDistanceKm: 3.1 },
      { id: 'tt-nadia', userId: 'u-nadia', shortName: 'Kak Nadia', initials: 'NS', education: 'S1 Pendidikan Bahasa Inggris · Univ. Trunojoyo', subjects: ['Bahasa Inggris'], levels: ['SD', 'SMP'], days: ['Kamis', 'Jumat'], availableFrom: '15.00', availableUntil: '18.00', rating: 4.7, ratePerSession: 50000, honorMethod: 'transfer', address: 'Jl. KH. Moh. Kholil No. 5, Bangkalan', lat: -7.15, lng: 112.73, defaultDistanceKm: 2.5 },
      { id: 'tt-yoga', userId: 'u-yoga', shortName: 'Kak Yoga', initials: 'YP', education: 'S1 Fisika · ITS', subjects: ['Fisika', 'Matematika'], levels: ['SMA'], days: ['Senin', 'Rabu', 'Kamis'], availableFrom: '18.00', availableUntil: '21.00', rating: 4.6, ratePerSession: null, honorMethod: 'transfer', address: 'Jl. Soekarno-Hatta No. 99, Bangkalan', lat: -7.14, lng: 112.75, defaultDistanceKm: 7.5 },
      { id: 'tt-rina', userId: 'u-rina-tutor', shortName: 'Kak Rina', initials: 'RO', education: 'S1 Sastra Inggris · Univ. Airlangga', subjects: ['Bahasa Inggris'], levels: ['SMP', 'SMA'], days: ['Selasa', 'Jumat'], availableFrom: '14.00', availableUntil: '17.00', rating: 4.5, ratePerSession: 50000, honorMethod: 'transfer', address: 'Jl. Raya Tanjung Bumi No. 12, Bangkalan', lat: -7.13, lng: 112.71, defaultDistanceKm: 6.4 },
    ],
  });

  await prisma.student.createMany({
    data: [
      { id: 's-aisyah', parentId: 'u-sari', name: 'Aisyah Putri', salutation: 'Ibu', grade: '8', level: 'SMP', school: 'SMP Negeri 1 Bangkalan', address: 'Jl. Trunojoyo No. 12, Bangkalan' },
      { id: 's-fikri', parentId: 'u-sari', name: 'Fikri Ramadhan', salutation: 'Ibu', grade: '5', level: 'SD', school: 'SD Negeri Kemayoran 1', address: 'Jl. Trunojoyo No. 12, Bangkalan' },
      { id: 's-rizky', parentId: 'u-dewi', name: 'Rizky Ananda', salutation: 'Ibu', grade: '10', level: 'SMA', school: 'SMA Negeri 2 Bangkalan', address: 'Jl. Soekarno-Hatta No. 45, Bangkalan' },
      { id: 's-dimas', parentId: 'u-arif', name: 'Dimas Pratama', salutation: 'Bapak', grade: '9', level: 'SMP', school: 'SMP Negeri 2 Bangkalan', address: 'Perum Kraton Indah B-3, Bangkalan' },
      { id: 's-salma', parentId: 'u-wahyu', name: 'Salma Azzahra', salutation: 'Bapak', grade: '7', level: 'SMP', school: 'SMP Negeri 3 Bangkalan', address: 'Jl. Raya Tanjung Bumi No. 3, Bangkalan' },
      { id: 's-bima', parentId: 'u-lina', name: 'Bima Saputra', salutation: 'Ibu', grade: '12', level: 'SMA', school: 'SMA Negeri 1 Bangkalan', address: 'Jl. Raya Burneh No. 7, Bangkalan' },
      { id: 's-nadia', parentId: 'u-rina', name: 'Nadia Salsabila', salutation: 'Ibu', grade: '5', level: 'SD', school: 'SD Negeri Kemayoran 1', address: 'Jl. Halim Perdana Kusuma No. 8, Bangkalan' },
      { id: 's-rafi', parentId: 'u-hendra', name: 'Rafi Hidayat', salutation: 'Bapak', grade: '11', level: 'SMA', school: 'SMA Negeri 2 Bangkalan', address: 'Perum Griya Utama Blok C-7, Bangkalan' },
    ],
  });

  await prisma.registration.createMany({
    data: [
      { id: 'reg-0098', number: 'REG-2026-0098', parentId: 'u-dewi', studentId: 's-rizky', studentName: 'Rizky Ananda', grade: '10', level: 'SMA', school: 'SMA Negeri 2 Bangkalan', address: 'Jl. Soekarno-Hatta No. 45, Bangkalan', parentName: 'Dewi Ananda', parentSalutation: 'Ibu', parentWhatsapp: '0813-5566-7788', parentEmail: 'dewi.ananda@gmail.com', subjects: ['Matematika', 'IPA'], perWeek: 2, days: ['Selasa', 'Sabtu'], startTime: '18.30', status: 'terverifikasi', submittedAt: addDays(now, -24), verifiedAt: addDays(now, -23), matchedTutorId: 'tt-budi', matchedAt: addDays(now, -22) },
      { id: 'reg-0100', number: 'REG-2026-0100', parentId: 'u-sari', studentId: 's-aisyah', studentName: 'Aisyah Putri', grade: '8', level: 'SMP', school: 'SMP Negeri 1 Bangkalan', address: 'Jl. Trunojoyo No. 12, Bangkalan', parentName: 'Sari Wulandari', parentSalutation: 'Ibu', parentWhatsapp: '0812-3456-7890', parentEmail: 'sari.wulandari@gmail.com', subjects: ['Matematika', 'IPA'], perWeek: 2, days: ['Rabu', 'Jumat'], startTime: '16.00', status: 'terverifikasi', submittedAt: addDays(now, -21), verifiedAt: addDays(now, -20), matchedTutorId: 'tt-budi', matchedAt: addDays(now, -19) },
      { id: 'reg-0104', number: 'REG-2026-0104', parentId: 'u-sari', studentId: 's-fikri', studentName: 'Fikri Ramadhan', grade: '5', level: 'SD', school: 'SD Negeri Kemayoran 1', address: 'Jl. Trunojoyo No. 12, Bangkalan', parentName: 'Sari Wulandari', parentSalutation: 'Ibu', parentWhatsapp: '0812-3456-7890', parentEmail: 'sari.wulandari@gmail.com', subjects: ['Bahasa Inggris'], perWeek: 1, days: ['Kamis'], startTime: '15.00', status: 'terverifikasi', submittedAt: addDays(now, -32), verifiedAt: addDays(now, -31), matchedTutorId: 'tt-nadia', matchedAt: addDays(now, -30) },
      { id: 'reg-0106', number: 'REG-2026-0106', parentId: 'u-lina', studentId: 's-bima', studentName: 'Bima Saputra', grade: '12', level: 'SMA', school: 'SMA Negeri 1 Bangkalan', address: 'Jl. Raya Burneh No. 7, Bangkalan', parentName: 'Lina Marlina', parentSalutation: 'Ibu', parentWhatsapp: '0812-2233-4455', parentEmail: 'lina.marlina@gmail.com', subjects: ['Fisika'], perWeek: 1, days: ['Kamis'], startTime: '18.30', status: 'terverifikasi', submittedAt: addDays(now, -42), verifiedAt: addDays(now, -41), matchedTutorId: 'tt-dimas', matchedAt: addDays(now, -40) },
      { id: 'reg-0109', number: 'REG-2026-0109', parentId: 'u-arif', studentId: 's-dimas', studentName: 'Dimas Pratama', grade: '9', level: 'SMP', school: 'SMP Negeri 2 Bangkalan', address: 'Perum Kraton Indah B-3, Bangkalan', parentName: 'Arif Pratama', parentSalutation: 'Bapak', parentWhatsapp: '0857-1122-3344', parentEmail: 'arif.pratama@gmail.com', subjects: ['IPA', 'Matematika'], perWeek: 2, days: ['Senin', 'Kamis'], startTime: '16.00', status: 'terverifikasi', submittedAt: addDays(now, -24), verifiedAt: addDays(now, -23), matchedTutorId: 'tt-budi', matchedAt: addDays(now, -22) },
      { id: 'reg-0112', number: 'REG-2026-0112', parentId: 'u-wahyu', studentId: 's-salma', studentName: 'Salma Azzahra', grade: '7', level: 'SMP', school: 'SMP Negeri 3 Bangkalan', address: 'Jl. Raya Tanjung Bumi No. 3, Bangkalan', parentName: 'Wahyu Hidayat', parentSalutation: 'Bapak', parentWhatsapp: '0821-4455-6677', parentEmail: 'wahyu.hidayat@gmail.com', subjects: ['Bahasa Inggris'], perWeek: 2, days: ['Selasa', 'Jumat'], startTime: '15.00', status: 'terverifikasi', submittedAt: addDays(now, -4), verifiedAt: addDays(now, -3), declinedTutorIds: ['tt-nadia'] },
      { id: 'reg-0115', number: 'REG-2026-0115', parentId: 'u-hendra', studentId: 's-rafi', studentName: 'Rafi Hidayat', grade: '11', level: 'SMA', school: 'SMA Negeri 2 Bangkalan', address: 'Perum Griya Utama Blok C-7, Bangkalan', parentName: 'Hendra Wijaya', parentSalutation: 'Bapak', parentWhatsapp: '0813-2233-4455', parentEmail: 'hendra.wijaya@gmail.com', subjects: ['Fisika', 'Matematika'], perWeek: 2, days: ['Senin', 'Kamis'], startTime: '19.00', notes: 'Persiapan UTBK 2027', status: 'menunggu_verifikasi', submittedAt: addDays(now, -2) },
      { id: 'reg-0118', number: 'REG-2026-0118', parentId: 'u-rina', studentId: 's-nadia', studentName: 'Nadia Salsabila', grade: '5', level: 'SD', school: 'SD Negeri Kemayoran 1', address: 'Jl. Halim Perdana Kusuma No. 8, Bangkalan', parentName: 'Rina Kartika', parentSalutation: 'Ibu', parentWhatsapp: '0812-7788-9900', parentEmail: 'rina.kartika@gmail.com', subjects: ['Matematika'], perWeek: 1, days: ['Rabu'], startTime: '15.30', status: 'menunggu_verifikasi', submittedAt: addDays(now, -1) },
      { id: 'reg-0121', number: 'REG-2026-0121', parentId: 'u-andi', studentName: 'Fajar Ramadhan', grade: '9', level: 'SMP', school: 'SMP Negeri 1 Bangkalan', address: 'Jl. KH. Moh. Kholil No. 21, Bangkalan', parentName: 'Andi Saputra', parentSalutation: 'Bapak', parentWhatsapp: '0857-3344-5566', parentEmail: 'andi.saputra@gmail.com', subjects: ['IPA', 'Bahasa Inggris'], perWeek: 2, days: ['Selasa', 'Jumat'], startTime: '16.00', notes: 'Persiapan ujian sekolah', status: 'menunggu_verifikasi', submittedAt: now },
      { id: 'reg-0107', number: 'REG-2026-0107', parentId: 'u-yuni', studentName: 'Kevin Pratama', grade: '12', level: 'SMA', school: 'SMA Negeri 1 Sampang', address: 'Jl. Jaksa Agung Suprapto No. 40, Sampang', parentName: 'Yuni Lestari', parentSalutation: 'Ibu', parentWhatsapp: '0813-9988-7766', parentEmail: 'yuni.lestari@gmail.com', subjects: ['Kimia'], perWeek: 1, days: ['Sabtu'], startTime: '09.00', status: 'ditolak', submittedAt: addDays(now, -12), rejectedAt: addDays(now, -11), rejectionReason: 'di_luar_jangkauan', rejectionMessage: 'Mohon maaf, alamat les di Sampang belum termasuk area layanan kami. Kami akan mengabari Ibu bila layanan sudah menjangkau area tersebut.' },
    ],
  });

  await prisma.tutorOffer.createMany({
    data: [
      { id: 'pw-0001', registrationId: 'reg-0100', tutorId: 'tt-budi', studentName: 'Aisyah Putri', grade: '8', level: 'SMP', subjects: ['Matematika', 'IPA'], schedule: 'Rabu & Jumat, 16.00', location: 'Jl. Trunojoyo', distanceKm: 2.1, rate: 60000, sentAt: addDays(now, -19), status: 'diterima', answeredAt: addDays(now, -19) },
      { id: 'pw-0002', registrationId: 'reg-0098', tutorId: 'tt-budi', studentName: 'Rizky Ananda', grade: '10', level: 'SMA', subjects: ['Matematika', 'IPA'], schedule: 'Selasa & Sabtu, 18.30', location: 'Jl. Soekarno-Hatta', distanceKm: 3.2, rate: 60000, sentAt: addDays(now, -24), status: 'diterima', answeredAt: addDays(now, -23) },
      { id: 'pw-0003', registrationId: 'reg-0104', tutorId: 'tt-nadia', studentName: 'Fikri Ramadhan', grade: '5', level: 'SD', subjects: ['Bahasa Inggris'], schedule: 'Kamis, 15.00', location: 'Jl. Trunojoyo', distanceKm: 2.4, rate: 50000, sentAt: addDays(now, -30), status: 'diterima', answeredAt: addDays(now, -30) },
      { id: 'pw-0004', registrationId: 'reg-0109', tutorId: 'tt-budi', studentName: 'Dimas Pratama', grade: '9', level: 'SMP', subjects: ['IPA', 'Matematika'], schedule: 'Senin & Kamis, 16.00', location: 'Perum Kraton Indah', distanceKm: 2.6, rate: 60000, sentAt: addDays(now, -22), status: 'diterima', answeredAt: addDays(now, -22) },
      { id: 'pw-0005', registrationId: 'reg-0106', tutorId: 'tt-dimas', studentName: 'Bima Saputra', grade: '12', level: 'SMA', subjects: ['Fisika'], schedule: 'Kamis, 18.30', location: 'Jl. Raya Burneh', distanceKm: 3.5, rate: 60000, sentAt: addDays(now, -40), status: 'diterima', answeredAt: addDays(now, -40) },
      { id: 'pw-0007', registrationId: 'reg-0112', tutorId: 'tt-nadia', studentName: 'Salma Azzahra', grade: '7', level: 'SMP', subjects: ['Bahasa Inggris'], schedule: 'Selasa & Jumat, 15.00', location: 'Jl. Raya Tanjung Bumi', distanceKm: 1.8, rate: 50000, sentAt: addDays(now, -4), status: 'ditolak', answeredAt: addDays(now, -4), declineReason: 'jadwal_bentrok', declineNote: 'Kak Nadia hanya bisa mengajar hari Jumat.' },
    ],
  });

  const pairs = [
    { id: 'pr-aisyah', studentId: 's-aisyah', tutorId: 'tt-budi', offerId: 'pw-0001', registrationId: 'reg-0100', subjects: ['Matematika', 'IPA'], effectiveFrom: addDays(now, -19), sessions: [
      { subject: 'Matematika', day: 'Rabu', dayOfWeek: 3, startTime: '16.00', endTime: '17.30' },
      { subject: 'IPA', day: 'Jumat', dayOfWeek: 5, startTime: '16.00', endTime: '17.30' },
    ] },
    { id: 'pr-rizky', studentId: 's-rizky', tutorId: 'tt-budi', offerId: 'pw-0002', registrationId: 'reg-0098', subjects: ['Matematika', 'IPA'], effectiveFrom: addDays(now, -21), sessions: [
      { subject: 'IPA', day: 'Selasa', dayOfWeek: 2, startTime: '18.30', endTime: '20.00' },
      { subject: 'Matematika', day: 'Sabtu', dayOfWeek: 6, startTime: '18.30', endTime: '20.00' },
    ] },
    { id: 'pr-dimas', studentId: 's-dimas', tutorId: 'tt-budi', offerId: 'pw-0004', registrationId: 'reg-0109', subjects: ['IPA', 'Matematika'], effectiveFrom: addDays(now, -20), sessions: [
      { subject: 'IPA', day: 'Senin', dayOfWeek: 1, startTime: '16.00', endTime: '17.30' },
    ] },
    { id: 'pr-fikri', studentId: 's-fikri', tutorId: 'tt-nadia', offerId: 'pw-0003', registrationId: 'reg-0104', subjects: ['Bahasa Inggris'], effectiveFrom: addDays(now, -30), sessions: [
      { subject: 'Bahasa Inggris', day: 'Kamis', dayOfWeek: 4, startTime: '15.00', endTime: '16.30' },
    ] },
    { id: 'pr-bima', studentId: 's-bima', tutorId: 'tt-dimas', offerId: 'pw-0005', registrationId: 'reg-0106', subjects: ['Fisika'], effectiveFrom: addDays(now, -40), sessions: [
      { subject: 'Fisika', day: 'Kamis', dayOfWeek: 4, startTime: '18.30', endTime: '20.00' },
    ] },
  ];

  for (const pair of pairs) {
    await prisma.pair.create({
      data: {
        id: pair.id,
        studentId: pair.studentId,
        tutorId: pair.tutorId,
        offerId: pair.offerId,
        registrationId: pair.registrationId,
        subjects: pair.subjects,
        effectiveFrom: pair.effectiveFrom,
        sessions: {
          create: pair.sessions.map((session) => ({
            id: `ps-${pair.id}-${session.subject.toLowerCase().replace(/\s+/g, '-')}`,
            ...session,
          })),
        },
      },
    });
  }

  const storedPairs = await prisma.pair.findMany({
    include: { sessions: true, student: true },
  });

  const topics: Record<string, string[]> = {
    Matematika: ['Persamaan linear satu variabel', 'Fungsi kuadrat', 'Bentuk aljabar', 'Statistika dasar'],
    IPA: ['Sistem pencernaan manusia', 'Sistem peredaran darah', 'Hukum Newton', 'Klasifikasi makhluk hidup'],
    'Bahasa Inggris': ['Simple present tense', 'Reading comprehension', 'Past tense'],
    Fisika: ['Gerak lurus', 'Hukum Newton', 'Tekanan zat'],
  };

  for (const pair of storedPairs) {
    for (const session of pair.sessions) {
      for (let week = -6; week <= 4; week += 1) {
        const date = addDays(
          today,
          session.dayOfWeek - today.getDay() + week * 7,
        );
        const start = at(date, session.startTime);
        const end = at(date, session.endTime);
        await prisma.lessonSession.create({
          data: {
            pairId: pair.id,
            subject: session.subject,
            start,
            end,
            status: start < now ? 'selesai' : 'terjadwal',
          },
        });
      }
    }
  }

  const past = await prisma.lessonSession.findMany({
    where: { start: { lt: now } },
    include: { pair: { include: { student: true } } },
    orderBy: { start: 'desc' },
  });
  const latestByPair = new Set<string>();
  for (const [index, lesson] of past.entries()) {
    const firstForPair = !latestByPair.has(lesson.pairId);
    latestByPair.add(lesson.pairId);
    if (
      firstForPair &&
      ['s-dimas', 's-rizky'].includes(lesson.pair.studentId)
    ) {
      continue;
    }
    const subjectTopics = topics[lesson.subject] ?? ['Materi les'];
    const topic = subjectTopics[index % subjectTopics.length];
    const ageDays = Math.floor(
      (now.getTime() - lesson.start.getTime()) / 86_400_000,
    );
    let validation = 'sudah_divalidasi';
    if (ageDays <= 10 && index % 3 === 0) validation = 'belum_divalidasi';
    if (
      firstForPair &&
      lesson.pair.studentId === 's-aisyah' &&
      lesson.subject === 'Matematika'
    ) {
      validation = 'keberatan';
    }
    if (
      firstForPair &&
      lesson.pair.studentId === 's-aisyah' &&
      lesson.subject === 'IPA'
    ) {
      validation = 'belum_divalidasi';
    }
    const finalized = validation === 'sudah_divalidasi' && ageDays > 14;
    await prisma.attendanceRecord.create({
      data: {
        sessionId: lesson.id,
        held: !(lesson.pair.studentId === 's-fikri' && index % 11 === 0),
        actualStart: sessionStart(lesson.start),
        actualEnd: sessionEnd(lesson.end),
        studentPresent: true,
        studentAttendance: 'Hadir',
        tutorAttendance: 'Hadir',
        topic,
        notes: index % 4 === 0 ? 'Lanjut latihan soal dan pembahasan.' : null,
        ...(lesson.pair.studentId === 's-aisyah' &&
        lesson.subject === 'IPA' &&
        firstForPair
          ? { attachmentName: 'foto_sesi_ipa.jpg', attachmentSize: 1_200_000 }
          : {}),
        ...(validation === 'keberatan'
          ? {
              objectionReason:
                'Les hanya berlangsung 45 menit, bukan 90 menit seperti yang tercatat.',
              objectionAt: addDays(lesson.end, 0),
            }
          : {}),
        submittedAt: addDays(lesson.end, 0),
        validation,
        ...(validation === 'sudah_divalidasi'
          ? { validatedAt: addDays(lesson.end, 0) }
          : {}),
        ...(finalized ? { finalizedAt: addDays(lesson.end, 2) } : {}),
        ...(ageDays > 7 && validation === 'sudah_divalidasi'
          ? { reviewRating: 5, reviewComment: 'Penjelasan mudah dipahami.', reviewSubmittedAt: addDays(lesson.end, 1) }
          : {}),
      },
    });
  }

  const aisyahRoutine = await prisma.pairSession.findFirst({
    where: { pairId: 'pr-aisyah', subject: 'Matematika' },
  });
  await prisma.scheduleChangeRequest.create({
    data: {
      id: 'cr-0001',
      pairId: 'pr-aisyah',
      routineId: aisyahRoutine?.id,
      studentId: 's-aisyah',
      tutorId: 'tt-budi',
      subject: 'Matematika',
      durationMinutes: 90,
      fromWeekday: 3,
      fromStartTime: '16.00',
      toWeekday: 4,
      toStartTime: '17.00',
      scope: 'sekali',
      effectiveDate: addDays(now, 7),
      reason: 'Ada acara keluarga pada hari Rabu.',
      status: 'ditinjau_pengelola',
      submittedAt: addDays(now, -1),
    },
  });

  await prisma.bill.create({
    data: {
      id: 'bill-aisyah-current',
      number: `INV-${now.getFullYear()}-0112`,
      studentId: 's-aisyah',
      period: monthStart,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 16),
      total: 600000,
      paid: 450000,
      status: 'sebagian',
      items: {
        create: [
          { subject: 'Matematika', sessions: 4, unitPrice: 75000 },
          { subject: 'IPA', sessions: 4, unitPrice: 75000 },
        ],
      },
      payments: {
        create: {
          billPeriod: monthStart,
          amount: 450000,
          method: 'QRIS',
          status: 'berhasil',
          externalId: 'TRX-SEED-0001',
          paidAt: addDays(now, -5),
          createdAt: addDays(now, -5),
        },
      },
    },
  });
  await prisma.bill.create({
    data: {
      id: 'bill-fikri-current',
      number: `INV-${now.getFullYear()}-0104`,
      studentId: 's-fikri',
      period: monthStart,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 16),
      total: 300000,
      paid: 0,
      status: 'belum_bayar',
      items: {
        create: [{ subject: 'Bahasa Inggris', sessions: 4, unitPrice: 75000 }],
      },
    },
  });
  await prisma.bill.create({
    data: {
      id: 'bill-dimas-overdue',
      number: `INV-${now.getFullYear()}-0109`,
      studentId: 's-dimas',
      period: lastMonthStart,
      dueDate: addDays(lastMonthStart, 15),
      total: 600000,
      paid: 0,
      status: 'belum_bayar',
      items: {
        create: [
          { subject: 'IPA', sessions: 4, unitPrice: 75000 },
          { subject: 'Matematika', sessions: 4, unitPrice: 75000 },
        ],
      },
    },
  });
  await prisma.bill.create({
    data: {
      id: 'bill-rizky-lunas',
      number: `INV-${now.getFullYear()}-0098`,
      studentId: 's-rizky',
      period: lastMonthStart,
      dueDate: addDays(lastMonthStart, 15),
      total: 720000,
      paid: 720000,
      status: 'lunas',
      items: {
        create: [
          { subject: 'IPA', sessions: 4, unitPrice: 90000 },
          { subject: 'Matematika', sessions: 4, unitPrice: 90000 },
        ],
      },
      payments: {
        create: {
          billPeriod: lastMonthStart,
          amount: 720000,
          method: 'Virtual Account BCA',
          status: 'berhasil',
          externalId: 'TRX-SEED-0002',
          paidAt: addDays(lastMonthStart, 10),
          createdAt: addDays(lastMonthStart, 10),
        },
      },
    },
  });

  await prisma.notification.createMany({
    data: [
      { userId: 'u-sari', kind: 'tagihan', title: 'Tagihan bulan ini belum lunas', body: 'Sisa Rp150.000', to: '/wali/tagihan/bill-aisyah-current', createdAt: addDays(now, -1) },
      { userId: 'u-sari', kind: 'validasi', title: '2 sesi perlu divalidasi', body: 'Matematika dan IPA Aisyah Putri', to: '/wali/absensi', createdAt: addDays(now, -2) },
      { userId: 'u-sari', kind: 'les', title: 'Les dimulai', body: 'Matematika & IPA bersama Kak Budi', to: '/wali/jadwal', readAt: addDays(now, -3), createdAt: addDays(now, -19) },
      { userId: 'u-budi', kind: 'validasi', title: 'Isi presensi yang terlewat', body: 'IPA · Dimas Pratama', to: '/tutor/presensi', createdAt: addDays(now, -1) },
      { userId: 'u-budi', kind: 'validasi', title: 'Keberatan dari wali', body: 'Matematika · Aisyah Putri', status: 'sedang ditinjau Pengelola', to: '/tutor/presensi/status', createdAt: addDays(now, -1) },
      { userId: 'u-ila', kind: 'les', title: 'Pendaftaran baru menunggu verifikasi', body: 'Rafi Hidayat · REG-2026-0115', to: '/pengelola/pendaftaran/reg-0115', createdAt: addDays(now, -2) },
    ],
  });

  const recap = await prisma.honorRecap.create({
    data: { month: monthKey(lastMonthStart), calculatedAt: addDays(lastMonthStart, 20) },
  });
  const lastMonthHonors = [
    { tutorId: 'tt-budi', name: 'Kak Budi Santoso', shortName: 'Kak Budi', sessions: 13, total: 780000, method: 'tunai', subjectLines: [{ subject: 'Matematika', sessions: 7, rate: 60000, amount: 420000 }, { subject: 'IPA', sessions: 6, rate: 60000, amount: 360000 }] },
    { tutorId: 'tt-laila', name: 'Kak Laila Fitri', shortName: 'Kak Laila', sessions: 54, total: 3240000, method: 'transfer', subjectLines: [{ subject: 'Matematika', sessions: 54, rate: 60000, amount: 3240000 }] },
    { tutorId: 'tt-dimas', name: 'Kak Dimas Arya', shortName: 'Kak Dimas', sessions: 51, total: 3060000, method: 'transfer', subjectLines: [{ subject: 'Fisika', sessions: 26, rate: 60000, amount: 1560000 }, { subject: 'Matematika', sessions: 25, rate: 60000, amount: 1500000 }] },
  ];
  for (const honor of lastMonthHonors) {
    const line = await prisma.honorLine.create({
      data: { recapId: recap.id, ...honor },
    });
    await prisma.honorPayment.create({
      data: {
        honorLineId: line.id,
        amount: honor.total,
        method: honor.method,
        paidAt: addDays(lastMonthStart, 24),
        proofName: `bukti_honor_${honor.shortName.split(' ')[1].toLowerCase()}.jpg`,
        proofSize: 640000,
        recordedAt: addDays(lastMonthStart, 24),
      },
    });
  }

  console.log('Seed selesai.');
  console.log('Login wali: sari.wulandari / pintara123');
  console.log('Login tutor: budi.santoso / pintara123');
  console.log('Login pengelola: ila / pintara123');
}

function sessionStart(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}.${String(date.getMinutes()).padStart(2, '0')}`;
}

function sessionEnd(date: Date) {
  return sessionStart(date);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
