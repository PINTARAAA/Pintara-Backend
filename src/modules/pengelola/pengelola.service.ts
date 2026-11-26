import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../shared/notifications.service';
import { SettingsService } from '../shared/settings.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { ReportsService } from './reports.service';
import { ApiException } from '../../common/errors';
import {
  serializeChangeRequestForReview,
  serializeOffer,
  serializePair,
  serializePengelolaRegistration,
  serializeRegistrationForWali,
  serializeTutorSession,
} from '../shared/serializers';
import {
  accountStatus,
  billPaid,
  billStatus,
  billTotal,
  deriveDistrict,
  gradeLabel,
  linkedStudent,
  paymentMethodOut,
  serializeAccountDetail,
  serializeAccountRow,
  serializeStudent,
  serializeStudentBill,
  serializeStudentRow,
  serializeTutor,
  serializeTutorRow,
  tutorStats,
} from '../shared/pengelola.serializers';
import {
  addDays,
  addMinutesToTime,
  dayIndex,
  dateAtTime,
  dayName,
  formatRequestedSchedule,
  formatShortAddress,
  initials,
  isSameDay,
  monthEnd,
  monthKey,
  monthStart,
  nextDateForDay,
  overlaps,
  startOfDay,
  timeToMinutes,
  toWhatsapp,
} from '../../common/utils';
import {
  AccountInputDto,
  ChangeDecisionDto,
  DeclineOfferDto,
  LinkStudentsDto,
  ManualPaymentDto,
  ObjectionReviewDto,
  PayHonorDto,
  RejectRegistrationDto,
  ReportDto,
  ResendAllDto,
  SaveScheduleDto,
  SendOfferDto,
  SettingInputDto,
  StatusDto,
  TutorInputDto,
} from './pengelola.dto';

const BUFFER_MINUTES = 15;
const TEMP_PASSWORD = 'pintara123';

