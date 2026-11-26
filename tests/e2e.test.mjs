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