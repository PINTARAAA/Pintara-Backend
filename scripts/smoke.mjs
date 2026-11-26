/**
 * Smoke test ringkas PINTARA API (read-only).
 *
 * Server harus sudah berjalan dan database demo sudah di-seed:
 *   npm run build && npm start
 *   npm run db:seed
 *   npm run smoke
 *
 * Base URL bisa diubah lewat env:
 *   API_URL=http://localhost:4000 npm run smoke
 */
const BASE = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'pintara123';

let passed = 0;
let failed = 0;

function check(label, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${label}${extra ? ` -> ${extra}` : ''}`);
  }
}

async function request(method, path, { token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

async function login(identifier) {
  const { status, json } = await request('POST', '/auth/login', {
    body: { identifier, password: PASSWORD },
  });
  check(
    `login ${identifier}`,
    status === 200 && json?.role && typeof json?.token === 'string',
    `status ${status} ${JSON.stringify(json?.error ?? '')}`,
  );
  return json;
}

const hasKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  keys.every((key) => key in value);
const isArray = (value) => Array.isArray(value);

console.log(`\n🔎 Smoke test PINTARA API di ${BASE}\n`);

/* ---------- Health & auth ---------- */

const health = await request('GET', '/health');
check(
  'GET /health',
  health.status === 200 && health.json?.status === 'ok' && health.json?.database === 'up',
  `status ${health.status} ${JSON.stringify(health.json)}`,
);

const wali = await login('sari.wulandari');
const tutor = await login('budi.santoso');
const pengelola = await login('ila');

const me = await request('GET', '/auth/me', { token: wali?.token });
check(
  'GET /auth/me',
  me.status === 200 && me.json?.role === 'wali' && typeof me.json?.name === 'string',
);

const badLogin = await request('POST', '/auth/login', {
  body: { identifier: 'sari.wulandari', password: 'salah' },
});
check(
  'login password salah ditolak (401 invalid_credentials)',
  badLogin.status === 401 && badLogin.json?.error?.code === 'invalid_credentials',
);

const noToken = await request('GET', '/wali/dashboard');
check('endpoint terproteksi tanpa token ditolak (401)', noToken.status === 401);

const wrongRole = await request('GET', '/tutor/dashboard', { token: wali?.token });
check('role guard: wali tidak boleh akses /tutor/*', wrongRole.status === 403);

/* ---------- Wali ---------- */

const waliDashboard = await request('GET', '/wali/dashboard', { token: wali?.token });
check(
  'GET /wali/dashboard',
  waliDashboard.status === 200 &&
    hasKeys(waliDashboard.json, ['parent', 'students', 'activeStudentId', 'tasks', 'history']),
);

const waliAccount = await request('GET', '/wali/akun', { token: wali?.token });
check(
  'GET /wali/akun',
  waliAccount.status === 200 &&
    hasKeys(waliAccount.json, ['name', 'initials', 'role', 'lbbContact', 'appVersion']),
);

const waliSchedule = await request('GET', '/wali/jadwal', { token: wali?.token });
check(
  'GET /wali/jadwal',
  waliSchedule.status === 200 &&
    hasKeys(waliSchedule.json, ['week', 'routines', 'pendingRequests']) &&
    isArray(waliSchedule.json?.routines),
);

const routineId = waliSchedule.json?.routines?.[0]?.id;
if (routineId) {
  const canonical = await request('GET', `/wali/jadwal/rutin/${routineId}`, { token: wali?.token });
  const alias = await request('GET', `/wali/jadwal/${routineId}`, { token: wali?.token });
  check(
    'GET /wali/jadwal/:id (alias kontrak) sama dengan /jadwal/rutin/:id',
    canonical.status === 200 &&
      alias.status === 200 &&
      JSON.stringify(canonical.json) === JSON.stringify(alias.json),
    `canonical ${canonical.status}, alias ${alias.status}`,
  );
} else {
  check('GET /wali/jadwal/:id (alias kontrak)', false, 'tidak ada jadwal rutin pada seed');
}

const waliAttendance = await request('GET', '/wali/presensi', { token: wali?.token });
check(
  'GET /wali/presensi',
  waliAttendance.status === 200 &&
    hasKeys(waliAttendance.json, ['pending', 'history', 'multipleStudents']) &&
    isArray(waliAttendance.json?.pending),
);

const waliHistory = await request('GET', '/wali/riwayat-les', { token: wali?.token });
check(
  'GET /wali/riwayat-les',
  waliHistory.status === 200 &&
    hasKeys(waliHistory.json, ['months', 'month', 'sessions', 'summary']),
);

const waliBills = await request('GET', '/wali/tagihan', { token: wali?.token });
check(
  'GET /wali/tagihan',
  waliBills.status === 200 && hasKeys(waliBills.json, ['priority', 'others']),
);

const billId = waliBills.json?.priority?.id ?? waliBills.json?.others?.[0]?.id;
if (billId) {
  const bill = await request('GET', `/wali/tagihan/${billId}`, { token: wali?.token });
  check(
    'GET /wali/tagihan/:id',
    bill.status === 200 &&
      hasKeys(bill.json, ['id', 'number', 'period', 'dueDate', 'items', 'total', 'paid']),
  );
}

const payments = await request('GET', '/wali/pembayaran', { token: wali?.token });
check('GET /wali/pembayaran', payments.status === 200 && isArray(payments.json));

const waliNotifications = await request('GET', '/wali/notifikasi', { token: wali?.token });
check(
  'GET /wali/notifikasi',
  waliNotifications.status === 200 &&
    hasKeys(waliNotifications.json, ['unread', 'read']) &&
    isArray(waliNotifications.json?.unread),
);

/* ---------- Tutor ---------- */

const tutorDashboard = await request('GET', '/tutor/dashboard', { token: tutor?.token });
check(
  'GET /tutor/dashboard',
  tutorDashboard.status === 200 &&
    hasKeys(tutorDashboard.json, ['tutor', 'tasks', 'upcoming', 'recap']),
);

const tutorAccount = await request('GET', '/tutor/akun', { token: tutor?.token });
check(
  'GET /tutor/akun',
  tutorAccount.status === 200 && hasKeys(tutorAccount.json, ['name', 'teaching', 'lbbContact']),
);

const tutorAttendance = await request('GET', '/tutor/presensi', { token: tutor?.token });
check(
  'GET /tutor/presensi',
  tutorAttendance.status === 200 && hasKeys(tutorAttendance.json, ['toFill', 'laterToday', 'filled']),
);

const tutorStatus = await request('GET', '/tutor/presensi/status', { token: tutor?.token });
check(
  'GET /tutor/presensi/status',
  tutorStatus.status === 200 &&
    hasKeys(tutorStatus.json, ['months', 'month', 'total', 'waiting', 'verified']),
);

const tutorHistory = await request('GET', '/tutor/riwayat', { token: tutor?.token });
check(
  'GET /tutor/riwayat',
  tutorHistory.status === 200 &&
    hasKeys(tutorHistory.json, ['months', 'month', 'sessions', 'summary']),
);

const tutorSchedule = await request('GET', '/tutor/jadwal', { token: tutor?.token });
check(
  'GET /tutor/jadwal',
  tutorSchedule.status === 200 && hasKeys(tutorSchedule.json, ['week', 'days']) && isArray(tutorSchedule.json?.days),
);

const tutorNotifications = await request('GET', '/tutor/notifikasi', { token: tutor?.token });
check(
  'GET /tutor/notifikasi',
  tutorNotifications.status === 200 && hasKeys(tutorNotifications.json, ['unread', 'read']),
);

/* ---------- Pengelola ---------- */

const pengelolaDashboard = await request('GET', '/pengelola/dashboard', { token: pengelola?.token });
check(
  'GET /pengelola/dashboard',
  pengelolaDashboard.status === 200 &&
    hasKeys(pengelolaDashboard.json, ['admin', 'today', 'tasks', 'billing']),
);

const pengelolaMenu = await request('GET', '/pengelola/lainnya', { token: pengelola?.token });
check(
  'GET /pengelola/lainnya',
  pengelolaMenu.status === 200 &&
    hasKeys(pengelolaMenu.json, ['name', 'tutors', 'students', 'failedNotifications']),
);

const registrations = await request('GET', '/pengelola/pendaftaran', { token: pengelola?.token });
check(
  'GET /pengelola/pendaftaran',
  registrations.status === 200 &&
    hasKeys(registrations.json, ['counts', 'items']) &&
    isArray(registrations.json?.items),
);

const regId = registrations.json?.items?.[0]?.id;
if (regId) {
  const registration = await request('GET', `/pengelola/pendaftaran/${regId}`, {
    token: pengelola?.token,
  });
  check(
    'GET /pengelola/pendaftaran/:id',
    registration.status === 200 && hasKeys(registration.json, ['id', 'number', 'student', 'parent']),
  );
}

const matching = await request('GET', '/pengelola/pencocokan', { token: pengelola?.token });
check('GET /pengelola/pencocokan', matching.status === 200 && isArray(matching.json));

const matchId = matching.json?.[0]?.id;
if (matchId) {
  const candidates = await request('GET', `/pengelola/pencocokan/${matchId}`, {
    token: pengelola?.token,
  });
  check(
    'GET /pengelola/pencocokan/:id',
    candidates.status === 200 &&
      hasKeys(candidates.json, ['registration', 'candidates', 'fullMatches']) &&
      isArray(candidates.json?.candidates),
  );
}

const offers = await request('GET', '/pengelola/penawaran', { token: pengelola?.token });
check(
  'GET /pengelola/penawaran',
  offers.status === 200 &&
    hasKeys(offers.json, ['unsent', 'waiting', 'history']) &&
    isArray(offers.json?.history),
);

const board = await request('GET', '/pengelola/jadwal', { token: pengelola?.token });
check(
  'GET /pengelola/jadwal',
  board.status === 200 &&
    hasKeys(board.json, ['toSchedule', 'requests', 'active']) &&
    isArray(board.json?.active),
);

const pairId = board.json?.active?.[0]?.id;
if (pairId) {
  const draft = await request('GET', `/pengelola/jadwal/${pairId}`, { token: pengelola?.token });
  check(
    'GET /pengelola/jadwal/:pairId (draf)',
    draft.status === 200 &&
      hasKeys(draft.json, ['student', 'tutor', 'subjects', 'sessions', 'effectiveFrom']),
  );
}

const pengelolaAttendance = await request('GET', '/pengelola/presensi', { token: pengelola?.token });
check(
  'GET /pengelola/presensi',
  pengelolaAttendance.status === 200 &&
    hasKeys(pengelolaAttendance.json, ['month', 'total', 'final', 'ready', 'objections']),
);

const honor = await request('GET', '/pengelola/honor', { token: pengelola?.token });
const honorOk =
  honor.status === 200 &&
  hasKeys(honor.json, ['state', 'months', 'month', 'total']) &&
  (honor.json?.state === 'dihitung'
    ? hasKeys(honor.json, ['paid', 'unpaid', 'unpaidHonors', 'paidHonors', 'skipped'])
    : hasKeys(honor.json, ['final', 'tutorsWithoutRate']));
check('GET /pengelola/honor', honorOk, JSON.stringify(honor.json).slice(0, 200));

const pengelolaNotifications = await request('GET', '/pengelola/notifikasi', {
  token: pengelola?.token,
});
check(
  'GET /pengelola/notifikasi',
  pengelolaNotifications.status === 200 &&
    hasKeys(pengelolaNotifications.json, ['unread', 'read']),
);

/* ---------- Pengelola · Data Master & Manajemen Akun ---------- */

const tutorList = await request('GET', '/pengelola/tutor', { token: pengelola?.token });
check(
  'GET /pengelola/tutor',
  tutorList.status === 200 &&
    isArray(tutorList.json) &&
    (tutorList.json.length === 0 ||
      hasKeys(tutorList.json[0], ['id', 'name', 'subjects', 'levels', 'district', 'rate', 'status'])),
  JSON.stringify(tutorList.json).slice(0, 160),
);

const tutorId = tutorList.json?.[0]?.id;
if (tutorId) {
  const tutorDetail = await request('GET', `/pengelola/tutor/${tutorId}`, {
    token: pengelola?.token,
  });
  check(
    'GET /pengelola/tutor/:id',
    tutorDetail.status === 200 &&
      hasKeys(tutorDetail.json, [
        'id',
        'name',
        'phone',
        'email',
        'education',
        'subjects',
        'levels',
        'days',
        'from',
        'until',
        'address',
        'district',
        'rate',
        'pickup',
        'joinedAt',
        'activeStudents',
        'activeSchedules',
        'status',
      ]),
    JSON.stringify(tutorDetail.json).slice(0, 160),
  );
}

const studentList = await request('GET', '/pengelola/siswa', { token: pengelola?.token });
check(
  'GET /pengelola/siswa',
  studentList.status === 200 &&
    isArray(studentList.json) &&
    (studentList.json.length === 0 ||
      hasKeys(studentList.json[0], ['id', 'name', 'grade', 'subjects', 'status', 'tutorNames'])),
  JSON.stringify(studentList.json).slice(0, 160),
);

const studentId = studentList.json?.[0]?.id;
if (studentId) {
  const studentDetail = await request('GET', `/pengelola/siswa/${studentId}`, {
    token: pengelola?.token,
  });
  check(
    'GET /pengelola/siswa/:id',
    studentDetail.status === 200 &&
      hasKeys(studentDetail.json, [
        'id',
        'name',
        'grade',
        'school',
        'address',
        'district',
        'subjects',
        'needs',
        'guardian',
        'lessons',
        'status',
      ]),
    JSON.stringify(studentDetail.json).slice(0, 160),
  );
}

const accounts = await request('GET', '/pengelola/akun?peran=wali', {
  token: pengelola?.token,
});
check(
  'GET /pengelola/akun?peran=wali',
  accounts.status === 200 &&
    hasKeys(accounts.json, ['counts', 'items']) &&
    hasKeys(accounts.json?.counts, ['wali', 'tutor', 'pengelola']),
);

const accountId = accounts.json?.items?.[0]?.id;
if (accountId) {
  const accountDetail = await request('GET', `/pengelola/akun/${accountId}`, {
    token: pengelola?.token,
  });
  check(
    'GET /pengelola/akun/:id',
    accountDetail.status === 200 &&
      hasKeys(accountDetail.json, [
        'id',
        'role',
        'name',
        'email',
        'username',
        'phone',
        'createdAt',
        'lastLoginAt',
        'status',
        'studentIds',
        'students',
      ]),
    JSON.stringify(accountDetail.json).slice(0, 160),
  );
}

const linkable = await request('GET', '/pengelola/akun/siswa', { token: pengelola?.token });
check(
  'GET /pengelola/akun/siswa',
  linkable.status === 200 &&
    isArray(linkable.json) &&
    (linkable.json.length === 0 ||
      hasKeys(linkable.json[0], ['id', 'name', 'grade', 'status'])),
);

/* ---------- Pengelola · Rekap & Laporan ---------- */

const lessonRecap = await request('GET', '/pengelola/riwayat-les', { token: pengelola?.token });
check(
  'GET /pengelola/riwayat-les',
  lessonRecap.status === 200 &&
    hasKeys(lessonRecap.json, [
      'months',
      'month',
      'tutorOptions',
      'studentOptions',
      'held',
      'missed',
      'pairs',
      'byTutor',
      'byStudent',
      'sessions',
    ]),
  JSON.stringify(lessonRecap.json).slice(0, 160),
);

const finance = await request('GET', '/pengelola/laporan-keuangan', { token: pengelola?.token });
check(
  'GET /pengelola/laporan-keuangan',
  finance.status === 200 &&
    hasKeys(finance.json, ['state', 'months', 'month']) &&
    (finance.json?.state === 'kosong' ||
      hasKeys(finance.json, ['bills', 'payments', 'honor', 'honorPaid', 'institutionShare'])),
  JSON.stringify(finance.json).slice(0, 160),
);

const bills = await request('GET', '/pengelola/tagihan', { token: pengelola?.token });
check(
  'GET /pengelola/tagihan',
  bills.status === 200 &&
    hasKeys(bills.json, ['months', 'month', 'total', 'paid', 'remaining', 'unpaid', 'partial', 'paidOff']),
  JSON.stringify(bills.json).slice(0, 160),
);

const billRow = [
  ...(bills.json?.unpaid ?? []),
  ...(bills.json?.partial ?? []),
  ...(bills.json?.paidOff ?? []),
][0];
if (billRow) {
  const billDetail = await request('GET', `/pengelola/tagihan/${billRow.id}`, {
    token: pengelola?.token,
  });
  check(
    'GET /pengelola/tagihan/:id',
    billDetail.status === 200 &&
      hasKeys(billDetail.json, [
        'id',
        'number',
        'studentName',
        'guardianName',
        'period',
        'dueDate',
        'items',
        'payments',
      ]),
    JSON.stringify(billDetail.json).slice(0, 160),
  );
}

/* ---------- Pengelola · Pengaturan & Riwayat Notifikasi ---------- */

const settings = await request('GET', '/pengelola/pengaturan-notifikasi', {
  token: pengelola?.token,
});
check(
  'GET /pengelola/pengaturan-notifikasi',
  settings.status === 200 &&
    isArray(settings.json) &&
    (settings.json.length === 0 ||
      hasKeys(settings.json[0], [
        'id',
        'group',
        'title',
        'screenTitle',
        'recipient',
        'trigger',
        'activeNote',
        'enabled',
        'channel',
        'timing',
        'template',
        'variables',
        'sample',
        'previewNote',
      ])),
);

const settingId = settings.json?.[0]?.id;
if (settingId) {
  const settingDetail = await request('GET', `/pengelola/pengaturan-notifikasi/${settingId}`, {
    token: pengelola?.token,
  });
  check(
    'GET /pengelola/pengaturan-notifikasi/:id',
    settingDetail.status === 200 &&
      hasKeys(settingDetail.json, ['id', 'group', 'enabled', 'channel', 'template', 'variables']),
  );
}

const logs = await request('GET', '/pengelola/riwayat-notifikasi', { token: pengelola?.token });
check(
  'GET /pengelola/riwayat-notifikasi',
  logs.status === 200 && hasKeys(logs.json, ['failed', 'sent']),
  JSON.stringify(logs.json).slice(0, 160),
);

const logId = logs.json?.failed?.[0]?.id ?? logs.json?.sent?.[0]?.id;
if (logId) {
  const logDetail = await request('GET', `/pengelola/riwayat-notifikasi/${logId}`, {
    token: pengelola?.token,
  });
  check(
    'GET /pengelola/riwayat-notifikasi/:id',
    logDetail.status === 200 &&
      hasKeys(logDetail.json, [
        'id',
        'kind',
        'channel',
        'recipients',
        'sentAt',
        'status',
        'message',
        'attempts',
        'lastAttemptAt',
      ]),
  );
}

/* ---------- Error contract ---------- */

const validation = await request('POST', '/wali/pengajuan-jadwal', {
  token: wali?.token,
  body: {},
});
check(
  'validasi: body kosong -> 422 VALIDATION_ERROR dengan details',
  validation.status === 422 &&
    validation.json?.error?.code === 'VALIDATION_ERROR' &&
    isArray(validation.json?.error?.details),
  JSON.stringify(validation.json),
);

const notFound = await request('GET', '/wali/tagihan/tidak-ada', { token: wali?.token });
check(
  '404 memakai bentuk { error: { code, message } }',
  notFound.status === 404 && notFound.json?.error?.code === 'NOT_FOUND',
);

console.log(`\n📊 Hasil: ${passed} lulus, ${failed} gagal\n`);
process.exit(failed > 0 ? 1 : 0);