@Injectable()
export class PengelolaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly reports: ReportsService,
  ) {}

  private registrationInclude = {
    student: { include: { parent: true } },
    matchedTutor: { include: { user: true } },
    pair: true,
  } as const;

  private offerInclude = {
    registration: { include: { student: true, parent: true } },
    tutor: { include: { user: true } },
  } as const;

  async dashboard(userId: string) {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const yesterday = addDays(today, -1);
    const [lessons, pendingRegistrations, needTutor, objections, ready, bills, unread] =
      await Promise.all([
        this.prisma.lessonSession.findMany({
          where: { start: { gte: yesterday, lt: tomorrow } },
          include: { attendance: true, pair: { include: { tutor: true } } },
        }),
        this.prisma.registration.count({
          where: { status: 'menunggu_verifikasi' },
        }),
        this.prisma.registration.count({
          where: { status: 'terverifikasi', matchedTutorId: null },
        }),
        this.prisma.attendanceRecord.count({
          where: { validation: 'keberatan' },
        }),
        this.prisma.attendanceRecord.count({
          where: { validation: 'sudah_divalidasi', finalizedAt: null },
        }),
        this.prisma.bill.findMany({
          where: {
            period: { gte: monthStart(now), lte: monthEnd(now) },
          },
        }),
        this.notifications.unreadCount(userId),
      ]);
    const todayLessons = lessons.filter((lesson) => isSameDay(lesson.start, today));
    const yesterdayLessons = lessons.filter((lesson) =>
      isSameDay(lesson.start, yesterday),
    );
    const tasks: any[] = [];
    if (pendingRegistrations) {
      tasks.push({
        id: 'verifikasi',
        icon: 'user-plus',
        title: 'Verifikasi pendaftaran',
        description: 'Pendaftaran menunggu verifikasi',
        count: pendingRegistrations,
        to: '/pengelola/pendaftaran',
      });
    }
    if (needTutor) {
      tasks.push({
        id: 'cocokkan',
        icon: 'users',
        title: 'Cocokkan tutor',
        description: 'Siswa terverifikasi belum punya tutor',
        count: needTutor,
        to: '/pengelola/les',
      });
    }
    if (objections) {
      tasks.push({
        id: 'keberatan',
        icon: 'alert',
        title: 'Tinjau keberatan presensi',
        description: 'Dari wali murid',
        count: objections,
        to: '/pengelola/presensi',
      });
    }
    if (ready) {
      tasks.push({
        id: 'final',
        icon: 'clipboard',
        title: 'Verifikasi final presensi',
        description: 'Siap dihitung ke rekap honor',
        count: ready,
        to: '/pengelola/presensi',
      });
    }
    const paidAmount = bills.reduce((sum, bill) => sum + bill.paid, 0);
    const totalAmount = bills.reduce((sum, bill) => sum + bill.total, 0);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return {
      admin: { name: user?.name ?? '' },
      today: {
        date: now,
        sessions: todayLessons.length,
        tutorsOnDuty: new Set(todayLessons.map((lesson) => lesson.pair.tutorId))
          .size,
        attendanceSubmitted: todayLessons.filter((lesson) => lesson.attendance)
          .length,
        missingYesterday: yesterdayLessons.filter((lesson) => !lesson.attendance)
          .length,
      },
      tasks,
      billing: {
        month: now.toLocaleDateString('id-ID', { month: 'long' }),
        paidAmount,
        totalAmount,
        invoices: bills.length,
        dueDate: new Date(now.getFullYear(), now.getMonth(), 16),
        lunas: bills.filter((bill) => bill.status === 'lunas').length,
        sebagian: bills.filter((bill) => bill.status === 'sebagian').length,
        belumBayar: bills.filter((bill) => bill.status === 'belum_bayar').length,
      },
      unreadNotifications: unread,
    };
  }

  async menu(userId: string) {
    const [
      user,
      tutorsTotal,
      tutorsActive,
      studentsTotal,
      studentsActive,
      failedNotifications,
    ] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.tutorProfile.count(),
      this.prisma.tutorProfile.count({ where: { isActive: true } }),
      this.prisma.student.count(),
      this.prisma.student.count({ where: { isActive: true } }),
      this.notifications.failedCount(),
    ]);
    return {
      name: user?.name ?? '',
      initials: initials(user?.name ?? ''),
      role: 'Pengelola LBB',
      email: user?.email ?? '',
      tutors: { total: tutorsTotal, active: tutorsActive },
      students: { total: studentsTotal, active: studentsActive },
      failedNotifications,
    };
  }

  async registrations(filter: {
    status?: string;
    query?: string;
    level?: string;
  }) {
    const status = filter.status ?? 'menunggu_verifikasi';
    const q = filter.query?.trim() ?? '';
    const where: any = {
      status,
      ...(filter.level ? { level: filter.level } : {}),
      ...(q
        ? {
            OR: [
              { studentName: { contains: q, mode: 'insensitive' } },
              { parentName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [counts, items] = await Promise.all([
      Promise.all([
        this.prisma.registration.count({
          where: { status: 'menunggu_verifikasi' },
        }),
        this.prisma.registration.count({ where: { status: 'terverifikasi' } }),
        this.prisma.registration.count({ where: { status: 'ditolak' } }),
      ]),
      this.prisma.registration.findMany({
        where,
        include: this.registrationInclude,
        orderBy:
          status === 'menunggu_verifikasi'
            ? { submittedAt: 'asc' }
            : { updatedAt: 'desc' },
      }),
    ]);
    return {
      counts: {
        menunggu_verifikasi: counts[0],
        terverifikasi: counts[1],
        ditolak: counts[2],
      },
      items: items.map(serializePengelolaRegistration),
    };
  }

  async registration(id: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: this.registrationInclude,
    });
    if (!registration) throw ApiException.notFound('Pendaftaran tidak ditemukan');
    return serializePengelolaRegistration(registration);
  }

  async verifyRegistration(id: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: this.registrationInclude,
    });
    if (!registration) throw ApiException.notFound('Pendaftaran tidak ditemukan');
    if (registration.status !== 'menunggu_verifikasi') {
      throw ApiException.conflict(
        'already_processed',
        'Pendaftaran sudah diproses',
      );
    }
    let studentId = registration.studentId;
    if (!studentId) {
      const student = await this.prisma.student.create({
        data: {
          parentId: registration.parentId,
          name: registration.studentName,
          grade: registration.grade,
          level: registration.level,
          school: registration.school,
          address: registration.address,
        },
      });
      studentId = student.id;
    }
    const updated = await this.prisma.registration.update({
      where: { id },
      data: {
        status: 'terverifikasi',
        verifiedAt: new Date(),
        studentId,
      },
      include: this.registrationInclude,
    });
    await this.notifications.create(updated.parentId, {
      kind: 'les',
      title: 'Pendaftaran terverifikasi',
      body: `${updated.studentName} · ${updated.number}`,
      to: '/wali/pendaftaran/status',
    });
    await this.notifications.logEvent({
      kind: 'hasil-verifikasi',
      channel: 'whatsapp',
      recipients: [
        {
          name: updated.parentName,
          role: 'wali',
          contact: toWhatsapp(updated.parentWhatsapp),
          accountId: updated.parentId,
        },
      ],
      message: `Halo ${updated.parentName}, pendaftaran ${updated.studentName} sudah diverifikasi. Lihat detailnya di PINTARA.`,
    });
    return serializePengelolaRegistration(updated);
  }

  async rejectRegistration(id: string, dto: RejectRegistrationDto) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: this.registrationInclude,
    });
    if (!registration) throw ApiException.notFound('Pendaftaran tidak ditemukan');
    const canReject =
      registration.status === 'menunggu_verifikasi' ||
      (registration.status === 'terverifikasi' && !registration.matchedTutorId);
    if (!canReject) {
      throw ApiException.conflict(
        'already_processed',
        'Pendaftaran sudah diproses',
      );
    }
    const updated = await this.prisma.registration.update({
      where: { id },
      data: {
        status: 'ditolak',
        rejectedAt: new Date(),
        rejectionReason: dto.reason,
        rejectionMessage: dto.message.trim(),
      },
      include: this.registrationInclude,
    });
    await this.notifications.create(updated.parentId, {
      kind: 'les',
      title: 'Pendaftaran ditolak',
      body: dto.message.trim(),
      to: '/wali/pendaftaran/status',
    });
    await this.notifications.logEvent({
      kind: 'hasil-verifikasi',
      channel: 'whatsapp',
      recipients: [
        {
          name: updated.parentName,
          role: 'wali',
          contact: toWhatsapp(updated.parentWhatsapp),
          accountId: updated.parentId,
        },
      ],
      message: `Halo ${updated.parentName}, pendaftaran ${updated.studentName} ditolak. ${dto.message.trim()}`,
    });
    return serializePengelolaRegistration(updated);
  }

  async matchingQueue() {
    const items = await this.prisma.registration.findMany({
      where: { status: 'terverifikasi', matchedTutorId: null },
      include: this.registrationInclude,
      orderBy: { verifiedAt: 'asc' },
    });
    return items.map(serializePengelolaRegistration);
  }

  async matchingCandidates(registrationId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: this.registrationInclude,
    });
    if (!registration) throw ApiException.notFound('Pendaftaran tidak ditemukan');
    const tutors = await this.prisma.tutorProfile.findMany({
      where: { isActive: true },
      include: {
        user: true,
        pairs: { where: { status: 'aktif' } },
      },
    });
    const declined = registration.declinedTutorIds ?? [];
    const candidates = tutors
      .filter((tutor) => !declined.includes(tutor.id))
      .map((tutor) => evaluateTutor(tutor, registration))
      .filter((candidate) => !candidate.hidden)
      .map(({ hidden, ...candidate }) => candidate)
      .sort(
        (a, b) =>
          Number(b.fullMatch) - Number(a.fullMatch) || b.score - a.score,
      );
    return {
      registration: serializePengelolaRegistration(registration),
      candidates,
      fullMatches: candidates.filter((candidate) => candidate.fullMatch).length,
    };
  }

  async selectTutor(registrationId: string, tutorId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
    if (!registration) throw ApiException.notFound('Pendaftaran tidak ditemukan');
    if (registration.status !== 'terverifikasi' || registration.matchedTutorId) {
      throw ApiException.conflict(
        'already_processed',
        'Pendaftaran sudah diproses',
      );
    }
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { id: tutorId },
      include: { user: true },
    });
    if (!tutor) throw ApiException.notFound('Tutor tidak ditemukan');
    const updated = await this.prisma.registration.update({
      where: { id: registrationId },
      data: { matchedTutorId: tutorId, matchedAt: new Date() },
      include: this.registrationInclude,
    });
    return serializePengelolaRegistration(updated);
  }

  async offers() {
    const [registrations, offers] = await Promise.all([
      this.prisma.registration.findMany({
        where: { status: 'terverifikasi', matchedTutorId: { not: null } },
        include: this.registrationInclude,
        orderBy: { matchedAt: 'asc' },
      }),
      this.prisma.tutorOffer.findMany({
        include: this.offerInclude,
        orderBy: { sentAt: 'desc' },
      }),
    ]);
    const activeKeys = new Set(
      offers
        .filter((offer) => offer.status !== 'ditolak')
        .map((offer) => `${offer.registrationId}:${offer.tutorId}`),
    );
    const unsent = registrations
      .filter(
        (registration) =>
          registration.matchedTutorId &&
          !activeKeys.has(`${registration.id}:${registration.matchedTutorId}`),
      )
      .map((registration) => ({
        registration: serializePengelolaRegistration(registration),
        tutorName: registration.matchedTutor?.user.name ?? '',
      }));
    return {
      unsent,
      waiting: offers
        .filter((offer) => offer.status === 'menunggu_konfirmasi')
        .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
        .map(serializeOffer),
      history: offers
        .filter((offer) => offer.status !== 'menunggu_konfirmasi')
        .sort(
          (a, b) =>
            (b.answeredAt ?? b.sentAt).getTime() -
            (a.answeredAt ?? a.sentAt).getTime(),
        )
        .map(serializeOffer),
    };
  }

  async offerDraft(registrationId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: this.registrationInclude,
    });
    if (!registration) throw ApiException.notFound('Pendaftaran tidak ditemukan');
    if (registration.status !== 'terverifikasi' || !registration.matchedTutorId) {
      throw ApiException.conflict(
        'no_match',
        'Belum ada tutor yang dipilih.',
      );
    }
    const existing = await this.prisma.tutorOffer.findFirst({
      where: {
        registrationId,
        tutorId: registration.matchedTutorId,
        status: { not: 'ditolak' },
      },
    });
    if (existing) {
      throw ApiException.conflict(
        'already_sent',
        'Penawaran sudah dikirim.',
        { offerId: existing.id },
      );
    }
    return this.buildOfferDraft(registration);
  }

  async sendOffer(dto: SendOfferDto) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: dto.registrationId },
      include: this.registrationInclude,
    });
    if (!registration) throw ApiException.notFound('Pendaftaran tidak ditemukan');
    const draft = await this.buildOfferDraft(registration);
    if (draft.takenSlot) {
      throw ApiException.conflict(
        'tutor_unavailable',
        `${draft.tutor.shortName} tidak lagi tersedia.`,
      );
    }
    const offer = await this.prisma.tutorOffer.create({
      data: {
        registrationId: registration.id,
        tutorId: registration.matchedTutorId!,
        studentName: draft.student.name,
        grade: draft.student.grade,
        level: draft.student.level,
        subjects: draft.subjects,
        schedule: draft.schedule,
        location: draft.location,
        distanceKm: draft.distanceKm,
        rate: draft.rate,
        message: dto.message?.trim() || null,
        status: 'menunggu_konfirmasi',
      },
      include: this.offerInclude,
    });
    await this.notifications.create(offer.tutor.userId, {
      kind: 'pengingat',
      title: 'Penawaran mengajar baru',
      body: `${offer.studentName} · ${offer.schedule}`,
      to: '/tutor',
    });
    await this.notifications.logEvent({
      kind: 'penawaran-tutor',
      channel: 'whatsapp',
      recipients: [
        {
          name: offer.tutor.user.name,
          role: 'tutor',
          contact: toWhatsapp(offer.tutor.user.whatsapp),
          accountId: offer.tutor.userId,
        },
      ],
      message: `Halo ${offer.tutor.user.name}, ada penawaran les ${offer.subjects.join(', ')} untuk ${offer.studentName} setiap ${offer.schedule}. Konfirmasi di PINTARA.`,
    });
    return serializeOffer(offer);
  }

  async offer(id: string) {
    const offer = await this.prisma.tutorOffer.findUnique({
      where: { id },
      include: this.offerInclude,
    });
    if (!offer) throw ApiException.notFound('Penawaran tidak ditemukan');
    return serializeOffer(offer);
  }

  async acceptOffer(id: string) {
    const offer = await this.requireWaitingOffer(id);
    const updated = await this.prisma.tutorOffer.update({
      where: { id },
      data: { status: 'diterima', answeredAt: new Date() },
      include: this.offerInclude,
    });
    await this.notifications.create(updated.registration.parentId, {
      kind: 'les',
      title: 'Tutor menerima penawaran',
      body: `${updated.studentName} · ${updated.tutor.user.name}`,
      to: '/wali/pendaftaran/status',
    });
    return serializeOffer(updated);
  }

  async declineOffer(id: string, dto: DeclineOfferDto) {
    const offer = await this.requireWaitingOffer(id);
    const updated = await this.prisma.tutorOffer.update({
      where: { id },
      data: {
        status: 'ditolak',
        answeredAt: new Date(),
        declineReason: dto.reason,
        declineNote: dto.note?.trim() || null,
      },
      include: this.offerInclude,
    });
    await this.prisma.registration.update({
      where: { id: offer.registrationId },
      data: {
        matchedTutorId: null,
        matchedAt: null,
        declinedTutorIds: {
          push: offer.tutorId,
        },
      },
    });
    return serializeOffer(updated);
  }

  async scheduleBoard() {
    const [offers, requests, pairs] = await Promise.all([
      this.prisma.tutorOffer.findMany({
        where: { status: 'diterima', pair: null },
        include: this.offerInclude,
        orderBy: { answeredAt: 'asc' },
      }),
      this.prisma.scheduleChangeRequest.findMany({
        where: { status: 'ditinjau_pengelola' },
        include: {
          tutor: { include: { user: true } },
          student: { include: { parent: true } },
          pair: { include: { sessions: true } },
        },
        orderBy: { submittedAt: 'asc' },
      }),
      this.prisma.pair.findMany({
        where: { status: 'aktif' },
        include: {
          student: { include: { parent: true } },
          tutor: { include: { user: true } },
          sessions: true,
        },
        orderBy: { student: { name: 'asc' } },
      }),
    ]);
    return {
      toSchedule: offers.map(serializeOffer),
      requests: requests.map(serializeChangeRequestForReview),
      active: pairs.map(serializePair),
    };
  }

  async scheduleDraft(offerId: string) {
    const offer = await this.prisma.tutorOffer.findUnique({
      where: { id: offerId },
      include: {
        registration: { include: { student: true, parent: true } },
        tutor: { include: { user: true } },
        pair: { include: { sessions: true, student: true, tutor: { include: { user: true } } } },
      },
    });
    if (!offer || offer.status !== 'diterima') {
      throw ApiException.notFound('Penawaran tidak ditemukan');
    }
    if (offer.pair) return draftFromPair(offer.pair);
    const registration = offer.registration;
    const perWeek = registration.perWeek || offer.subjects.length || 1;
    const days = registration.days.length ? registration.days : ['Senin'];
    const start = registration.startTime;
    const sessions = Array.from({ length: perWeek }, (_, index) => ({
      subject: offer.subjects[index % offer.subjects.length] ?? offer.subjects[0],
      day: days[index] ?? days[0],
      start,
      end: addMinutesToTime(start, 90),
    }));
    return {
      offerId,
      student: {
        name: registration.studentName,
        grade: registration.grade,
        level: registration.level,
      },
      parentName: registration.parentName,
      tutor: {
        id: offer.tutorId,
        name: offer.tutor.user.name,
        shortName: offer.tutor.shortName,
      },
      subjects: offer.subjects,
      requested: `${formatRequestedSchedule(registration)} · ${perWeek}× per minggu`,
      sessions,
      effectiveFrom: nextDateForDay(dayIndex(sessions[0].day)),
    };
  }

  async pairDraft(pairId: string) {
    const pair = await this.prisma.pair.findUnique({
      where: { id: pairId },
      include: {
        student: { include: { parent: true } },
        tutor: { include: { user: true } },
        sessions: true,
      },
    });
    if (!pair) throw ApiException.notFound('Jadwal tidak ditemukan');
    return draftFromPair(pair);
  }

  async saveSchedule(dto: SaveScheduleDto) {
    const draft = dto.draft as any;
    const sessions = dto.sessions.map((session) => ({
      subject: session.subject,
      day: session.day,
      start: session.start,
      end: session.end,
    }));
    const effectiveFrom = new Date(dto.effectiveFrom);
    const conflict = await this.findScheduleConflict(draft, sessions);
    if (conflict) {
      throw ApiException.conflict(
        'schedule_conflict',
        'Jadwal bentrok.',
        { conflict },
      );
    }

    let pair: any;
    if (draft.pairId) {
      pair = await this.prisma.pair.update({
        where: { id: draft.pairId },
        data: { effectiveFrom },
        include: {
          student: { include: { parent: true } },
          tutor: { include: { user: true } },
          sessions: true,
        },
      });
      await this.prisma.pairSession.deleteMany({ where: { pairId: pair.id } });
      await this.prisma.pairSession.createMany({
        data: sessions.map((session) => ({
          pairId: pair.id,
          subject: session.subject,
          day: session.day,
          dayOfWeek: dayIndex(session.day),
          startTime: session.start,
          endTime: session.end,
        })),
      });
    } else {
      const offer = draft.offerId
        ? await this.prisma.tutorOffer.findUnique({
            where: { id: draft.offerId },
            include: {
              registration: { include: { student: true } },
            },
          })
        : null;
      const registrationId = draft.registrationId ?? offer?.registrationId;
      const registration = registrationId
        ? await this.prisma.registration.findUnique({
            where: { id: registrationId },
          })
        : null;
      const studentId =
        registration?.studentId ??
        offer?.registration.studentId ??
        (registration
          ? (
              await this.prisma.student.create({
                data: {
                  parentId: registration.parentId,
                  name: registration.studentName,
                  grade: registration.grade,
                  level: registration.level,
                  school: registration.school,
                  address: registration.address,
                },
              })
            ).id
          : null);
      if (!studentId || !draft.tutor?.id) {
        throw ApiException.badRequest('Data jadwal tidak lengkap');
      }
      pair = await this.prisma.pair.create({
        data: {
          studentId,
          tutorId: draft.tutor.id,
          offerId: draft.offerId ?? null,
          registrationId: registrationId ?? null,
          subjects: draft.subjects ?? [],
          effectiveFrom,
          sessions: {
            create: sessions.map((session) => ({
              subject: session.subject,
              day: session.day,
              dayOfWeek: dayIndex(session.day),
              startTime: session.start,
              endTime: session.end,
            })),
          },
        },
        include: {
          student: { include: { parent: true } },
          tutor: { include: { user: true } },
          sessions: true,
        },
      });
    }
    await this.syncLessons(pair.id);
    await this.notifications.create(pair.student.parentId, {
      kind: 'jadwal',
      title: 'Jadwal les ditetapkan',
      body: `${pair.student.name} · ${pair.sessions.map((session: any) => session.day).join(' & ')}`,
      to: '/wali/jadwal',
    });
    await this.notifications.create(pair.tutor.userId, {
      kind: 'pengingat',
      title: 'Jadwal les baru',
      body: `${pair.student.name} · ${pair.sessions.map((session: any) => session.day).join(' & ')}`,
      to: '/tutor/jadwal',
    });
    return serializePair(
      await this.prisma.pair.findUnique({
        where: { id: pair.id },
        include: {
          student: { include: { parent: true } },
          tutor: { include: { user: true } },
          sessions: true,
        },
      }),
    );
  }

  async changeReview(id: string) {
    const request = await this.prisma.scheduleChangeRequest.findUnique({
      where: { id },
      include: {
        tutor: { include: { user: true } },
        student: { include: { parent: true } },
        pair: {
          include: {
            sessions: true,
            student: { include: { parent: true } },
            tutor: { include: { user: true } },
          },
        },
      },
    });
    if (!request) throw ApiException.notFound('Pengajuan tidak ditemukan');
    return this.buildChangeReview(request);
  }

  async decideChange(id: string, dto: ChangeDecisionDto) {
    const request = await this.prisma.scheduleChangeRequest.findUnique({
      where: { id },
      include: {
        tutor: { include: { user: true } },
        student: { include: { parent: true } },
        pair: {
          include: {
            sessions: true,
            student: { include: { parent: true } },
            tutor: { include: { user: true } },
          },
        },
      },
    });
    if (!request) throw ApiException.notFound('Pengajuan tidak ditemukan');
    if (request.status !== 'ditinjau_pengelola') {
      throw ApiException.conflict(
        'already_processed',
        'Pengajuan sudah diputuskan',
      );
    }
    const review = this.buildChangeReview(request);
    if (dto.approved && review.conflict) {
      throw ApiException.conflict(
        'schedule_conflict',
        'Jadwal bentrok.',
        { conflict: review.conflict },
      );
    }
    const status = dto.approved ? 'disetujui' : 'ditolak';
    const updated = await this.prisma.scheduleChangeRequest.update({
      where: { id },
      data: { status, decidedAt: new Date() },
      include: {
        tutor: { include: { user: true } },
        student: { include: { parent: true } },
      },
    });
    if (dto.approved) {
      const endTime = addMinutesToTime(
        request.toStartTime,
        request.durationMinutes,
      );
      if (request.scope === 'seterusnya') {
        const routine =
          (request.routineId
            ? await this.prisma.pairSession.findUnique({
                where: { id: request.routineId },
              })
            : null) ??
          (await this.prisma.pairSession.findFirst({
            where: {
              pairId: request.pairId,
              dayOfWeek: request.fromWeekday,
              startTime: request.fromStartTime,
            },
          }));
        if (routine) {
          await this.prisma.pairSession.update({
            where: { id: routine.id },
            data: {
              day: dayName(request.toWeekday),
              dayOfWeek: request.toWeekday,
              startTime: request.toStartTime,
              endTime,
            },
          });
        }
        await this.syncLessons(request.pairId);
      } else {
        const target = dateAtTime(request.effectiveDate, request.toStartTime);
        const existing = await this.prisma.lessonSession.findFirst({
          where: {
            pairId: request.pairId,
            start: {
              gte: startOfDay(target),
              lt: addDays(startOfDay(target), 1),
            },
          },
        });
        if (existing) {
          await this.prisma.lessonSession.update({
            where: { id: existing.id },
            data: {
              start: target,
              end: dateAtTime(request.effectiveDate, endTime),
            },
          });
        } else {
          await this.prisma.lessonSession.create({
            data: {
              pairId: request.pairId,
              subject: request.subject,
              start: target,
              end: dateAtTime(request.effectiveDate, endTime),
            },
          });
        }
      }
    }
    await this.notifications.create(updated.student.parentId, {
      kind: 'jadwal',
      title: dto.approved
        ? 'Pengajuan perubahan jadwal disetujui'
        : 'Pengajuan perubahan jadwal ditolak',
      body: `${updated.student.name} · ${dayName(updated.toWeekday)} ${updated.toStartTime}`,
      to: '/wali/jadwal',
    });
    return serializeChangeRequestForReview(updated);
  }

  async attendanceOverview(month?: string) {
    const now = new Date();
    const active = month ? parseMonth(month) : monthStart(now);
    const lessons = await this.prisma.lessonSession.findMany({
      where: { start: { gte: active, lte: monthEnd(active) } },
      include: {
        attendance: true,
        pair: {
          include: {
            tutor: { include: { user: true } },
            student: { include: { parent: true } },
          },
        },
      },
      orderBy: { start: 'asc' },
    });
    const started = lessons.filter((lesson) => lesson.start <= now);
    const final = started.filter((lesson) => lesson.attendance?.finalizedAt);
    const ready = started.filter(
      (lesson) =>
        lesson.attendance?.validation === 'sudah_divalidasi' &&
        !lesson.attendance.finalizedAt,
    );
    const waiting = started.filter(
      (lesson) => lesson.attendance?.validation === 'belum_divalidasi',
    );
    const objections = started.filter(
      (lesson) => lesson.attendance?.validation === 'keberatan',
    );
    const notCollected = started.filter((lesson) => !lesson.attendance);
    const byTutor = new Map<string, number>();
    ready.forEach((lesson) =>
      byTutor.set(
        lesson.pair.tutor.user.name,
        (byTutor.get(lesson.pair.tutor.user.name) ?? 0) + 1,
      ),
    );
    return {
      months: await this.attendanceMonths(),
      month: active,
      total: started.length,
      final: final.length,
      ready: ready.length,
      waiting: waiting.length,
      disputed: objections.length,
      notCollected: notCollected.length,
      objections: objections.map(serializeTutorSession),
      readyByTutor: [...byTutor]
        .map(([tutor, count]) => ({ tutor, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async finalizeAttendance(month?: string) {
    const now = new Date();
    const active = month ? parseMonth(month) : monthStart(now);
    const lessons = await this.prisma.lessonSession.findMany({
      where: { start: { gte: active, lte: monthEnd(active) } },
      include: { attendance: true },
    });
    const ids = lessons
      .filter(
        (lesson) =>
          lesson.attendance &&
          lesson.attendance.validation === 'sudah_divalidasi' &&
          !lesson.attendance.finalizedAt,
      )
      .map((lesson) => lesson.attendance!.id);
    if (ids.length) {
      await this.prisma.attendanceRecord.updateMany({
        where: { id: { in: ids } },
        data: { finalizedAt: now },
      });
      const admins = await this.prisma.user.findMany({
        where: { role: 'pengelola', isActive: true },
        select: { id: true, name: true, email: true, whatsapp: true },
      });
      if (admins.length) {
        await this.notifications.logEvent({
          kind: 'rekap-honor',
          channel: 'aplikasi',
          recipients: admins.map((admin) => ({
            name: admin.name,
            role: 'pengelola' as const,
            contact: admin.email ?? admin.whatsapp ?? '',
            accountId: admin.id,
          })),
          message: `${ids.length} presensi difinalkan. Rekap honor ${active.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} siap dihitung di PINTARA.`,
        });
      }
    }
    return ids.length;
  }

  async objection(userId: string, sessionId: string) {
    const session = await this.prisma.lessonSession.findUnique({
      where: { id: sessionId },
      include: {
        attendance: true,
        pair: {
          include: {
            tutor: { include: { user: true } },
            student: { include: { parent: true } },
          },
        },
      },
    });
    if (!session) throw ApiException.notFound('Sesi tidak ditemukan');
    return serializeTutorSession(session);
  }

  async reviewObjection(
    userId: string,
    sessionId: string,
    dto: ObjectionReviewDto,
  ) {
    const session = await this.prisma.lessonSession.findUnique({
      where: { id: sessionId },
      include: {
        attendance: true,
        pair: {
          include: {
            tutor: { include: { user: true } },
            student: { include: { parent: true } },
          },
        },
      },
    });
    if (!session) throw ApiException.notFound('Sesi tidak ditemukan');
    if (!session.attendance || session.attendance.validation !== 'keberatan') {
      throw ApiException.conflict(
        'already_filled',
        'Keberatan sudah ditinjau',
      );
    }
    const record = await this.prisma.attendanceRecord.update({
      where: { id: session.attendance.id },
      data: {
        validation: 'sudah_divalidasi',
        validatedAt: new Date(),
        objectionCorrected: dto.corrected,
        objectionNote: dto.note?.trim() || null,
        ...(dto.corrected
          ? {
              actualStart: dto.actualStart ?? session.attendance.actualStart,
              actualEnd: dto.actualEnd ?? session.attendance.actualEnd,
            }
          : {}),
      },
    });
    await this.notifications.create(session.pair.student.parentId, {
      kind: 'validasi',
      title: 'Keberatan presensi sudah ditinjau',
      body: dto.corrected
        ? `${session.subject} · waktu dikoreksi ${dto.actualStart}–${dto.actualEnd}`
        : `${session.subject} · data tutor dinyatakan sesuai`,
      to: '/wali/riwayat',
    });
    return serializeTutorSession({ ...session, attendance: record });
  }

  async honorRecap(month?: string) {
    const now = new Date();
    const active = month ? parseMonth(month) : monthStart(now);
    const recap = await this.prisma.honorRecap.findUnique({
      where: { month: monthKey(active) },
      include: {
        lines: {
          include: {
            tutor: { include: { user: true } },
            payment: true,
          },
        },
      },
    });
    const months = await this.honorMonths();
    if (!recap) {
      const progress = await this.finalProgress(active);
      const finals = await this.finalLessons(active);
      const tutorIds = new Set(
        finals.map((lesson) => lesson.pair.tutorId),
      );
      const tutors = await this.prisma.tutorProfile.findMany({
        where: { id: { in: [...tutorIds] }, ratePerSession: null },
        include: { user: true },
      });
      return {
        state: 'belum_dihitung',
        months,
        month: active,
        final: progress.final,
        total: progress.total,
        tutorsWithoutRate: tutors.map((tutor) => displayName(tutor.user?.name ?? '')),
      };
    }
    const honors = recap.lines.map(serializeHonorLine);
    const paid = honors.filter((honor) => isPaid(honor));
    const unpaid = honors.filter((honor) => !isPaid(honor));
    return {
      state: 'dihitung',
      months,
      month: active,
      calculatedAt: recap.calculatedAt,
      total: honors.reduce((sum, honor) => sum + honor.total, 0),
      sessions: honors.reduce((sum, honor) => sum + honor.sessions, 0),
      paid: {
        amount: paid.reduce(
          (sum, honor) =>
            sum + Math.min(honor.payment?.amount ?? 0, honor.total),
          0,
        ),
        tutors: paid.length,
      },
      unpaid: {
        amount: unpaid.reduce(
          (sum, honor) => sum + honor.total - (honor.payment?.amount ?? 0),
          0,
        ),
        tutors: unpaid.length,
      },
      unpaidHonors: unpaid.sort((a, b) => b.total - a.total),
      paidHonors: paid.sort(
        (a, b) =>
          (b.payment?.paidAt.getTime() ?? 0) -
          (a.payment?.paidAt.getTime() ?? 0),
      ),
      skipped: recap.skipped,
    };
  }

  async calculateHonor(month?: string) {
    const now = new Date();
    const active = month ? parseMonth(month) : monthStart(now);
    const finals = await this.finalLessons(active);
    const existing = await this.prisma.honorRecap.findUnique({
      where: { month: monthKey(active) },
      include: { lines: { include: { payment: true } } },
    });
    const oldPayments = new Map(
      (existing?.lines ?? []).map((line) => [line.tutorId, line.payment]),
    );
    const grouped = new Map<
      string,
      { tutorId: string; name: string; shortName: string; method: string; methodNote?: string | null; rate: number | null; subjects: Map<string, number> }
    >();
    for (const lesson of finals) {
      const tutor = lesson.pair.tutor;
      const entry = grouped.get(tutor.id) ?? {
        tutorId: tutor.id,
        name: displayName(tutor.user.name),
        shortName: tutor.shortName,
        method: tutor.honorMethod,
        methodNote: tutor.honorMethodNote,
        rate: tutor.ratePerSession,
        subjects: new Map<string, number>(),
      };
      entry.subjects.set(
        lesson.subject,
        (entry.subjects.get(lesson.subject) ?? 0) + 1,
      );
      grouped.set(tutor.id, entry);
    }
    const skipped: string[] = [];
    const honors = [...grouped.values()].filter((entry) => {
      if (entry.rate === null) {
        skipped.push(entry.name);
        return false;
      }
      return true;
    });
    const recap = await this.prisma.honorRecap.upsert({
      where: { month: monthKey(active) },
      create: { month: monthKey(active), calculatedAt: now, skipped },
      update: { calculatedAt: now, skipped },
    });
    await this.prisma.honorLine.deleteMany({ where: { recapId: recap.id } });
    for (const honor of honors) {
      const lines = [...honor.subjects].map(([subject, sessions]) => ({
        subject,
        sessions,
        rate: honor.rate ?? 0,
        amount: sessions * (honor.rate ?? 0),
      }));
      const created = await this.prisma.honorLine.create({
        data: {
          recapId: recap.id,
          tutorId: honor.tutorId,
          name: honor.name,
          shortName: honor.shortName,
          subjectLines: lines,
          sessions: lines.reduce((sum, line) => sum + line.sessions, 0),
          total: lines.reduce((sum, line) => sum + line.amount, 0),
          method: honor.method,
          methodNote: honor.methodNote,
        },
      });
      const payment = oldPayments.get(honor.tutorId);
      if (payment) {
        await this.prisma.honorPayment.create({
          data: {
            honorLineId: created.id,
            amount: payment.amount,
            method: payment.method,
            paidAt: payment.paidAt,
            proofFileId: payment.proofFileId,
            proofName: payment.proofName,
            proofSize: payment.proofSize,
            recordedAt: payment.recordedAt,
          },
        });
      }
    }
    const totals = new Map(
      honors.map((honor) => [
        honor.tutorId,
        [...honor.subjects.values()].reduce(
          (sum, sessions) => sum + sessions * (honor.rate ?? 0),
          0,
        ),
      ]),
    );
    const tutorUsers = await this.prisma.tutorProfile.findMany({
      where: { id: { in: [...totals.keys()] } },
      include: { user: true },
    });
    await Promise.all(
      tutorUsers.map((tutor) =>
        this.notifications.create(tutor.userId, {
          kind: 'rekap',
          title: `Rekap honor ${active.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} siap`,
          body: `Rp${(totals.get(tutor.id) ?? 0).toLocaleString('id-ID')} · lihat rincian di PINTARA`,
          to: '/tutor/riwayat',
        }),
      ),
    );
    return {
      tutors: honors.length,
      total: honors.reduce(
        (sum, honor) =>
          sum +
          [...honor.subjects.values()].reduce(
            (lineSum, sessions) => lineSum + sessions * (honor.rate ?? 0),
            0,
          ),
        0,
      ),
    };
  }

  async honorDetail(monthParam: string, tutorId: string) {
    const active = parseMonth(monthParam);
    const line = await this.prisma.honorLine.findFirst({
      where: { tutorId, recap: { month: monthKey(active) } },
      include: {
        tutor: { include: { user: true } },
        payment: true,
        recap: true,
      },
    });
    if (!line) throw ApiException.notFound('Rincian honor tidak ditemukan');
    const sessions = await this.prisma.lessonSession.findMany({
      where: {
        pair: { tutorId },
        start: { gte: active, lte: monthEnd(active) },
        attendance: { finalizedAt: { not: null } },
      },
      include: {
        attendance: true,
        pair: {
          include: {
            student: { include: { parent: true } },
            tutor: { include: { user: true } },
          },
        },
      },
      orderBy: { start: 'asc' },
    });
    return {
      ...serializeHonorLine(line),
      month: line.recap.month,
      status: honorStatus(line),
      sessionList: sessions.map(serializeTutorSession),
    };
  }

  async recordHonorPayment(
    userId: string,
    monthParam: string,
    tutorId: string,
    dto: PayHonorDto,
    file?: Express.Multer.File,
  ) {
    const active = parseMonth(monthParam);
    const line = await this.prisma.honorLine.findFirst({
      where: { tutorId, recap: { month: monthKey(active) } },
    });
    if (!line) throw ApiException.notFound('Rincian honor tidak ditemukan');
    const saved = file ? await this.storage.save(file, userId) : null;
    await this.prisma.honorPayment.upsert({
      where: { honorLineId: line.id },
      create: {
        honorLineId: line.id,
        amount: dto.amount,
        method: dto.method,
        paidAt: new Date(dto.paidAt),
        proofName: saved?.name,
        proofSize: saved?.size,
      },
      update: {
        amount: dto.amount,
        method: dto.method,
        paidAt: new Date(dto.paidAt),
        ...(saved ? { proofName: saved.name, proofSize: saved.size } : {}),
      },
    });
    return this.honorDetail(monthParam, tutorId);
  }

  // =====================================================================
  // Data Master · Tutor & Siswa
  // =====================================================================

  async tutors(filter: {
    query?: string;
    subject?: string;
    district?: string;
    status?: string;
  }) {
    const rows = await this.prisma.tutorProfile.findMany({
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    const q = filter.query?.trim().toLowerCase();
    const filtered = rows.filter((tutor) => {
      const name = tutor.user?.name ?? '';
      const district = tutor.district ?? deriveDistrict(tutor.address);
      return (
        (!q || name.toLowerCase().includes(q)) &&
        (!filter.subject || tutor.subjects.includes(filter.subject)) &&
        (!filter.district || district === filter.district) &&
        (!filter.status || accountStatus(tutor.isActive) === filter.status)
      );
    });
    filtered.sort(byActive);
    return filtered.map(serializeTutorRow);
  }

  async tutor(id: string) {
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { id },
      include: {
        user: true,
        pairs: {
          where: { status: 'aktif' },
          include: { sessions: true },
        },
      },
    });
    if (!tutor) throw ApiException.notFound('Tutor tidak ditemukan');
    return serializeTutor(tutor);
  }

  async createTutor(dto: TutorInputDto) {
    const name = normalizeKak(dto.name);
    const email = dto.email?.trim().toLowerCase() || null;
    if (email) await this.assertUniqueAccount(email, undefined);
    const username = await this.uniqueUsername(
      email ? email.split('@')[0] : name,
    );
    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
    const tutor = await this.prisma.tutorProfile.create({
      data: {
        shortName: shortNameOf(name),
        initials: initials(name),
        education: dto.education,
        subjects: dto.subjects,
        levels: dto.levels,
        days: dto.days,
        availableFrom: dto.from,
        availableUntil: dto.until,
        ratePerSession: dto.rate,
        address: dto.address,
        district: deriveDistrict(dto.address),
        user: {
          create: {
            name,
            username,
            email,
            whatsapp: dto.phone ?? null,
            passwordHash,
            role: 'tutor',
          },
        },
      },
      include: {
        user: true,
        pairs: { where: { status: 'aktif' }, include: { sessions: true } },
      },
    });
    return serializeTutor(tutor);
  }

  async updateTutor(id: string, dto: TutorInputDto) {
    const existing = await this.prisma.tutorProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) throw ApiException.notFound('Tutor tidak ditemukan');
    const name = normalizeKak(dto.name);
    const email = dto.email?.trim().toLowerCase() || null;
    if (email) await this.assertUniqueAccount(email, undefined, existing.userId);
    const tutor = await this.prisma.tutorProfile.update({
      where: { id },
      data: {
        shortName: shortNameOf(name),
        initials: initials(name),
        education: dto.education,
        subjects: dto.subjects,
        levels: dto.levels,
        days: dto.days,
        availableFrom: dto.from,
        availableUntil: dto.until,
        ratePerSession: dto.rate,
        address: dto.address,
        district: deriveDistrict(dto.address),
        user: {
          update: {
            name,
            ...(email !== null ? { email } : {}),
            whatsapp: dto.phone ?? null,
          },
        },
      },
      include: {
        user: true,
        pairs: { where: { status: 'aktif' }, include: { sessions: true } },
      },
    });
    return serializeTutor(tutor);
  }

  async setTutorStatus(id: string, status: 'aktif' | 'nonaktif') {
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { id },
    });
    if (!tutor) throw ApiException.notFound('Tutor tidak ditemukan');
    if (status === 'nonaktif') {
      const schedules = await this.prisma.pairSession.count({
        where: { pair: { tutorId: id, status: 'aktif' } },
      });
      if (schedules > 0) {
        throw ApiException.conflict(
          'active_schedule',
          `Masih ada ${schedules} jadwal les aktif.`,
          { schedules },
        );
      }
    }
    const active = status === 'aktif';
    await this.prisma.$transaction([
      this.prisma.tutorProfile.update({
        where: { id },
        data: { isActive: active },
      }),
      this.prisma.user.update({
        where: { id: tutor.userId },
        data: { isActive: active },
      }),
    ]);
    return this.tutor(id);
  }

  async students(filter: {
    query?: string;
    subject?: string;
    district?: string;
    status?: string;
  }) {
    const rows = await this.prisma.student.findMany({
      include: {
        parent: true,
        pairs: {
          include: { tutor: { include: { user: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const q = filter.query?.trim().toLowerCase();
    const filtered = rows.filter((student) => {
      const district = student.district ?? deriveDistrict(student.address);
      const haystack = [student.name, student.parent?.name ?? '']
        .join(' ')
        .toLowerCase();
      return (
        (!q || haystack.includes(q)) &&
        (!filter.subject || student.subjects.includes(filter.subject)) &&
        (!filter.district || district === filter.district) &&
        (!filter.status || accountStatus(student.isActive) === filter.status)
      );
    });
    filtered.sort(byActive);
    return filtered.map(serializeStudentRow);
  }

  async student(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        parent: { include: { _count: { select: { students: true } } } },
        pairs: {
          include: {
            sessions: true,
            tutor: { include: { user: true } },
          },
        },
      },
    });
    if (!student) throw ApiException.notFound('Siswa tidak ditemukan');
    return serializeStudent(student);
  }

  async setStudentStatus(id: string, status: 'aktif' | 'nonaktif') {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw ApiException.notFound('Siswa tidak ditemukan');
    if (status === 'nonaktif') {
      const schedules = await this.prisma.pairSession.count({
        where: { pair: { studentId: id, status: 'aktif' } },
      });
      if (schedules > 0) {
        throw ApiException.conflict(
          'active_schedule',
          `Masih ada ${schedules} jadwal les aktif.`,
          { schedules },
        );
      }
    }
    const active = status === 'aktif';
    await this.prisma.student.update({
      where: { id },
      data: {
        isActive: active,
        endedAt: active ? null : new Date(),
      },
    });
    return this.student(id);
  }

  // =====================================================================
  // Manajemen Akun
  // =====================================================================

  async accounts(filter: { role?: string; query?: string }) {
    const [users, students] = await Promise.all([
      this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.student.findMany({ select: { id: true, parentId: true } }),
    ]);
    const byParent = new Map<string, string[]>();
    for (const student of students) {
      const list = byParent.get(student.parentId) ?? [];
      list.push(student.id);
      byParent.set(student.parentId, list);
    }
    const q = filter.query?.trim().toLowerCase();
    const match = (user: any) =>
      !q ||
      [user.name, user.email ?? '', user.username].some((value: string) =>
        value.toLowerCase().includes(q),
      );
    const counts: Record<string, number> = {
      wali: 0,
      tutor: 0,
      pengelola: 0,
    };
    for (const user of users) {
      if (match(user) && user.role in counts) counts[user.role] += 1;
    }
    const role = filter.role ?? 'wali';
    const items = users
      .filter((user) => user.role === role && match(user))
      .sort(byActive)
      .map((user) => serializeAccountRow(user, byParent.get(user.id) ?? []));
    return { counts, items };
  }

  async account(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiException.notFound('Akun tidak ditemukan');
    const students =
      user.role === 'wali'
        ? await this.prisma.student.findMany({
            where: { parentId: id },
            orderBy: { name: 'asc' },
          })
        : [];
    return serializeAccountDetail(user, students);
  }

  async createAccount(dto: AccountInputDto) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    await this.assertUniqueAccount(email, username);
    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
    const name = dto.name.trim();
    const user = await this.prisma.user.create({
      data: {
        role: dto.role,
        name,
        email,
        username,
        whatsapp: dto.phone ?? null,
        passwordHash,
      },
    });
    if (dto.role === 'wali' && dto.studentIds?.length) {
      await this.prisma.student.updateMany({
        where: { id: { in: dto.studentIds } },
        data: { parentId: user.id },
      });
    }
    if (dto.role === 'tutor') {
      await this.prisma.tutorProfile.create({
        data: {
          userId: user.id,
          shortName: shortNameOf(name),
          initials: initials(name),
          subjects: [],
          levels: [],
          days: [],
        },
      });
    }
    return this.account(user.id);
  }

  async updateAccount(id: string, dto: AccountInputDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiException.notFound('Akun tidak ditemukan');
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    await this.assertUniqueAccount(email, username, id);
    const name = dto.name.trim();
    await this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role,
        name,
        email,
        username,
        whatsapp: dto.phone ?? null,
      },
    });
    if (dto.role === 'wali' && dto.studentIds?.length) {
      await this.prisma.student.updateMany({
        where: { id: { in: dto.studentIds } },
        data: { parentId: id },
      });
    }
    if (user.role === 'tutor' || dto.role === 'tutor') {
      await this.prisma.tutorProfile.updateMany({
        where: { userId: id },
        data: { shortName: shortNameOf(name), initials: initials(name) },
      });
    }
    return this.account(id);
  }

  async resetAccountPassword(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiException.notFound('Akun tidak ditemukan');
    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    // Password sementara hanya dikirim ke email; tidak pernah dikembalikan API.
    return { email: user.email };
  }

  async setAccountStatus(id: string, status: 'aktif' | 'nonaktif') {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiException.notFound('Akun tidak ditemukan');
    if (status === 'nonaktif' && user.role === 'tutor') {
      const tutor = await this.prisma.tutorProfile.findUnique({
        where: { userId: id },
      });
      if (tutor) {
        const schedules = await this.prisma.pairSession.count({
          where: { pair: { tutorId: tutor.id, status: 'aktif' } },
        });
        if (schedules > 0) {
          throw ApiException.conflict(
            'active_schedule',
            `Masih ada ${schedules} jadwal les aktif.`,
            { schedules },
          );
        }
      }
    }
    const active = status === 'aktif';
    await this.prisma.user.update({
      where: { id },
      data: { isActive: active },
    });
    if (user.role === 'tutor') {
      await this.prisma.tutorProfile.updateMany({
        where: { userId: id },
        data: { isActive: active },
      });
    }
    return this.account(id);
  }

  async linkStudents(id: string, dto: LinkStudentsDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiException.notFound('Akun tidak ditemukan');
    if (user.role !== 'wali') {
      throw ApiException.unprocessable(
        'Hanya akun wali yang dapat ditautkan ke siswa',
      );
    }
    if (dto.siswaIds.length) {
      await this.prisma.student.updateMany({
        where: { id: { in: dto.siswaIds } },
        data: { parentId: id },
      });
    }
    return this.account(id);
  }

  async linkableStudents() {
    const rows = await this.prisma.student.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(linkedStudent);
  }

  // =====================================================================
  // Rekap & Riwayat Les
  // =====================================================================

  async lessonRecap(filter: {
    month?: string;
    tutorId?: string;
    studentId?: string;
  }) {
    const now = new Date();
    const current = monthStart(now);
    const active = filter.month ? parseMonth(filter.month) : current;
    const pairFilter: any = {};
    if (filter.tutorId) pairFilter.tutorId = filter.tutorId;
    if (filter.studentId) pairFilter.studentId = filter.studentId;
    const where: any = {
      start: { gte: active, lte: monthEnd(active) },
      status: { not: 'dibatalkan' },
    };
    if (Object.keys(pairFilter).length) where.pair = pairFilter;

    const lessons = await this.prisma.lessonSession.findMany({
      where,
      include: {
        attendance: true,
        pair: {
          include: {
            tutor: { include: { user: true } },
            student: true,
          },
        },
      },
      orderBy: { start: 'desc' },
    });

    const sessions = lessons
      .filter((lesson) => lesson.start <= now)
      .map((lesson) => {
        const record = lesson.attendance;
        const status = record
          ? record.held === false
            ? 'tidak_terlaksana'
            : record.validation
          : 'belum_dikumpulkan';
        const topic =
          record && record.held !== false && record.topic ? record.topic : null;
        return {
          id: lesson.id,
          date: lesson.start,
          subject: lesson.subject,
          topic,
          tutorId: lesson.pair.tutorId,
          tutorName: lesson.pair.tutor.user.name,
          studentId: lesson.pair.studentId,
          studentName: lesson.pair.student.name,
          status,
        };
      });

    const held = sessions.filter((s) => s.status !== 'tidak_terlaksana');
    const missed = sessions.filter((s) => s.status === 'tidak_terlaksana');
    const tutorGroups = new Map<string, typeof sessions>();
    const studentGroups = new Map<string, typeof sessions>();
    for (const session of sessions) {
      tutorGroups.set(session.tutorId, [
        ...(tutorGroups.get(session.tutorId) ?? []),
        session,
      ]);
      studentGroups.set(session.studentId, [
        ...(studentGroups.get(session.studentId) ?? []),
        session,
      ]);
    }
    const [tutors, students] = await Promise.all([
      this.prisma.tutorProfile.findMany({
        where: { isActive: true },
        include: { user: true },
      }),
      this.prisma.student.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      months: [
        current,
        new Date(current.getFullYear(), current.getMonth() - 1, 1),
      ],
      month: active,
      tutorOptions: tutors
        .map((tutor) => ({ id: tutor.id, name: tutor.user.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      studentOptions: students.map((student) => ({
        id: student.id,
        name: student.name,
      })),
      held: held.length,
      missed: missed.length,
      pairs: new Set(
        sessions.map((s) => `${s.tutorId}|${s.studentId}`),
      ).size,
      byTutor: [...tutorGroups.values()]
        .map((list) => ({
          id: list[0].tutorId,
          name: list[0].tutorName,
          sessions: list.filter((s) => s.status !== 'tidak_terlaksana').length,
          missed: list.filter((s) => s.status === 'tidak_terlaksana').length,
          students: new Set(list.map((s) => s.studentId)).size,
        }))
        .sort(
          (a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name),
        ),
      byStudent: [...studentGroups.values()]
        .map((list) => ({
          id: list[0].studentId,
          name: list[0].studentName,
          sessions: list.filter((s) => s.status !== 'tidak_terlaksana').length,
          missed: list.filter((s) => s.status === 'tidak_terlaksana').length,
          tutors: [...new Set(list.map((s) => s.tutorName))],
        }))
        .sort(
          (a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name),
        ),
      sessions: sessions.sort(
        (a, b) =>
          b.date.getTime() - a.date.getTime() ||
          a.studentName.localeCompare(b.studentName),
      ),
    };
  }

  // =====================================================================
  // Laporan Keuangan
  // =====================================================================

  async financeSummary(month?: string) {
    const now = new Date();
    const current = monthStart(now);
    const active = month ? parseMonth(month) : current;
    const months = financeMonths(current);
    const bills = await this.prisma.bill.findMany({
      where: { period: { gte: active, lte: monthEnd(active) } },
      include: {
        items: true,
        payments: true,
        student: { include: { parent: true } },
      },
    });
    if (!bills.length) {
      return { state: 'kosong', months, month: active };
    }
    const statuses = bills.map((bill) => billStatus(bill));
    const allPayments = bills.flatMap((bill) => bill.payments);
    const successful = allPayments.filter(
      (payment) => payment.status === 'berhasil',
    );
    const billsTotal = bills.reduce((sum, bill) => sum + billTotal(bill), 0);
    const recap = await this.prisma.honorRecap.findUnique({
      where: { month: monthKey(active) },
      include: { lines: { include: { payment: true } } },
    });

    let honor: {
      total: number;
      sessions: number;
      tutors: number;
      calculated: boolean;
    };
    let honorPaid: { amount: number; tutors: number };
    if (recap) {
      const lines = recap.lines;
      honor = {
        total: lines.reduce((sum, line) => sum + line.total, 0),
        sessions: lines.reduce((sum, line) => sum + line.sessions, 0),
        tutors: lines.length,
        calculated: true,
      };
      honorPaid = {
        amount: lines.reduce(
          (sum, line) => sum + Math.min(line.payment?.amount ?? 0, line.total),
          0,
        ),
        tutors: lines.filter(
          (line) => line.payment && line.payment.amount >= line.total,
        ).length,
      };
    } else {
      const finals = await this.finalLessons(active);
      const grouped = new Map<
        string,
        { rate: number | null; sessions: number }
      >();
      for (const lesson of finals) {
        const tutor = lesson.pair.tutor;
        const entry = grouped.get(tutor.id) ?? {
          rate: tutor.ratePerSession,
          sessions: 0,
        };
        entry.sessions += 1;
        grouped.set(tutor.id, entry);
      }
      const entries = [...grouped.values()];
      const priced = entries.filter((entry) => entry.rate !== null);
      honor = {
        total: priced.reduce(
          (sum, entry) => sum + entry.sessions * (entry.rate ?? 0),
          0,
        ),
        sessions: entries.reduce((sum, entry) => sum + entry.sessions, 0),
        tutors: priced.length,
        calculated: false,
      };
      honorPaid = { amount: 0, tutors: 0 };
    }

    return {
      state: 'ada',
      months,
      month: active,
      bills: {
        total: billsTotal,
        count: bills.length,
        lunas: statuses.filter((status) => status === 'lunas').length,
        sebagian: statuses.filter((status) => status === 'sebagian').length,
        belum: statuses.filter((status) => status === 'belum_bayar').length,
      },
      payments: {
        received: successful.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        ),
        transactions: successful.length,
        failed: allPayments.filter((payment) => payment.status !== 'berhasil')
          .length,
      },
      honor,
      honorPaid,
      institutionShare: billsTotal - honor.total,
    };
  }

  async studentBills(month?: string) {
    const now = new Date();
    const current = monthStart(now);
    const active = month ? parseMonth(month) : current;
    const bills = await this.prisma.bill.findMany({
      where: { period: { gte: active, lte: monthEnd(active) } },
      include: { items: true, payments: true, student: true },
    });
    const rows = bills.map((bill) => {
      const total = billTotal(bill);
      const paid = billPaid(bill);
      return {
        id: bill.id,
        studentName: bill.student.name,
        sessions: bill.items.reduce((sum, item) => sum + item.sessions, 0),
        dueDate: bill.dueDate,
        total,
        remaining: Math.max(total - paid, 0),
        status: billStatus(bill),
      };
    });
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const remaining = rows.reduce((sum, row) => sum + row.remaining, 0);
    const byRemaining = (a: any, b: any) => b.remaining - a.remaining;
    return {
      months: financeMonths(current),
      month: active,
      total,
      paid: total - remaining,
      remaining,
      unpaid: rows
        .filter((row) => row.status === 'belum_bayar')
        .sort(byRemaining),
      partial: rows.filter((row) => row.status === 'sebagian').sort(byRemaining),
      paidOff: rows
        .filter((row) => row.status === 'lunas')
        .sort((a, b) => a.studentName.localeCompare(b.studentName)),
    };
  }

  async studentBill(id: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        student: { include: { parent: true } },
      },
    });
    if (!bill) throw ApiException.notFound('Tagihan tidak ditemukan');
    return serializeStudentBill(bill);
  }

  async recordManualPayment(
    userId: string,
    id: string,
    dto: ManualPaymentDto,
  ) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        student: { include: { parent: true } },
      },
    });
    if (!bill) throw ApiException.notFound('Tagihan tidak ditemukan');
    const total = billTotal(bill);
    const paid = billPaid(bill);
    const remaining = Math.max(total - paid, 0);
    if (dto.amount <= 0 || dto.amount > remaining) {
      throw ApiException.unprocessable(
        'Nominal pembayaran tidak valid',
        { remaining },
      );
    }
    await this.prisma.paymentTransaction.create({
      data: {
        billId: id,
        billPeriod: bill.period,
        amount: dto.amount,
        method: dto.method,
        status: 'berhasil',
        paidAt: new Date(dto.paidAt),
        ...(dto.proof ? { manual: { proof: dto.proof } } : {}),
      },
    });
    const newPaid = paid + dto.amount;
    const status =
      newPaid >= total ? 'lunas' : newPaid > 0 ? 'sebagian' : 'belum_bayar';
    await this.prisma.bill.update({
      where: { id },
      data: { paid: newPaid, status },
    });
    await this.notifications.create(bill.student.parentId, {
      kind: 'pembayaran',
      title: 'Pembayaran tagihan diterima',
      body: `Rp${dto.amount.toLocaleString('id-ID')} · ${bill.number}`,
      to: '/wali/tagihan',
    });
    return this.studentBill(id);
  }

  async generateReport(userId: string, dto: ReportDto) {
    const active = parseMonth(dto.month);
    const file = await this.reports.generate(active, dto.type, dto.format);
    const saved = await this.storage.saveBuffer(
      file.buffer,
      file.name,
      file.mime,
      userId,
    );
    return { name: saved.name, size: saved.size, url: saved.url };
  }

  // =====================================================================
  // Pengaturan Notifikasi
  // =====================================================================

  async notificationSettings() {
    const rows = await this.prisma.notificationSetting.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(serializeNotificationSetting);
  }

  async notificationSetting(id: string) {
    const row = await this.prisma.notificationSetting.findUnique({
      where: { id },
    });
    if (!row) throw ApiException.notFound('Pengaturan tidak ditemukan');
    return serializeNotificationSetting(row);
  }

  async saveNotificationSetting(id: string, dto: SettingInputDto) {
    const row = await this.prisma.notificationSetting.findUnique({
      where: { id },
    });
    if (!row) throw ApiException.notFound('Pengaturan tidak ditemukan');
    if (dto.template !== undefined) {
      const used = [...dto.template.matchAll(/\{([^{}]*)\}/g)].map((match) =>
        match[1].trim(),
      );
      const unknown = [
        ...new Set(used.filter((name) => !row.variables.includes(name))),
      ];
      if (unknown.length) {
        throw ApiException.unprocessable(
          `Variabel ${unknown.map((name) => `{${name}}`).join(', ')} tidak dikenal.`,
          { variables: unknown },
        );
      }
    }
    const updated = await this.prisma.notificationSetting.update({
      where: { id },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
        ...(dto.timing !== undefined ? { timing: dto.timing } : {}),
        ...(dto.template !== undefined ? { template: dto.template } : {}),
      },
    });
    return serializeNotificationSetting(updated);
  }

  // =====================================================================
  // Riwayat Notifikasi
  // =====================================================================

  async notificationLogs(filter: {
    status?: string;
    kind?: string;
    period?: string;
  }) {
    const rows = await this.prisma.notificationLog.findMany({
      orderBy: { sentAt: 'desc' },
    });
    const now = new Date();
    const period = filter.period ?? 'bulan-ini';
    const list = rows
      .filter(
        (log) =>
          inPeriod(log.resentAt ?? log.sentAt, period, now) &&
          (!filter.kind || log.kind === filter.kind),
      )
      .sort(
        (a, b) =>
          (b.resentAt ?? b.sentAt).getTime() -
          (a.resentAt ?? a.sentAt).getTime(),
      );
    return {
      failed:
        filter.status === 'terkirim'
          ? []
          : list
              .filter((log) => log.status === 'gagal')
              .map(serializeNotificationLog),
      sent:
        filter.status === 'gagal'
          ? []
          : list
              .filter((log) => log.status === 'terkirim')
              .map(serializeNotificationLog),
    };
  }

  async notificationLog(id: string) {
    const row = await this.prisma.notificationLog.findUnique({
      where: { id },
    });
    if (!row) throw ApiException.notFound('Log notifikasi tidak ditemukan');
    return serializeNotificationLog(row);
  }

  async resendNotification(id: string) {
    const row = await this.prisma.notificationLog.findUnique({
      where: { id },
    });
    if (!row) throw ApiException.notFound('Log notifikasi tidak ditemukan');
    const now = new Date();
    if (row.permanent) {
      await this.prisma.notificationLog.update({
        where: { id },
        data: { attempts: row.attempts + 1, lastAttemptAt: now },
      });
      throw ApiException.conflict(
        'resend_failed',
        `Kirim ulang gagal: ${row.reason ?? 'kontak tidak valid'}.`,
        { reason: row.reason ?? 'kontak tidak valid', permanent: true },
      );
    }
    const updated = await this.prisma.notificationLog.update({
      where: { id },
      data: {
        attempts: row.attempts + 1,
        lastAttemptAt: now,
        status: 'terkirim',
        reason: null,
        reasonShort: null,
        resentAt: now,
      },
    });
    return serializeNotificationLog(updated);
  }

  async resendAllNotifications(dto: ResendAllDto) {
    const now = new Date();
    const rows = await this.prisma.notificationLog.findMany({
      where: { status: 'gagal', ...(dto.jenis ? { kind: dto.jenis } : {}) },
    });
    const targets = dto.periode
      ? rows.filter((log) => inPeriod(log.sentAt, dto.periode!, now))
      : rows;
    const sent: string[] = [];
    let stillFailed = 0;
    for (const log of targets) {
      if (log.permanent) {
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: { attempts: log.attempts + 1, lastAttemptAt: now },
        });
        stillFailed += 1;
        continue;
      }
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          attempts: log.attempts + 1,
          lastAttemptAt: now,
          status: 'terkirim',
          reason: null,
          reasonShort: null,
          resentAt: now,
        },
      });
      const recipients = Array.isArray(log.recipients)
        ? (log.recipients as any[])
        : [];
      sent.push(recipients.map((recipient) => recipient.name).join(', '));
    }
    return { sent, stillFailed };
  }

  // =====================================================================
  // Helper akun
  // =====================================================================

  private async assertUniqueAccount(
    email?: string,
    username?: string,
    excludeId?: string,
  ) {
    if (email) {
      const found = await this.prisma.user.findUnique({ where: { email } });
      if (found && found.id !== excludeId) {
        throw ApiException.conflict(
          'duplicate_field',
          'Email sudah dipakai akun lain.',
          { field: 'email' },
        );
      }
    }
    if (username) {
      const found = await this.prisma.user.findUnique({
        where: { username },
      });
      if (found && found.id !== excludeId) {
        throw ApiException.conflict(
          'duplicate_field',
          'Username sudah dipakai akun lain.',
          { field: 'username' },
        );
      }
    }
  }

  private async uniqueUsername(base: string) {
    const slug =
      base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '') || 'pengguna';
    let candidate = slug;
    let suffix = 1;
    while (
      await this.prisma.user.findUnique({ where: { username: candidate } })
    ) {
      candidate = `${slug}${suffix}`;
      suffix += 1;
    }
    return candidate;
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

  private async requireWaitingOffer(id: string) {
    const offer = await this.prisma.tutorOffer.findUnique({
      where: { id },
      include: this.offerInclude,
    });
    if (!offer) throw ApiException.notFound('Penawaran tidak ditemukan');
    if (offer.status !== 'menunggu_konfirmasi') {
      throw ApiException.conflict(
        'already_answered',
        'Jawaban tutor sudah dicatat.',
      );
    }
    return offer;
  }

  private async buildOfferDraft(registration: any) {
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { id: registration.matchedTutorId },
      include: { user: true },
    });
    if (!tutor) throw ApiException.notFound('Tutor tidak ditemukan');
    const overrides = (tutor.distanceOverrides ?? {}) as Record<string, number>;
    const distanceKm =
      overrides[registration.id] ?? tutor.defaultDistanceKm ?? 0;
    const requestedSlots = registration.days.map(
      (day: string) => `${day} ${registration.startTime}`,
    );
    const slots = await this.prisma.pairSession.findMany({
      where: {
        pair: { tutorId: tutor.id, status: 'aktif' },
        OR: registration.days.map((day: string) => ({
          dayOfWeek: dayIndex(day),
          startTime: registration.startTime,
        })),
      },
    });
    const takenSlot = slots.length ? requestedSlots[0] : null;
    return {
      registration: serializePengelolaRegistration(registration),
      registrationId: registration.id,
      student: {
        name: registration.studentName,
        grade: registration.grade,
        level: registration.level,
      },
      tutor: {
        id: tutor.id,
        name: tutor.user.name,
        shortName: tutor.shortName,
      },
      subjects: registration.subjects,
      schedule: formatRequestedSchedule(registration),
      location: formatShortAddress(registration.address).split(',')[0],
      distanceKm,
      rate: tutor.ratePerSession ?? 0,
      takenSlot,
    };
  }

  private async findScheduleConflict(draft: any, sessions: any[]) {
    for (let index = 0; index < sessions.length; index += 1) {
      const session = sessions[index];
      for (let prior = 0; prior < index; prior += 1) {
        if (overlaps(sessions[prior], session, BUFFER_MINUTES)) {
          return { index, with: 'sesi', other: sessions[prior] };
        }
      }
    }
    const others = await this.prisma.pair.findMany({
      where: {
        status: 'aktif',
        ...(draft.pairId ? { id: { not: draft.pairId } } : {}),
      },
      include: {
        sessions: true,
        student: true,
        tutor: { include: { user: true } },
      },
    });
    for (let index = 0; index < sessions.length; index += 1) {
      const session = sessions[index];
      for (const pair of others) {
        for (const existing of pair.sessions) {
          if (
            !overlaps(
              {
                start: existing.startTime,
                end: existing.endTime,
                ...{ day: existing.day },
              },
              session,
              BUFFER_MINUTES,
            )
          ) {
            continue;
          }
          if (pair.tutorId === draft.tutor?.id) {
            return {
              index,
              with: 'tutor',
              other: {
                subject: existing.subject,
                day: existing.day,
                start: existing.startTime,
                end: existing.endTime,
                studentName: pair.student.name,
              },
            };
          }
          if (pair.student.name === draft.student?.name) {
            return {
              index,
              with: 'siswa',
              other: {
                subject: existing.subject,
                day: existing.day,
                start: existing.startTime,
                end: existing.endTime,
                tutorName: pair.tutor.user.name,
              },
            };
          }
        }
      }
    }
    return null;
  }

  private buildChangeReview(request: any) {
    const pair = request.pair;
    const fromSession = {
      subject: request.subject,
      day: dayName(request.fromWeekday),
      start: request.fromStartTime,
      end: addMinutesToTime(request.fromStartTime, request.durationMinutes),
    };
    const toSession = {
      subject: request.subject,
      day: dayName(request.toWeekday),
      start: request.toStartTime,
      end: addMinutesToTime(request.toStartTime, request.durationMinutes),
    };
    const remaining = (pair?.sessions ?? []).filter(
      (session: any) =>
        !(
          session.day === fromSession.day &&
          session.startTime === fromSession.start
        ),
    );
    const internal = [...remaining, toSession];
    let conflict: any = null;
    for (let index = 0; index < internal.length; index += 1) {
      for (let prior = 0; prior < index; prior += 1) {
        const a = toSchedule(internal[prior]);
        const b = toSchedule(internal[index]);
        if (overlaps(a, b, BUFFER_MINUTES)) {
          conflict = { index: 0, with: 'sesi', other: b };
        }
      }
    }
    return {
      request: serializeChangeRequestForReview(request),
      pair: pair ? serializePair(pair) : undefined,
      fromSession,
      toSession,
      conflict,
    };
  }

  private async syncLessons(pairId: string) {
    const pair = await this.prisma.pair.findUnique({
      where: { id: pairId },
      include: { sessions: true },
    });
    if (!pair) return;
    const now = new Date();
    await this.prisma.lessonSession.deleteMany({
      where: {
        pairId,
        start: { gte: now },
        attendance: null,
      },
    });
    const rows: any[] = [];
    const lower = pair.effectiveFrom > now ? startOfDay(pair.effectiveFrom) : now;
    for (const session of pair.sessions) {
      const first = nextDateForDay(session.dayOfWeek, addDays(lower, -1));
      for (let week = 0; week < 8; week += 1) {
        const date = addDays(first, week * 7);
        const start = dateAtTime(date, session.startTime);
        if (start <= now || start < pair.effectiveFrom) continue;
        rows.push({
          pairId,
          subject: session.subject,
          start,
          end: dateAtTime(date, session.endTime),
        });
      }
    }
    if (rows.length) {
      await this.prisma.lessonSession.createMany({ data: rows });
    }
  }

  private async finalLessons(month: Date) {
    return this.prisma.lessonSession.findMany({
      where: {
        start: { gte: month, lte: monthEnd(month) },
        attendance: { finalizedAt: { not: null } },
      },
      include: {
        attendance: true,
        pair: {
          include: {
            tutor: { include: { user: true } },
            student: { include: { parent: true } },
          },
        },
      },
    });
  }

  private async finalProgress(month: Date) {
    const lessons = await this.prisma.lessonSession.findMany({
      where: { start: { gte: month, lte: monthEnd(month) } },
      include: { attendance: true },
    });
    const started = lessons.filter((lesson) => lesson.start <= new Date());
    return {
      final: started.filter((lesson) => lesson.attendance?.finalizedAt).length,
      total: started.length,
    };
  }

  private async attendanceMonths() {
    const lessons = await this.prisma.lessonSession.findMany({
      select: { start: true },
    });
    return uniqueMonths(lessons.map((lesson) => lesson.start));
  }

  private async honorMonths() {
    const recaps = await this.prisma.honorRecap.findMany({
      select: { month: true },
    });
    const lessons = await this.prisma.lessonSession.findMany({
      select: { start: true },
    });
    const keys = new Set<string>([
      monthKey(new Date()),
      ...recaps.map((recap) => recap.month),
      ...lessons.map((lesson) => monthKey(lesson.start)),
    ]);
    return [...keys]
      .sort((a, b) => b.localeCompare(a))
      .map((key) => parseMonth(key));
  }
}

