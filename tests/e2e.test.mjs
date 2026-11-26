/**
 * Suite e2e PINTARA API (node:test).
 *
 * Prasyarat:
 *   - server berjalan (default http://localhost:4000)
 *   - database demo sudah di-seed (npm run db:seed)
 *
 * Jalankan:
 *   npm test
 *   API_URL=http://localhost:4000 npm test
 *
 * Sebagian kecil pemeriksaan bersifat mutasi ringan (simulasi pembayaran gagal,
 * menandai notifikasi dibaca). Jalankan `npm run db:seed` untuk mengembalikan
 * data demo.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'pintara123';

const state = {
  wali: null,
  tutor: null,
  pengelola: null,
  waliDashboard: null,
  waliSchedule: null,
  waliBills: null,
  waliNotifications: null,
  tutorDashboard: null,
  tutorSchedule: null,
  pengelolaDashboard: null,
  registrations: null,
  matching: null,
  offers: null,
  board: null,
  attendance: null,
  honor: null,
};

async function api(path, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

async function login(identifier) {
  const { status, json } = await api('/auth/login', {
    method: 'POST',
    body: { identifier, password: PASSWORD },
  });
  assert.equal(status, 200, `login ${identifier} gagal: ${JSON.stringify(json)}`);
  assert.equal(typeof json?.token, 'string');
  return json;
}

const hasKeys = (value, keys) => {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  for (const key of keys) {
    assert.ok(key in value, `field "${key}" tidak ada pada ${JSON.stringify(Object.keys(value))}`);
  }
};

function jakartaMonth(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(date));
}

before(async () => {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  assert.ok(
    health && health.ok,
    `Server tidak dapat dihubungi di ${BASE}. Jalankan "npm run build && npm start" terlebih dahulu.`,
  );

  state.wali = await login('sari.wulandari');
  state.tutor = await login('budi.santoso');
  state.pengelola = await login('ila');

  [state.waliDashboard, state.waliSchedule, state.waliBills, state.waliNotifications] =
    await Promise.all([
      api('/wali/dashboard', { token: state.wali.token }).then((r) => r.json),
      api('/wali/jadwal', { token: state.wali.token }).then((r) => r.json),
      api('/wali/tagihan', { token: state.wali.token }).then((r) => r.json),
      api('/wali/notifikasi', { token: state.wali.token }).then((r) => r.json),
    ]);

  [state.tutorDashboard, state.tutorSchedule] = await Promise.all([
    api('/tutor/dashboard', { token: state.tutor.token }).then((r) => r.json),
    api('/tutor/jadwal', { token: state.tutor.token }).then((r) => r.json),
  ]);

  [
    state.pengelolaDashboard,
    state.registrations,
    state.matching,
    state.offers,
    state.board,
    state.attendance,
    state.honor,
  ] = await Promise.all([
    api('/pengelola/dashboard', { token: state.pengelola.token }).then((r) => r.json),
    api('/pengelola/pendaftaran', { token: state.pengelola.token }).then((r) => r.json),
    api('/pengelola/pencocokan', { token: state.pengelola.token }).then((r) => r.json),
    api('/pengelola/penawaran', { token: state.pengelola.token }).then((r) => r.json),
    api('/pengelola/jadwal', { token: state.pengelola.token }).then((r) => r.json),
    api('/pengelola/presensi', { token: state.pengelola.token }).then((r) => r.json),
    api('/pengelola/honor', { token: state.pengelola.token }).then((r) => r.json),
  ]);
});

after(() => {
  // Tidak ada penutupan resource khusus.
});

describe('Health & Auth', () => {
  it('GET /health melaporkan database up', async () => {
    const { status, json } = await api('/health');
    assert.equal(status, 200);
    assert.equal(json.status, 'ok');
    assert.equal(json.database, 'up');
    assert.ok(['up', 'down'].includes(json.redis));
  });

  it('login mengembalikan {id,name,role,username,email,whatsapp,token} untuk tiap peran', () => {
    for (const account of [state.wali, state.tutor, state.pengelola]) {
      hasKeys(account, ['id', 'name', 'role', 'username', 'email', 'whatsapp', 'token']);
    }
    assert.equal(state.wali.role, 'wali');
    assert.equal(state.tutor.role, 'tutor');
    assert.equal(state.pengelola.role, 'pengelola');
  });

  it('login menerima email maupun username', async () => {
    const byEmail = await api('/auth/login', {
      method: 'POST',
      body: { identifier: state.wali.email, password: PASSWORD },
    });
    assert.equal(byEmail.status, 200);
    assert.equal(byEmail.json.username, state.wali.username);
  });

  it('kredensial salah -> 401 invalid_credentials', async () => {
    const { status, json } = await api('/auth/login', {
      method: 'POST',
      body: { identifier: 'sari.wulandari', password: 'salah' },
    });
    assert.equal(status, 401);
    assert.equal(json.error.code, 'invalid_credentials');
  });

  it('GET /auth/me mengembalikan akun yang login', async () => {
    const { status, json } = await api('/auth/me', { token: state.tutor.token });
    assert.equal(status, 200);
    assert.equal(json.username, state.tutor.username);
    assert.equal(json.role, 'tutor');
  });

  it('endpoint terproteksi menolak tanpa token', async () => {
    const { status } = await api('/wali/dashboard');
    assert.equal(status, 401);
  });

  it('role guard menolak peran yang salah', async () => {
    const { status } = await api('/tutor/dashboard', { token: state.wali.token });
    assert.equal(status, 403);
  });
});

describe('Wali', () => {
  it('GET /wali/dashboard', () => {
    hasKeys(state.waliDashboard, [
      'parent',
      'students',
      'activeStudentId',
      'tasks',
      'weekSchedule',
      'history',
      'unreadNotifications',
    ]);
    assert.ok(Array.isArray(state.waliDashboard.students));
    assert.ok(Array.isArray(state.waliDashboard.tasks));
  });

  it('GET /wali/profil dan /wali/akun', async () => {
    const profil = await api('/wali/profil', { token: state.wali.token });
    assert.equal(profil.status, 200);
    hasKeys(profil.json, ['parentName', 'parentPhone']);

    const akun = await api('/wali/akun', { token: state.wali.token });
    assert.equal(akun.status, 200);
    hasKeys(akun.json, ['name', 'initials', 'role', 'students', 'lbbContact', 'appVersion']);
  });

  it('GET /wali/jadwal (mingguan + rutin)', () => {
    hasKeys(state.waliSchedule, [
      'students',
      'activeStudentId',
      'pendingRequests',
      'week',
      'routines',
      'unreadNotifications',
    ]);
    hasKeys(state.waliSchedule.week, ['from', 'to', 'sessions']);
    assert.ok(Array.isArray(state.waliSchedule.routines));
  });

  it('detail rutin via alias kontrak /wali/jadwal/:id sama dengan kanonik', async () => {
    const routine = state.waliSchedule.routines[0];
    assert.ok(routine?.id, 'seed tidak memiliki jadwal rutin');
    const canonical = await api(`/wali/jadwal/rutin/${routine.id}`, { token: state.wali.token });
    const alias = await api(`/wali/jadwal/${routine.id}`, { token: state.wali.token });
    assert.equal(canonical.status, 200);
    assert.equal(alias.status, 200);
    assert.deepEqual(alias.json, canonical.json);
    hasKeys(alias.json, ['id', 'subject', 'weekday', 'startTime', 'tutor', 'nextSession']);
  });

  it('GET /wali/presensi', async () => {
    const { status, json } = await api('/wali/presensi', { token: state.wali.token });
    assert.equal(status, 200);
    hasKeys(json, ['pending', 'history', 'multipleStudents', 'unreadNotifications']);
    assert.ok(Array.isArray(json.pending));
  });

  it('GET /wali/riwayat-les (default dan bulan eksplisit)', async () => {
    const first = await api('/wali/riwayat-les', { token: state.wali.token });
    assert.equal(first.status, 200);
    hasKeys(first.json, ['months', 'month', 'sessions', 'summary']);

    const month = first.json.months[0];
    if (month) {
      const explicit = await api(
        `/wali/riwayat-les?bulan=${jakartaMonth(month)}`,
        { token: state.wali.token },
      );
      assert.equal(explicit.status, 200);
      assert.ok(Array.isArray(explicit.json.sessions));
    }
  });

  it('GET /wali/tagihan dan detail tagihan', async () => {
    hasKeys(state.waliBills, ['priority', 'others', 'unreadNotifications']);
    const bill = state.waliBills.priority ?? state.waliBills.others[0];
    assert.ok(bill?.id, 'seed tidak memiliki tagihan');
    const detail = await api(`/wali/tagihan/${bill.id}`, { token: state.wali.token });
    assert.equal(detail.status, 200);
    hasKeys(detail.json, ['id', 'number', 'studentName', 'period', 'dueDate', 'items', 'total', 'paid']);
    hasKeys(detail.json.items[0] ?? {}, ['subject', 'sessions', 'unitPrice']);
  });

  it('GET /wali/pembayaran', async () => {
    const { status, json } = await api('/wali/pembayaran', { token: state.wali.token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
    if (json[0]) hasKeys(json[0], ['id', 'billId', 'billPeriod', 'amount', 'method', 'status', 'createdAt']);
  });

  it('POST /wali/tagihan/:id/bayar (alias) dengan simulateFailure tidak mengubah tagihan', async () => {
    const bill = state.waliBills.priority ?? state.waliBills.others[0];
    if (!bill) return; // tidak ada tagihan pada seed
    const remaining = bill.total - bill.paid;
    if (remaining <= 0) return; // sudah lunas

    const nominal = Math.min(1000, remaining);
    const result = await api(`/wali/tagihan/${bill.id}/bayar`, {
      method: 'POST',
      token: state.wali.token,
      body: { nominal, simulateFailure: true },
    });
    assert.equal(result.status, 200, JSON.stringify(result.json));
    hasKeys(result.json, ['payment', 'bill']);
    assert.equal(result.json.payment.status, 'kedaluwarsa');
    assert.equal(result.json.bill.paid, bill.paid, 'tagihan tidak boleh berubah saat gagal');
    assert.equal(result.json.payment.amount, nominal);

    const detail = await api(`/wali/pembayaran/${result.json.payment.id}`, {
      token: state.wali.token,
    });
    assert.equal(detail.status, 200);
    assert.equal(detail.json.payment.id, result.json.payment.id);
  });

  it('GET /wali/notifikasi', () => {
    hasKeys(state.waliNotifications, ['unread', 'read']);
    assert.ok(Array.isArray(state.waliNotifications.unread));
    const item = state.waliNotifications.unread[0] ?? state.waliNotifications.read[0];
    if (item) {
      hasKeys(item, ['id', 'kind', 'title', 'body', 'createdAt', 'read', 'to']);
    }
  });

  it('alias notifikasi /:id/read dan /read-all mengembalikan {ok:true}', async () => {
    const item = state.waliNotifications.unread[0] ?? state.waliNotifications.read[0];
    if (!item) return;
    const read = await api(`/wali/notifikasi/${item.id}/read`, {
      method: 'POST',
      token: state.wali.token,
    });
    assert.equal(read.status, 200);
    assert.deepEqual(read.json, { ok: true });

    const all = await api('/wali/notifikasi/read-all', {
      method: 'POST',
      token: state.wali.token,
    });
    assert.equal(all.status, 200);
    assert.deepEqual(all.json, { ok: true });
  });

  it('pendaftaran: defaults, terbaru, dan validasi body', async () => {
    const defaults = await api('/wali/pendaftaran/defaults', { token: state.wali.token });
    assert.equal(defaults.status, 200);
    hasKeys(defaults.json, ['parentName', 'parentPhone']);

    const latest = await api('/wali/pendaftaran/terbaru', { token: state.wali.token });
    assert.equal(latest.status, 200);
    hasKeys(latest.json, ['registration', 'contact']);
    hasKeys(latest.json.contact, ['name', 'whatsapp', 'display']);

    const invalid = await api('/wali/pendaftaran', {
      method: 'POST',
      token: state.wali.token,
      body: {},
    });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.json.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(invalid.json.error.details));
  });
});

describe('Tutor', () => {
  it('GET /tutor/dashboard', () => {
    hasKeys(state.tutorDashboard, ['tutor', 'nextSession', 'tasks', 'upcoming', 'recap']);
    hasKeys(state.tutorDashboard.recap, [
      'month',
      'held',
      'validated',
      'waitingParent',
      'disputed',
    ]);
  });

  it('GET /tutor/akun', async () => {
    const { status, json } = await api('/tutor/akun', { token: state.tutor.token });
    assert.equal(status, 200);
    hasKeys(json, ['name', 'initials', 'role', 'email', 'teaching', 'lbbContact', 'appVersion']);
  });

  it('GET /tutor/presensi', async () => {
    const { status, json } = await api('/tutor/presensi', { token: state.tutor.token });
    assert.equal(status, 200);
    hasKeys(json, ['toFill', 'laterToday', 'filled']);
    assert.ok(Array.isArray(json.toFill));
  });

  it('GET /tutor/presensi/status (default dan bulan eksplisit)', async () => {
    const first = await api('/tutor/presensi/status', { token: state.tutor.token });
    assert.equal(first.status, 200);
    hasKeys(first.json, ['months', 'month', 'total', 'disputed', 'waiting', 'notCollected', 'verified']);

    const month = first.json.months[0];
    if (month) {
      const explicit = await api(
        `/tutor/presensi/status?bulan=${jakartaMonth(month)}`,
        { token: state.tutor.token },
      );
      assert.equal(explicit.status, 200);
    }
  });

  it('detail sesi presensi dan jadwal', async () => {
    const sessionId =
      state.tutorDashboard.upcoming?.[0]?.id ?? state.tutorSchedule.days?.[0]?.sessions?.[0]?.id;
    if (!sessionId) return;

    const presensi = await api(`/tutor/presensi/${sessionId}`, { token: state.tutor.token });
    assert.equal(presensi.status, 200);
    hasKeys(presensi.json, ['id', 'subject', 'student', 'start', 'end', 'record']);

    const jadwal = await api(`/tutor/jadwal/${sessionId}`, { token: state.tutor.token });
    assert.equal(jadwal.status, 200);
    hasKeys(jadwal.json, ['id', 'subject', 'student', 'start', 'end', 'parent']);
  });

  it('GET /tutor/riwayat', async () => {
    const { status, json } = await api('/tutor/riwayat', { token: state.tutor.token });
    assert.equal(status, 200);
    hasKeys(json, ['months', 'month', 'students', 'student', 'sessions', 'summary']);
    hasKeys(json.summary, ['held', 'cancelled', 'studentCount', 'byStudent']);
  });

  it('GET /tutor/jadwal', () => {
    hasKeys(state.tutorSchedule, ['week', 'weeks', 'days', 'freeDays']);
    assert.ok(Array.isArray(state.tutorSchedule.days));
  });

  it('GET /tutor/notifikasi', async () => {
    const { status, json } = await api('/tutor/notifikasi', { token: state.tutor.token });
    assert.equal(status, 200);
    hasKeys(json, ['unread', 'read']);
  });
});

describe('Pengelola', () => {
  it('GET /pengelola/dashboard', () => {
    hasKeys(state.pengelolaDashboard, ['admin', 'today', 'tasks', 'billing', 'unreadNotifications']);
    hasKeys(state.pengelolaDashboard.billing, [
      'month',
      'paidAmount',
      'totalAmount',
      'invoices',
      'dueDate',
    ]);
  });

  it('GET /pengelola/lainnya', async () => {
    const { status, json } = await api('/pengelola/lainnya', { token: state.pengelola.token });
    assert.equal(status, 200);
    hasKeys(json, ['name', 'initials', 'role', 'email', 'tutors', 'students', 'failedNotifications']);
    hasKeys(json.tutors, ['total', 'active']);
  });

  it('GET /pengelola/pendaftaran (daftar + hitungan + detail)', async () => {
    hasKeys(state.registrations, ['counts', 'items']);
    assert.ok(Array.isArray(state.registrations.items));
    if (state.registrations.items[0]) {
      const detail = await api(`/pengelola/pendaftaran/${state.registrations.items[0].id}`, {
        token: state.pengelola.token,
      });
      assert.equal(detail.status, 200);
      hasKeys(detail.json, ['id', 'number', 'student', 'parent', 'needs', 'status']);
      hasKeys(detail.json.student, ['name', 'grade', 'level', 'school', 'address']);
    }
  });

  it('GET /pengelola/pencocokan dan kandidat', async () => {
    assert.ok(Array.isArray(state.matching));
    if (state.matching[0]) {
      const { status, json } = await api(`/pengelola/pencocokan/${state.matching[0].id}`, {
        token: state.pengelola.token,
      });
      assert.equal(status, 200);
      hasKeys(json, ['registration', 'candidates', 'fullMatches']);
      if (json.candidates[0]) {
        hasKeys(json.candidates[0], [
          'tutorId',
          'name',
          'criteria',
          'score',
          'fullMatch',
        ]);
        hasKeys(json.candidates[0].criteria[0], ['label', 'met']);
      }
    }
  });

  it('GET /pengelola/penawaran (unsent/waiting/history) + detail', async () => {
    hasKeys(state.offers, ['unsent', 'waiting', 'history']);
    const offer = state.offers.history[0] ?? state.offers.waiting[0];
    if (offer) {
      const detail = await api(`/pengelola/penawaran/${offer.id}`, {
        token: state.pengelola.token,
      });
      assert.equal(detail.status, 200);
      hasKeys(detail.json, ['id', 'registrationId', 'student', 'tutor', 'status']);
    }
  });

  it('GET /pengelola/penawaran/draf/:registrationId', async () => {
    const unsent = state.offers.unsent[0];
    if (!unsent) return;
    const { status, json } = await api(
      `/pengelola/penawaran/draf/${unsent.registration.id}`,
      { token: state.pengelola.token },
    );
    assert.equal(status, 200);
    hasKeys(json, ['registration', 'tutorName']);
  });

  it('GET /pengelola/jadwal (papan + draf pair)', async () => {
    hasKeys(state.board, ['toSchedule', 'requests', 'active']);
    assert.ok(Array.isArray(state.board.active));
    if (state.board.active[0]) {
      const draft = await api(`/pengelola/jadwal/${state.board.active[0].id}`, {
        token: state.pengelola.token,
      });
      assert.equal(draft.status, 200);
      hasKeys(draft.json, ['student', 'parentName', 'tutor', 'subjects', 'sessions', 'effectiveFrom']);
      hasKeys(draft.json.sessions[0] ?? {}, ['subject', 'day', 'start', 'end']);
    }
  });

  it('GET /pengelola/jadwal/draf/:offerId untuk penawaran diterima', async () => {
    const accepted = state.offers.history.find((offer) => offer.status === 'diterima');
    if (!accepted) return;
    const { status, json } = await api(`/pengelola/jadwal/draf/${accepted.id}`, {
      token: state.pengelola.token,
    });
    assert.equal(status, 200);
    hasKeys(json, ['student', 'parentName', 'tutor', 'sessions', 'effectiveFrom']);
  });

  it('GET /pengelola/presensi (rekap + keberatan)', async () => {
    hasKeys(state.attendance, [
      'months',
      'month',
      'total',
      'final',
      'ready',
      'waiting',
      'disputed',
      'notCollected',
      'objections',
      'readyByTutor',
    ]);
    assert.ok(Array.isArray(state.attendance.objections));
    if (state.attendance.objections[0]) {
      const objection = await api(
        `/pengelola/presensi/${state.attendance.objections[0].id}/keberatan`,
        { token: state.pengelola.token },
      );
      assert.equal(objection.status, 200);
      hasKeys(objection.json, ['id', 'subject', 'student', 'record']);
    }
  });

  it('POST /pengelola/honor/hitung lalu GET /pengelola/honor dan detail honor', async () => {
    const month = jakartaMonth(new Date());
    const calc = await api('/pengelola/honor/hitung', {
      method: 'POST',
      token: state.pengelola.token,
      body: { bulan: month },
    });
    assert.equal(calc.status, 200, JSON.stringify(calc.json));
    hasKeys(calc.json, ['tutors', 'total']);

    const recap = await api(`/pengelola/honor?bulan=${month}`, {
      token: state.pengelola.token,
    });
    assert.equal(recap.status, 200);
    hasKeys(recap.json, ['state', 'months', 'month', 'total']);

    if (recap.json.state === 'belum_dihitung') {
      hasKeys(recap.json, ['final', 'tutorsWithoutRate']);
      return;
    }

    hasKeys(recap.json, [
      'calculatedAt',
      'sessions',
      'paid',
      'unpaid',
      'unpaidHonors',
      'paidHonors',
      'skipped',
    ]);
    hasKeys(recap.json.paid, ['amount', 'tutors']);
    hasKeys(recap.json.unpaid, ['amount', 'tutors']);

    const entry = recap.json.unpaidHonors[0] ?? recap.json.paidHonors[0];
    if (!entry) return;
    hasKeys(entry, ['tutorId', 'name', 'lines', 'sessions', 'total']);
    if (entry.lines[0]) hasKeys(entry.lines[0], ['rate', 'amount', 'subject', 'sessions']);

    const detail = await api(`/pengelola/honor/${month}/${entry.tutorId}`, {
      token: state.pengelola.token,
    });
    assert.equal(detail.status, 200);
    hasKeys(detail.json, ['tutorId', 'lines', 'sessions', 'total', 'month', 'status', 'sessionList']);
  });

  it('GET /pengelola/pengajuan-jadwal/:id untuk pengajuan aktif', async () => {
    const request = state.board.requests[0];
    if (!request) return;
    const { status, json } = await api(`/pengelola/pengajuan-jadwal/${request.id}`, {
      token: state.pengelola.token,
    });
    assert.equal(status, 200);
    hasKeys(json, ['request', 'fromSession', 'toSession', 'conflict']);
    hasKeys(json.request, ['id', 'studentName', 'parentName', 'from', 'to', 'status']);
    hasKeys(json.fromSession, ['subject', 'day', 'start', 'end']);
    hasKeys(json.toSession, ['subject', 'day', 'start', 'end']);
  });

  it('GET /pengelola/notifikasi', async () => {
    const { status, json } = await api('/pengelola/notifikasi', { token: state.pengelola.token });
    assert.equal(status, 200);
    hasKeys(json, ['unread', 'read']);
  });
});

describe('Pengelola · Data Master', () => {
  it('GET /pengelola/tutor (daftar + detail)', async () => {
    const { status, json } = await api('/pengelola/tutor', { token: state.pengelola.token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
    if (!json[0]) return;
    hasKeys(json[0], ['id', 'name', 'subjects', 'levels', 'district', 'rate', 'status']);

    const detail = await api(`/pengelola/tutor/${json[0].id}`, { token: state.pengelola.token });
    assert.equal(detail.status, 200);
    hasKeys(detail.json, [
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
    ]);
  });

  it('POST/PUT /pengelola/tutor lalu ubah status', async () => {
    const stamp = Date.now();
    const body = {
      name: `Tutor Uji ${stamp}`,
      phone: '081200000001',
      email: `tutor.uji.${stamp}@example.com`,
      education: 'S1 Pendidikan',
      subjects: ['Matematika'],
      levels: ['SMP'],
      days: ['Senin'],
      from: '15.00',
      until: '17.00',
      address: 'Jl. Uji No. 1, Bangkalan',
      rate: 55000,
    };
    const created = await api('/pengelola/tutor', {
      method: 'POST',
      token: state.pengelola.token,
      body,
    });
    assert.ok([200, 201].includes(created.status), JSON.stringify(created.json));
    hasKeys(created.json, ['id', 'name', 'subjects', 'rate', 'status']);
    const id = created.json.id;

    const updated = await api(`/pengelola/tutor/${id}`, {
      method: 'PUT',
      token: state.pengelola.token,
      body: { ...body, education: 'S2 Pendidikan', subjects: ['Matematika', 'IPA'], rate: 60000 },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.rate, 60000);
    assert.deepEqual(updated.json.subjects, ['Matematika', 'IPA']);

    const off = await api(`/pengelola/tutor/${id}/status`, {
      method: 'PATCH',
      token: state.pengelola.token,
      body: { status: 'nonaktif' },
    });
    assert.equal(off.status, 200);
    assert.equal(off.json.status, 'nonaktif');

    const on = await api(`/pengelola/tutor/${id}/status`, {
      method: 'PATCH',
      token: state.pengelola.token,
      body: { status: 'aktif' },
    });
    assert.equal(on.status, 200);
    assert.equal(on.json.status, 'aktif');
  });

  it('PATCH status tutor dengan jadwal aktif -> 409 active_schedule', async () => {
    const { json } = await api('/pengelola/tutor', { token: state.pengelola.token });
    const details = await Promise.all(
      json.map((tutor) =>
        api(`/pengelola/tutor/${tutor.id}`, { token: state.pengelola.token }).then((r) => r.json),
      ),
    );
    const busy = details.find((tutor) => tutor.activeSchedules > 0);
    if (!busy) return;
    const { status, json: body } = await api(`/pengelola/tutor/${busy.id}/status`, {
      method: 'PATCH',
      token: state.pengelola.token,
      body: { status: 'nonaktif' },
    });
    assert.equal(status, 409);
    assert.equal(body.error.code, 'active_schedule');
  });

  it('GET /pengelola/siswa (daftar + detail)', async () => {
    const { status, json } = await api('/pengelola/siswa', { token: state.pengelola.token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
    if (!json[0]) return;
    hasKeys(json[0], ['id', 'name', 'grade', 'subjects', 'status', 'tutorNames']);

    const detail = await api(`/pengelola/siswa/${json[0].id}`, { token: state.pengelola.token });
    assert.equal(detail.status, 200);
    hasKeys(detail.json, [
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
    ]);
    hasKeys(detail.json.guardian, ['name', 'phone', 'accountActive', 'linkedStudents']);
  });

  it('PATCH status siswa dengan jadwal aktif -> 409 active_schedule', async () => {
    const { json } = await api('/pengelola/siswa', { token: state.pengelola.token });
    const target = json.find((student) => (student.tutorNames ?? []).length > 0);
    if (!target) return;
    const { status, json: body } = await api(`/pengelola/siswa/${target.id}/status`, {
      method: 'PATCH',
      token: state.pengelola.token,
      body: { status: 'nonaktif' },
    });
    assert.equal(status, 409);
    assert.equal(body.error.code, 'active_schedule');
  });
});

describe('Pengelola · Manajemen Akun', () => {
  it('GET /pengelola/akun + akun/siswa + detail', async () => {
    const { status, json } = await api('/pengelola/akun?peran=wali', {
      token: state.pengelola.token,
    });
    assert.equal(status, 200);
    hasKeys(json, ['counts', 'items']);
    hasKeys(json.counts, ['wali', 'tutor', 'pengelola']);
    if (json.items[0]) {
      hasKeys(json.items[0], ['id', 'role', 'name', 'email', 'status', 'students']);
      const detail = await api(`/pengelola/akun/${json.items[0].id}`, {
        token: state.pengelola.token,
      });
      assert.equal(detail.status, 200);
      hasKeys(detail.json, [
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
      ]);
    }

    const linkable = await api('/pengelola/akun/siswa', { token: state.pengelola.token });
    assert.equal(linkable.status, 200);
    assert.ok(Array.isArray(linkable.json));
    if (linkable.json[0]) hasKeys(linkable.json[0], ['id', 'name', 'grade', 'status']);
  });

  it('POST /pengelola/akun -> PUT -> reset-password -> status', async () => {
    const stamp = Date.now();
    const base = {
      role: 'wali',
      name: 'Wali Uji',
      email: `wali.uji.${stamp}@example.com`,
      username: `wali.uji.${stamp}`,
      phone: '081200000003',
    };
    const created = await api('/pengelola/akun', {
      method: 'POST',
      token: state.pengelola.token,
      body: base,
    });
    assert.ok([200, 201].includes(created.status), JSON.stringify(created.json));
    hasKeys(created.json, [
      'id',
      'role',
      'name',
      'email',
      'username',
      'status',
      'studentIds',
      'students',
    ]);
    assert.ok(!('password' in created.json), 'password tidak boleh dikembalikan');
    const id = created.json.id;

    const updated = await api(`/pengelola/akun/${id}`, {
      method: 'PUT',
      token: state.pengelola.token,
      body: { ...base, name: 'Wali Uji Dua' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.name, 'Wali Uji Dua');

    const reset = await api(`/pengelola/akun/${id}/reset-password`, {
      method: 'POST',
      token: state.pengelola.token,
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.json.email, base.email);
    assert.ok(!('password' in reset.json), 'password tidak boleh dikembalikan');

    const off = await api(`/pengelola/akun/${id}/status`, {
      method: 'PATCH',
      token: state.pengelola.token,
      body: { status: 'nonaktif' },
    });
    assert.equal(off.status, 200);
    assert.equal(off.json.status, 'nonaktif');

    const on = await api(`/pengelola/akun/${id}/status`, {
      method: 'PATCH',
      token: state.pengelola.token,
      body: { status: 'aktif' },
    });
    assert.equal(on.status, 200);
    assert.equal(on.json.status, 'aktif');
  });

  it('email duplikat -> 409 duplicate_field', async () => {
    const { json } = await api('/pengelola/akun?peran=wali', { token: state.pengelola.token });
    const existing = json.items[0];
    if (!existing) return;
    const { status, json: body } = await api('/pengelola/akun', {
      method: 'POST',
      token: state.pengelola.token,
      body: {
        role: 'wali',
        name: 'Duplikat',
        email: existing.email,
        username: `duplikat.${Date.now()}`,
      },
    });
    assert.equal(status, 409);
    assert.equal(body.error.code, 'duplicate_field');
    assert.equal(body.error.details.field, 'email');
  });

  it('reset-password akun tak ada -> 404', async () => {
    const { status, json } = await api('/pengelola/akun/tidak-ada/reset-password', {
      method: 'POST',
      token: state.pengelola.token,
    });
    assert.equal(status, 404);
    assert.equal(json.error.code, 'NOT_FOUND');
  });

  it('PUT /pengelola/akun/:id/siswa mengembalikan detail akun', async () => {
    const { json } = await api('/pengelola/akun?peran=wali', { token: state.pengelola.token });
    const wali = json.items.find((item) => (item.students ?? 0) > 0) ?? json.items[0];
    if (!wali) return;
    const { status, json: body } = await api(`/pengelola/akun/${wali.id}/siswa`, {
      method: 'PUT',
      token: state.pengelola.token,
      body: { siswaIds: [] },
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.studentIds));
  });
});

describe('Pengelola · Rekap & Laporan Keuangan', () => {
  it('GET /pengelola/riwayat-les', async () => {
    const { status, json } = await api('/pengelola/riwayat-les', {
      token: state.pengelola.token,
    });
    assert.equal(status, 200);
    hasKeys(json, [
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
    ]);
    assert.ok(Array.isArray(json.sessions));
    if (json.sessions[0]) {
      hasKeys(json.sessions[0], [
        'id',
        'date',
        'subject',
        'tutorId',
        'tutorName',
        'studentId',
        'studentName',
        'status',
      ]);
    }
  });

  it('GET /pengelola/laporan-keuangan + tagihan + detail', async () => {
    const finance = await api('/pengelola/laporan-keuangan', { token: state.pengelola.token });
    assert.equal(finance.status, 200);
    hasKeys(finance.json, ['state', 'months', 'month']);
    if (finance.json.state !== 'kosong') {
      hasKeys(finance.json, ['bills', 'payments', 'honor', 'honorPaid', 'institutionShare']);
      hasKeys(finance.json.bills, ['total', 'count', 'lunas', 'sebagian', 'belum']);
    }

    const bills = await api('/pengelola/tagihan', { token: state.pengelola.token });
    assert.equal(bills.status, 200);
    hasKeys(bills.json, [
      'months',
      'month',
      'total',
      'paid',
      'remaining',
      'unpaid',
      'partial',
      'paidOff',
    ]);
    const row = [...bills.json.unpaid, ...bills.json.partial, ...bills.json.paidOff][0];
    if (!row) return;
    hasKeys(row, ['id', 'studentName', 'sessions', 'dueDate', 'total', 'remaining', 'status']);

    const detail = await api(`/pengelola/tagihan/${row.id}`, { token: state.pengelola.token });
    assert.equal(detail.status, 200);
    hasKeys(detail.json, [
      'id',
      'number',
      'studentName',
      'guardianName',
      'period',
      'dueDate',
      'items',
      'payments',
    ]);
  });

  it('POST /pengelola/laporan-keuangan/unduh PDF & XLSX', async () => {
    const month = `${jakartaMonth(new Date())}-01`;
    for (const [type, format, ext] of [
      ['lengkap', 'pdf', '.pdf'],
      ['tagihan', 'xlsx', '.xlsx'],
    ]) {
      const { status, json } = await api('/pengelola/laporan-keuangan/unduh', {
        method: 'POST',
        token: state.pengelola.token,
        body: { month, type, format },
      });
      assert.equal(status, 200, JSON.stringify(json));
      hasKeys(json, ['name', 'size', 'url']);
      assert.ok(json.size > 0, 'berkas laporan kosong');
      assert.ok(json.name.endsWith(ext), `nama berkas ${json.name} bukan ${ext}`);
      assert.ok(typeof json.url === 'string' && json.url.length > 0);
    }
  });

  it('POST /pengelola/tagihan/:id/pembayaran (validasi + catat)', async () => {
    const bills = await api('/pengelola/tagihan', { token: state.pengelola.token });
    const row = [...bills.json.unpaid, ...bills.json.partial].find((bill) => bill.remaining > 2000);
    if (!row) return;

    const invalid = await api(`/pengelola/tagihan/${row.id}/pembayaran`, {
      method: 'POST',
      token: state.pengelola.token,
      body: {
        amount: row.remaining + 1000,
        paidAt: new Date().toISOString(),
        method: 'Tunai di LBB',
      },
    });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.json.error.code, 'VALIDATION_ERROR');

    const paid = await api(`/pengelola/tagihan/${row.id}/pembayaran`, {
      method: 'POST',
      token: state.pengelola.token,
      body: {
        amount: 1000,
        paidAt: new Date().toISOString(),
        method: 'Tunai di LBB',
        proof: { name: 'bukti.jpg', size: 120000 },
      },
    });
    assert.equal(paid.status, 200, JSON.stringify(paid.json));
    hasKeys(paid.json, ['id', 'payments']);
    assert.ok(
      paid.json.payments.some((payment) => payment.manual),
      'pembayaran manual tidak tercatat',
    );
  });
});

describe('Pengelola · Pengaturan & Riwayat Notifikasi', () => {
  it('GET /pengelola/pengaturan-notifikasi + detail', async () => {
    const { status, json } = await api('/pengelola/pengaturan-notifikasi', {
      token: state.pengelola.token,
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
    if (!json[0]) return;
    hasKeys(json[0], [
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
    ]);

    const detail = await api(`/pengelola/pengaturan-notifikasi/${json[0].id}`, {
      token: state.pengelola.token,
    });
    assert.equal(detail.status, 200);
    hasKeys(detail.json, ['id', 'enabled', 'channel', 'timing', 'template', 'variables']);
  });

  it('PUT /pengelola/pengaturan-notifikasi/:id valid + variabel tak dikenal', async () => {
    const list = await api('/pengelola/pengaturan-notifikasi', { token: state.pengelola.token });
    const setting = list.json[0];
    if (!setting) return;

    const bad = await api(`/pengelola/pengaturan-notifikasi/${setting.id}`, {
      method: 'PUT',
      token: state.pengelola.token,
      body: { template: 'Halo {variabel_tidak_ada}' },
    });
    assert.equal(bad.status, 422);
    assert.equal(bad.json.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(bad.json.error.details.variables));

    const ok = await api(`/pengelola/pengaturan-notifikasi/${setting.id}`, {
      method: 'PUT',
      token: state.pengelola.token,
      body: { enabled: setting.enabled, channel: setting.channel, template: setting.template },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.template, setting.template);
  });

  it('GET /pengelola/riwayat-notifikasi + detail', async () => {
    const { status, json } = await api('/pengelola/riwayat-notifikasi', {
      token: state.pengelola.token,
    });
    assert.equal(status, 200);
    hasKeys(json, ['failed', 'sent']);
    assert.ok(Array.isArray(json.failed) && Array.isArray(json.sent));
    const log = json.failed[0] ?? json.sent[0];
    if (!log) return;
    hasKeys(log, [
      'id',
      'kind',
      'channel',
      'recipients',
      'sentAt',
      'status',
      'message',
      'attempts',
      'lastAttemptAt',
    ]);

    const detail = await api(`/pengelola/riwayat-notifikasi/${log.id}`, {
      token: state.pengelola.token,
    });
    assert.equal(detail.status, 200);
    hasKeys(detail.json, ['id', 'kind', 'status', 'message']);
  });

  it('POST /pengelola/riwayat-notifikasi/:id/kirim-ulang', async () => {
    const { json } = await api('/pengelola/riwayat-notifikasi', { token: state.pengelola.token });
    const failed = json.failed[0];
    if (!failed) return;
    const { status, json: body } = await api(
      `/pengelola/riwayat-notifikasi/${failed.id}/kirim-ulang`,
      { method: 'POST', token: state.pengelola.token },
    );
    if (failed.permanent) {
      assert.equal(status, 409);
      assert.equal(body.error.code, 'resend_failed');
    } else {
      assert.equal(status, 200);
      assert.equal(body.status, 'terkirim');
      assert.ok(body.resentAt);
    }
  });

  it('POST /pengelola/riwayat-notifikasi/kirim-ulang (semua gagal)', async () => {
    const { status, json } = await api('/pengelola/riwayat-notifikasi/kirim-ulang', {
      method: 'POST',
      token: state.pengelola.token,
      body: { periode: 'bulan-ini' },
    });
    assert.equal(status, 200);
    hasKeys(json, ['sent', 'stillFailed']);
    assert.ok(Array.isArray(json.sent));
    assert.equal(typeof json.stillFailed, 'number');
  });
});

describe('Kontrak error & validasi', () => {
  it('validasi DTO mengembalikan detail per field', async () => {
    const { status, json } = await api('/wali/pengajuan-jadwal', {
      method: 'POST',
      token: state.wali.token,
      body: {},
    });
    assert.equal(status, 422);
    assert.equal(json.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(json.error.details));
    assert.ok(json.error.details.every((detail) => 'field' in detail && 'message' in detail));
  });

  it('data tidak ditemukan -> 404 NOT_FOUND', async () => {
    const { status, json } = await api('/wali/tagihan/tidak-ada', {
      token: state.wali.token,
    });
    assert.equal(status, 404);
    assert.equal(json.error.code, 'NOT_FOUND');
    assert.equal(typeof json.error.message, 'string');
  });

  it('akses lintas peran -> 403', async () => {
    const { status } = await api('/pengelola/dashboard', { token: state.tutor.token });
    assert.equal(status, 403);
  });
});