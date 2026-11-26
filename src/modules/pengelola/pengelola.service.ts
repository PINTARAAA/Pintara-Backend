import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../shared/notifications.service';
import { SettingsService } from '../shared/settings.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
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
} from '../../common/utils';
import {
  ChangeDecisionDto,
  DeclineOfferDto,
  ObjectionReviewDto,
  PayHonorDto,
  RejectRegistrationDto,
  SaveScheduleDto,
  SendOfferDto,
} from './pengelola.dto';

const BUFFER_MINUTES = 15;

@Injectable()
export class PengelolaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
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
    const [user, tutorsTotal, tutorsActive, studentsTotal, studentsActive] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.tutorProfile.count(),
        this.prisma.tutorProfile.count({ where: { isActive: true } }),
        this.prisma.student.count(),
        this.prisma.student.count({ where: { isActive: true } }),
      ]);
    return {
      name: user?.name ?? '',
      initials: initials(user?.name ?? ''),
      role: 'Pengelola LBB',
      email: user?.email ?? '',
      tutors: { total: tutorsTotal, active: tutorsActive },
      students: { total: studentsTotal, active: studentsActive },
      failedNotifications: 0,
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
      to: `/wali/pendaftaran/${updated.id}`,
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
      to: `/wali/pendaftaran/${updated.id}`,
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
      kind: 'les',
      title: 'Penawaran mengajar baru',
      body: `${offer.studentName} · ${offer.schedule}`,
      to: '/tutor/dashboard',
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
      to: `/wali/pendaftaran/${updated.registrationId}`,
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
      kind: 'jadwal',
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
      to: '/wali/riwayat-les',
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