function evaluateTutor(tutor: any, registration: any) {
  const level = registration.level;
  const subjects = registration.subjects;
  const days = registration.days;
  const startTime = registration.startTime;
  const teachesLevel = tutor.levels.includes(level);
  const covered = teachesLevel
    ? subjects.filter((subject: string) => tutor.subjects.includes(subject))
    : [];
  const missing = subjects.filter(
    (subject: string) => !covered.includes(subject),
  );
  const subjectCriterion =
    missing.length === 0
      ? { label: `${joinAnd(subjects)} ${level}`, met: true }
      : covered.length > 0
        ? {
            label: `${joinAnd(covered)} ${level} · belum mengajar ${joinAnd(missing)}`,
            met: false,
          }
        : { label: `Belum mengajar ${joinAnd(subjects)} ${level}`, met: false };
  const start = timeToMinutes(startTime);
  const fitsTime =
    start >= timeToMinutes(tutor.availableFrom) &&
    start + 90 <= timeToMinutes(tutor.availableUntil);
  const openDays = fitsTime
    ? days.filter((day: string) => tutor.days.includes(day))
    : [];
  const dayCriterion =
    openDays.length === days.length
      ? { label: `Tersedia ${joinAnd(days)}, ${startTime}`, met: true }
      : openDays.length > 0
        ? { label: `Hanya tersedia ${joinAnd(openDays)}`, met: false }
        : { label: `Tidak tersedia ${joinAnd(days)}, ${startTime}`, met: false };
  const overrides = (tutor.distanceOverrides ?? {}) as Record<string, number>;
  const distance = overrides[registration.id] ?? tutor.defaultDistanceKm;
  const near = distance <= 5;
  const distanceCriterion = near
    ? { label: `Jarak ${km(distance)} km dari alamat les`, met: true }
    : {
        label: `Jarak ${km(distance)} km · di atas batas 5 km`,
        met: false,
      };
  const subjectRatio = subjects.length
    ? covered.length / subjects.length
    : 0;
  const dayRatio = days.length ? openDays.length / days.length : 0;
  const distancePoints = near ? 20 - distance * 2 : Math.max(0, 10 - distance);
  const ratingPoints = Math.max(0, (tutor.rating - 4.5) * 20);
  const score = Math.round(
    Math.min(
      100,
      subjectRatio * 40 + dayRatio * 30 + distancePoints + ratingPoints,
    ),
  );
  const criteria = [subjectCriterion, dayCriterion, distanceCriterion];
  return {
    tutorId: tutor.id,
    name: displayName(tutor.user.name),
    shortName: tutor.shortName,
    initials: tutor.initials || initials(tutor.user.name),
    education: tutor.education ?? '',
    rating: tutor.rating,
    activeStudents: tutor.pairs.length,
    criteria,
    score,
    fullMatch: criteria.every((criterion) => criterion.met),
    hidden: subjectCriterion.label.startsWith('Belum mengajar'),
  };
}

