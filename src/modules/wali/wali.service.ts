import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AccessService } from '../shared/access.service';
import { NotificationsService } from '../shared/notifications.service';
import { SettingsService } from '../shared/settings.service';
import {
  serializeAttendanceSession,
  serializeBill,
  serializeChangeRequest,
  serializePayment,
  serializeRegistrationForWali,
} from '../shared/serializers';
import { ApiException } from '../../common/errors';
import {
  addDays,
  addMinutesToTime,
  dayIndex,
  dayName,
  initials,
  monthEnd,
  monthStart,
  nextDateForDay,
  timeToMinutes,
} from '../../common/utils';
import {
  ObjectionDto,
  PayBillDto,
  PendaftaranDto,
  ReviewDto,
  SubmitChangeDto,
} from './wali.dto';

@Injectable()
export class WaliService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  private lessonInclude = {
    attendance: true,
    pair: {
      include: {
        student: { include: { parent: true } },
        tutor: { include: { user: true } },
        sessions: true,
      },
    },
  } as const;

  async dashboard(userId: string, studentId?: string) {
    const students = await this.access.waliStudents(userId);
    const student = await this.access.waliStudent(userId, studentId);
    const now = new Date();
    const weekEnd = addDays(now, 7);

    const lessons = await this.prisma.lessonSession.findMany({
      where: { pair: { studentId: student.id, status: 'aktif' } },
      include: this.lessonInclude,
      orderBy: { start: 'asc' },
    });
    const bills = await this.prisma.bill.findMany({
      where: { studentId: student.id, status: { not: 'lunas' } },
      orderBy: { dueDate: 'asc' },
      include: { student: true },
    });
    const pending = lessons.filter(
      (lesson) =>
        lesson.start <= now &&
        lesson.attendance?.validation === 'belum_divalidasi' &&
        !lesson.attendance?.cancelReason,
    );
    const nextSession = lessons.find((lesson) => lesson.start > now) ?? null;
    const weekSchedule = lessons.filter(
      (lesson) => lesson.start >= now && lesson.start <= weekEnd,
    );
    const history = lessons
      .filter((lesson) => lesson.start < now && lesson.attendance)
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .slice(0, 5);
    const unread = await this.notifications.unreadCount(userId);

    const tasks: any[] = [];
    if (pending.length) {
      const first = pending[0];
      tasks.push({
        id: 'validasi',
        icon: 'clipboard',
        title: `Validasi ${pending.length} sesi les`,
        description: `${first.subject} ${first.start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`,
        to: '/wali/absensi',
      });
    }
    if (bills.length) {
      tasks.push({
        id: 'tagihan',
        icon: 'wallet',
        title: 'Bayar tagihan',
        description: `${bills.length} tagihan · ${bills.filter((bill) => bill.dueDate < now).length} lewat jatuh tempo`,
        amount: bills.reduce(
          (sum, bill) => sum + Math.max(0, bill.total - bill.paid),
          0,
        ),
        to: '/wali/tagihan',
      });
    }

    const nextTutor = nextSession?.pair.tutor;
    const nextTutorName = nextTutor?.user.name ?? '';
    return {
      parent: { name: (await this.prisma.user.findUnique({ where: { id: userId } }))?.name ?? '' },
      students: students.map((item) => ({
        id: item.id,
        name: item.name,
        initials: initials(item.name),
        grade: `Kelas ${item.grade}`,
      })),
      activeStudentId: student.id,
      nextSession: nextSession
        ? {
            id: nextSession.id,
            subject: nextSession.subject,
            start: nextSession.start,
            end: nextSession.end,
            tutor: {
              name: nextTutorName,
              initials: initials(nextTutorName),
              specialty: `Tutor ${nextSession.pair.tutor.subjects.join(' & ')}`,
            },
          }
        : null,
      tasks,
      weekSchedule: weekSchedule.map((lesson) => ({
        id: lesson.id,
        subject: lesson.subject,
        start: lesson.start,
        end: lesson.end,
        tutorName: lesson.pair.tutor.user.name,
      })),
      history: history.map((lesson) => ({
        id: lesson.id,
        subject: lesson.subject,
        date: lesson.start,
        topic: lesson.attendance?.topic ?? '',
        status: lesson.attendance?.validation ?? 'belum_divalidasi',
      })),
      unreadNotifications: unread,
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return {
      parentName: user?.name ?? '',
      parentPhone: user?.whatsapp ?? '',
    };
  }

  async account(userId: string) {
    const [user, students, contact, version] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.student.findMany({
        where: { parentId: userId },
        include: { pairs: { include: { sessions: true } } },
      }),
      this.settings.lbbContact(),
      this.settings.appVersion(),
    ]);
    return {
      name: user?.name ?? '',
      initials: initials(user?.name ?? ''),
      role: 'Wali Murid',
      email: user?.email ?? '',
      whatsapp: user?.whatsapp ?? '',
      username: user?.username ?? '',
      students: students.map((student) => ({
        id: student.id,
        name: student.name,
        grade: `Kelas ${student.grade} ${student.level}`,
        subjects: [
          ...new Set(student.pairs.flatMap((pair) => pair.subjects)),
        ],
      })),
      lbbContact: contact,
      appVersion: version,
    };
  }

  async registrationDefaults(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return {
      parentName: user?.name ?? '',
      parentPhone: user?.whatsapp ?? '',
    };
  }

  async submitRegistration(userId: string, dto: PendaftaranDto) {
    const active = await this.prisma.registration.findFirst({
      where: {
        parentId: userId,
        status: { not: 'ditolak' },
        studentName: { equals: dto.studentName.trim(), mode: 'insensitive' },
      },
      orderBy: { submittedAt: 'desc' },
    });
    if (active) {
      throw ApiException.conflict(
        'already_registered',
        'Siswa sudah memiliki pendaftaran aktif',
        { registrationId: active.id },
      );
    }

    const [grade, level] = parseGrade(dto.grade);
    let student = await this.prisma.student.findFirst({
      where: {
        parentId: userId,
        name: { equals: dto.studentName.trim(), mode: 'insensitive' },
      },
    });
    if (student) {
      student = await this.prisma.student.update({
        where: { id: student.id },
        data: {
          grade,
          level,
          school: dto.school,
          address: dto.address,
        },
      });
    } else {
      student = await this.prisma.student.create({
        data: {
          parentId: userId,
          name: dto.studentName.trim(),
          grade,
          level,
          school: dto.school,
          address: dto.address,
        },
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const count = await this.prisma.registration.count();
    const now = new Date();
    const registration = await this.prisma.registration.create({
      data: {
        number: `REG-${now.getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        parentId: userId,
        studentId: student.id,
        studentName: dto.studentName.trim(),
        grade,
        level,
        school: dto.school,
        address: dto.address,
        parentName: dto.parentName,
        parentSalutation: guessSalutation(dto.parentName),
        parentWhatsapp: dto.parentPhone,
        parentEmail: user?.email,
        subjects: dto.subjects,
        perWeek: Number(dto.frequency) || 1,
        days: dto.days,
        startTime: dto.startTime,
        notes: dto.notes?.trim() || null,
        status: 'menunggu_verifikasi',
      },
    });

    await this.notifications.notifyRole('pengelola', {
      kind: 'les',
      title: 'Pendaftaran baru menunggu verifikasi',
      body: `${registration.studentName} · ${registration.number}`,
      to: `/pengelola/pendaftaran/${registration.id}`,
    });

    return {
      id: registration.id,
      registrationNumber: registration.number,
      submittedAt: registration.submittedAt,
      studentName: registration.studentName,
    };
  }

  async registrationStatus(userId: string, id?: string) {
    const registration = await this.prisma.registration.findFirst({
      where: { parentId: userId, ...(id ? { id } : {}) },
      orderBy: { submittedAt: 'desc' },
      include: {
        matchedTutor: { include: { user: true } },
        pair: {
          include: {
            lessons: {
              where: { start: { gt: new Date() } },
              orderBy: { start: 'asc' },
              take: 1,
            },
          },
        },
      },
    });
    const contact = await this.settings.lbbContact();
    return {
      registration: registration
        ? serializeRegistrationForWali(registration, contact)
        : null,
      contact,
    };
  }

  async schedule(userId: string, studentId?: string) {
    const students = await this.access.waliStudents(userId);
    const student = await this.access.waliStudent(userId, studentId);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = addDays(from, 7);

    const [pairs, requests, lessons, unread] = await Promise.all([
      this.prisma.pair.findMany({
        where: { studentId: student.id, status: 'aktif' },
        include: {
          sessions: true,
          tutor: { include: { user: true } },
          student: { include: { parent: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.scheduleChangeRequest.findMany({
        where: {
          studentId: student.id,
          status: { in: ['ditinjau_pengelola', 'konfirmasi_tutor'] },
        },
        include: { tutor: { include: { user: true } }, student: { include: { parent: true } } },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.lessonSession.findMany({
        where: {
          pair: { studentId: student.id, status: 'aktif' },
          start: { gte: now, lt: to },
        },
        include: this.lessonInclude,
        orderBy: { start: 'asc' },
      }),
      this.notifications.unreadCount(userId),
    ]);

    return {
      students: students.map((item) => ({
        id: item.id,
        name: item.name,
        initials: initials(item.name),
        grade: `Kelas ${item.grade}`,
      })),
      activeStudentId: student.id,
      pendingRequests: requests.map(serializeChangeRequest),
      week: {
        from,
        to,
        sessions: lessons.map((lesson) => ({
          id: lesson.id,
          routineId: findRoutineId(lesson, pairs),
          subject: lesson.subject,
          start: lesson.start,
          end: lesson.end,
          tutorName: lesson.pair.tutor.user.name,
        })),
      },
      routines: pairs.flatMap((pair) =>
        pair.sessions.map((session) => ({
          id: session.id,
          studentId: pair.studentId,
          subject: session.subject,
          weekday: session.dayOfWeek,
          startTime: session.startTime,
          durationMinutes:
            timeToMinutes(session.endTime) - timeToMinutes(session.startTime),
          tutor: {
            name: pair.tutor.user.name,
            shortName: pair.tutor.shortName,
          },
          location: pair.student.address ?? '',
          since: pair.effectiveFrom,
        })),
      ),
      unreadNotifications: unread,
    };
  }

  async routine(user: any, id: string) {
    const pairSession = await this.prisma.pairSession.findUnique({
      where: { id },
      include: {
        pair: {
          include: {
            student: { include: { parent: true } },
            tutor: { include: { user: true } },
            sessions: true,
            changeRequests: {
              where: { status: { in: ['ditinjau_pengelola', 'konfirmasi_tutor'] } },
              orderBy: { submittedAt: 'desc' },
            },
          },
        },
      },
    });
    if (!pairSession) throw ApiException.notFound('Jadwal tidak ditemukan');
    if (
      user.role === 'wali' &&
      pairSession.pair.student.parentId !== user.id
    ) {
      throw ApiException.forbidden('Anda tidak memiliki akses ke jadwal ini');
    }
    const next = nextSessionFor(pairSession.dayOfWeek, pairSession.startTime);
    return {
      id: pairSession.id,
      studentId: pairSession.pair.studentId,
      subject: pairSession.subject,
      weekday: pairSession.dayOfWeek,
      startTime: pairSession.startTime,
      durationMinutes:
        timeToMinutes(pairSession.endTime) -
        timeToMinutes(pairSession.startTime),
      tutor: {
        name: pairSession.pair.tutor.user.name,
        shortName: pairSession.pair.tutor.shortName,
      },
      location: pairSession.pair.student.address ?? '',
      since: pairSession.pair.effectiveFrom,
      studentName: pairSession.pair.student.name,
      nextSession: next,
      pendingRequest: pairSession.pair.changeRequests[0]
        ? serializeChangeRequest(pairSession.pair.changeRequests[0])
        : null,
    };
  }

  async submitChange(user: any, dto: SubmitChangeDto) {
    const pairSession = await this.prisma.pairSession.findUnique({
      where: { id: dto.routineId },
      include: {
        pair: {
          include: {
            student: { include: { parent: true } },
            tutor: { include: { user: true } },
          },
        },
      },
    });
    if (!pairSession) throw ApiException.notFound('Jadwal tidak ditemukan');
    if (pairSession.pair.student.parentId !== user.id) {
      throw ApiException.forbidden('Anda tidak memiliki akses ke jadwal ini');
    }
    const toWeekday = dayIndex(dto.day);
    const next = nextSessionFor(pairSession.dayOfWeek, pairSession.startTime);
    const request = await this.prisma.scheduleChangeRequest.create({
      data: {
        pairId: pairSession.pairId,
        routineId: pairSession.id,
        studentId: pairSession.pair.studentId,
        tutorId: pairSession.pair.tutorId,
        subject: pairSession.subject,
        durationMinutes:
          timeToMinutes(pairSession.endTime) -
          timeToMinutes(pairSession.startTime),
        fromWeekday: pairSession.dayOfWeek,
        fromStartTime: pairSession.startTime,
        toWeekday,
        toStartTime: dto.startTime,
        scope: dto.scope,
        effectiveDate: dto.scope === 'sekali' ? next : addDays(next, 7),
        reason: dto.reason.trim(),
      },
      include: {
        tutor: { include: { user: true } },
        student: { include: { parent: true } },
      },
    });
    await this.notifications.notifyRole('pengelola', {
      kind: 'jadwal',
      title: 'Pengajuan perubahan jadwal',
      body: `${request.student.name} · ${dayName(request.fromWeekday)} → ${dayName(request.toWeekday)} ${request.toStartTime}`,
      to: `/pengelola/les/pengajuan/${request.id}`,
    });
    return serializeChangeRequest(request);
  }

  async changeRequest(user: any, id: string) {
    const request = await this.prisma.scheduleChangeRequest.findUnique({
      where: { id },
      include: {
        tutor: { include: { user: true } },
        student: { include: { parent: true } },
        pair: { include: { sessions: true } },
      },
    });
    if (!request) throw ApiException.notFound('Pengajuan tidak ditemukan');
    if (
      user.role === 'wali' &&
      request.student.parentId !== user.id
    ) {
      throw ApiException.forbidden('Anda tidak memiliki akses ke pengajuan ini');
    }
    return serializeChangeRequest(request);
  }

  async attendance(userId: string, studentId?: string) {
    const student = studentId
      ? await this.access.waliStudent(userId, studentId)
      : null;
    const now = new Date();
    const lessons = await this.prisma.lessonSession.findMany({
      where: {
        pair: {
          student: student
            ? { id: student.id }
            : { parentId: userId },
        },
        start: { lte: now },
      },
      include: this.lessonInclude,
      orderBy: { start: 'desc' },
    });
    const students = await this.access.waliStudents(userId);
    const held = lessons.filter((lesson) => !lesson.attendance?.cancelReason);
    const pending = held
      .filter((lesson) => lesson.attendance?.validation === 'belum_divalidasi')
      .sort((a, b) => b.start.getTime() - a.start.getTime());
    const history = held
      .filter(
        (lesson) =>
          lesson.attendance &&
          lesson.attendance.validation !== 'belum_divalidasi',
      )
      .sort((a, b) => b.start.getTime() - a.start.getTime());
    return {
      pending: pending.map(serializeAttendanceSession),
      history: history.map(serializeAttendanceSession),
      multipleStudents: students.length > 1,
      unreadNotifications: await this.notifications.unreadCount(userId),
    };
  }

  async session(user: any, id: string) {
    const session = await this.access.sessionForUser(user, id);
    return serializeAttendanceSession(session);
  }

  async approveSession(user: any, id: string) {
    const session = await this.access.sessionForUser(user, id);
    if (!session.attendance) {
      throw ApiException.badRequest('Presensi belum diisi tutor');
    }
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: session.attendance.id },
      data: { validation: 'sudah_divalidasi', validatedAt: new Date() },
    });
    await this.notifications.create(session.pair.tutor.userId, {
      kind: 'validasi',
      title: 'Presensi divalidasi wali',
      body: `${session.subject} · ${session.pair.student.name}`,
      to: `/tutor/presensi/${session.id}`,
    });
    return serializeAttendanceSession({ ...session, attendance: updated });
  }

  async objection(user: any, id: string, dto: ObjectionDto) {
    const session = await this.access.sessionForUser(user, id);
    if (!session.attendance) {
      throw ApiException.badRequest('Presensi belum diisi tutor');
    }
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: session.attendance.id },
      data: {
        validation: 'keberatan',
        objectionReason: dto.reason.trim(),
        objectionAt: new Date(),
      },
    });
    await this.notifications.create(session.pair.tutor.userId, {
      kind: 'validasi',
      title: 'Presensi diajukan keberatan',
      body: `${session.subject} · ${session.pair.student.name}`,
      to: `/tutor/presensi/${session.id}`,
    });
    await this.notifications.notifyRole('pengelola', {
      kind: 'validasi',
      title: 'Keberatan presensi baru',
      body: `${session.pair.student.name} · ${session.subject}`,
      to: `/pengelola/les/keberatan/${session.id}`,
    });
    return serializeAttendanceSession({ ...session, attendance: updated });
  }

  async reviewSession(user: any, id: string, dto: ReviewDto) {
    const session = await this.access.sessionForUser(user, id);
    if (!session.attendance) {
      throw ApiException.badRequest('Presensi belum diisi tutor');
    }
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: session.attendance.id },
      data: {
        reviewRating: dto.rating,
        reviewComment: dto.comment?.trim() || null,
        reviewSubmittedAt: new Date(),
      },
    });
    return serializeAttendanceSession({ ...session, attendance: updated });
  }

  async lessonHistory(userId: string, studentId?: string, month?: string) {
    const student = await this.access.waliStudent(userId, studentId);
    const students = await this.access.waliStudents(userId);
    const now = new Date();
    const active = month ? monthStart(new Date(month)) : monthStart(now);
    const end = monthEnd(active);
    const all = await this.prisma.lessonSession.findMany({
      where: { pair: { studentId: student.id } },
      include: this.lessonInclude,
      orderBy: { start: 'desc' },
    });
    const months = [...new Set(all.map((lesson) => monthStart(lesson.start).getTime()))]
      .sort((a, b) => b - a)
      .map((time) => new Date(time));
    if (!months.some((item) => item.getTime() === monthStart(now).getTime())) {
      months.unshift(monthStart(now));
    }
    const inMonth = all.filter(
      (lesson) => lesson.start >= active && lesson.start <= end,
    );
    const held = inMonth.filter(
      (lesson) => lesson.attendance?.held && !lesson.attendance.cancelReason,
    );
    const cancelled = inMonth.filter(
      (lesson) => lesson.attendance && !lesson.attendance.held,
    );
    const upcoming = inMonth.filter(
      (lesson) => lesson.start > now && !lesson.attendance,
    );
    const bySubject = new Map<string, number>();
    held.forEach((lesson) =>
      bySubject.set(lesson.subject, (bySubject.get(lesson.subject) ?? 0) + 1),
    );
    return {
      students: students.map((item) => ({ id: item.id, name: item.name })),
      studentId: student.id,
      months,
      month: active,
      sessions: inMonth.map(serializeAttendanceSession),
      summary: {
        held: held.length,
        cancelled: cancelled.length,
        upcoming: active.getTime() === monthStart(now).getTime() ? upcoming.length : 0,
        bySubject: [...bySubject]
          .map(([subject, count]) => ({ subject, count }))
          .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject)),
      },
    };
  }

  async bills(userId: string) {
    const bills = await this.prisma.bill.findMany({
      where: {
        student: { parentId: userId },
        status: { not: 'lunas' },
      },
      include: { student: true, items: true },
      orderBy: { dueDate: 'asc' },
    });
    const unread = await this.notifications.unreadCount(userId);
    return {
      priority: bills[0] ? serializeBill(bills[0]) : null,
      others: bills.slice(1).map(serializeBill),
      unreadNotifications: unread,
    };
  }

  async bill(userId: string, id: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id, student: { parentId: userId } },
      include: { student: true, items: true, payments: true },
    });
    if (!bill) throw ApiException.notFound('Tagihan tidak ditemukan');
    return serializeBill(bill);
  }

  async createPayment(userId: string, billId: string, dto: PayBillDto) {
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, student: { parentId: userId } },
      include: { student: true, items: true },
    });
    if (!bill) throw ApiException.notFound('Tagihan tidak ditemukan');
    const remaining = Math.max(0, bill.total - bill.paid);
    if (dto.nominal <= 0 || dto.nominal > remaining) {
      throw ApiException.badRequest('Nominal pembayaran tidak valid.');
    }
    const status = dto.simulateFailure ? 'kedaluwarsa' : 'berhasil';
    const method =
      dto.nominal === remaining ? 'QRIS' : 'Virtual Account BCA';
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.paymentTransaction.count();
    const externalId = `TRX-${ymd}-${String(8841 + count).padStart(4, '0')}`;
    const payment = await this.prisma.paymentTransaction.create({
      data: {
        billId,
        billPeriod: bill.period,
        amount: dto.nominal,
        method,
        status,
        externalId,
        paidAt: status === 'berhasil' ? now : null,
      },
    });
    if (status === 'berhasil') {
      const paid = bill.paid + dto.nominal;
      await this.prisma.bill.update({
        where: { id: bill.id },
        data: {
          paid,
          status: paid >= bill.total ? 'lunas' : 'sebagian',
        },
      });
      await this.notifications.create(userId, {
        kind: 'pembayaran',
        title: 'Pembayaran berhasil',
        body: `Tagihan ${bill.period.toLocaleDateString('id-ID', { month: 'long' })} Rp${dto.nominal.toLocaleString('id-ID')}`,
        to: '/wali/tagihan?tab=riwayat',
      });
    }
    const refreshed = await this.prisma.bill.findUnique({
      where: { id: bill.id },
      include: { student: true, items: true },
    });
    return {
      payment: serializePayment(payment),
      bill: serializeBill(refreshed),
    };
  }

  async payments(userId: string) {
    const payments = await this.prisma.paymentTransaction.findMany({
      where: { bill: { student: { parentId: userId } } },
      include: { bill: { include: { student: true, items: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map(serializePayment);
  }

  async paymentResult(userId: string, trxId: string) {
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: {
        OR: [{ id: trxId }, { externalId: trxId }],
        bill: { student: { parentId: userId } },
      },
      include: { bill: { include: { student: true, items: true } } },
    });
    if (!payment) throw ApiException.notFound('Pembayaran tidak ditemukan');
    return {
      payment: serializePayment(payment),
      bill: serializeBill(payment.bill),
    };
  }

  listNotifications(userId: string) {
    return this.notifications.list(userId);
  }

  markRead(userId: string, id: string) {
    return this.notifications.markRead(userId, id);
  }

  markAllRead(userId: string) {
    return this.notifications.markAllRead(userId);
  }
}

function parseGrade(value: string): [string, string] {
  const match = value.trim().match(/^(\d+)\s*(SD|SMP|SMA)?$/i);
  if (match) {
    return [match[1], (match[2] ?? 'SMP').toUpperCase()];
  }
  const parts = value.trim().split(/\s+/);
  return [parts[0] ?? value, (parts[1] ?? 'SMP').toUpperCase()];
}

function guessSalutation(name: string): string {
  return /^ibu\b/i.test(name) ? 'Ibu' : 'Bapak';
}

function nextSessionFor(dayOfWeek: number, startTime: string) {
  const date = nextDateForDay(dayOfWeek);
  const [hours, minutes] = startTime.split('.').map(Number);
  date.setHours(hours || 16, minutes || 0, 0, 0);
  return date;
}

function findRoutineId(lesson: any, pairs: any[]): string | undefined {
  const pair = pairs.find((item) => item.id === lesson.pairId);
  return pair?.sessions?.find((session: any) => session.subject === lesson.subject)?.id;
}