function draftFromPair(pair: any) {
  const sessions = pair.sessions.map((session: any) => ({
    subject: session.subject,
    day: session.day,
    start: session.startTime,
    end: session.endTime,
  }));
  const next = sessions[0]
    ? nextDateForDay(dayIndex(sessions[0].day))
    : new Date();
  return {
    pairId: pair.id,
    offerId: pair.offerId ?? undefined,
    student: {
      name: pair.student.name,
      grade: pair.student.grade,
      level: pair.student.level,
    },
    parentName: pair.student.parent?.name ?? '',
    tutor: {
      id: pair.tutorId,
      name: pair.tutor.user.name,
      shortName: pair.tutor.shortName,
    },
    subjects: pair.subjects,
    sessions,
    effectiveFrom: pair.effectiveFrom < new Date() ? next : pair.effectiveFrom,
  };
}

function serializeHonorLine(line: any) {
  return {
    tutorId: line.tutorId,
    name: line.name,
    shortName: line.shortName,
    lines: Array.isArray(line.subjectLines) ? line.subjectLines : [],
    sessions: line.sessions,
    total: line.total,
    method: line.method,
    methodNote: line.methodNote ?? undefined,
    ...(line.payment
      ? {
          payment: {
            amount: line.payment.amount,
            method: line.payment.method,
            paidAt: line.payment.paidAt,
            proof: {
              name: line.payment.proofName ?? '',
              size: line.payment.proofSize ?? 0,
            },
            recordedAt: line.payment.recordedAt,
          },
        }
      : {}),
  };
}

function honorStatus(line: any) {
  if (!line.payment) return 'belum_bayar';
  return line.payment.amount >= line.total ? 'lunas' : 'sebagian';
}

function isPaid(honor: any) {
  return !!honor.payment && honor.payment.amount >= honor.total;
}

function toSchedule(session: any) {
  return {
    day: session.day,
    start: session.start ?? session.startTime,
    end: session.end ?? session.endTime,
  };
}

function parseMonth(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiException.unprocessable('Bulan tidak valid');
  }
  return monthStart(date);
}

function uniqueMonths(dates: Date[]) {
  const keys = new Set<number>([
    monthStart(new Date()).getTime(),
    ...dates.map((date) => monthStart(date).getTime()),
  ]);
  return [...keys].sort((a, b) => b - a).map((time) => new Date(time));
}

function displayName(name: string) {
  return /^kak\s/i.test(name) ? name : `Kak ${name}`;
}

function joinAnd(items: string[]) {
  return items.length <= 2
    ? items.join(' & ')
    : `${items.slice(0, -1).join(', ')} & ${items.at(-1)}`;
}

function km(value: number) {
  return value.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}

function byActive(a: any, b: any) {
  if (a.isActive === b.isActive) return 0;
  return a.isActive ? -1 : 1;
}

function normalizeKak(name: string) {
  const trimmed = name.trim();
  return /^kak\s/i.test(trimmed) ? trimmed : `Kak ${trimmed}`;
}

function shortNameOf(name: string) {
  const cleaned = name.replace(/^kak\s+/i, '');
  const first = cleaned.split(/\s+/)[0] ?? cleaned;
  return `Kak ${first}`;
}

function financeMonths(current: Date) {
  return [
    new Date(current.getFullYear(), current.getMonth() + 1, 1),
    current,
    new Date(current.getFullYear(), current.getMonth() - 1, 1),
  ];
}

function serializeNotificationSetting(row: any) {
  return {
    id: row.id,
    group: row.group,
    title: row.title,
    screenTitle: row.screenTitle,
    recipient: row.recipient,
    trigger: row.trigger,
    activeNote: row.activeNote,
    enabled: row.enabled,
    channel: row.channel,
    timing: row.timing,
    template: row.template,
    variables: row.variables,
    sample: row.sample,
    previewNote: row.previewNote,
  };
}

function serializeNotificationLog(row: any) {
  return {
    id: row.id,
    kind: row.kind,
    channel: row.channel,
    recipients: row.recipients,
    sentAt: row.sentAt,
    status: row.status,
    message: row.message,
    attempts: row.attempts,
    lastAttemptAt: row.lastAttemptAt,
    ...(row.reason ? { reason: row.reason } : {}),
    ...(row.reasonShort ? { reasonShort: row.reasonShort } : {}),
    ...(row.permanent ? { permanent: true } : {}),
    ...(row.resentAt ? { resentAt: row.resentAt } : {}),
  };
}

function inPeriod(date: Date, period: string, now = new Date()) {
  if (period === 'hari-ini') return isSameDay(date, now);
  if (period === '7-hari') {
    return date >= addDays(startOfDay(now), -6);
  }
  if (period === 'bulan-ini') {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }
  if (period === 'bulan-lalu') {
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      date.getFullYear() === previous.getFullYear() &&
      date.getMonth() === previous.getMonth()
    );
  }
  return true;
}
