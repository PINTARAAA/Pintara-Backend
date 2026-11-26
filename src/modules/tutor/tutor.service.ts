import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AccessService } from '../shared/access.service';
import { NotificationsService } from '../shared/notifications.service';
import { SettingsService } from '../shared/settings.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import {
  serializeChangeRequest,
  serializeTutorSession,
} from '../shared/serializers';
import { ApiException } from '../../common/errors';
import {
  addDays,
  dayName,
  initials,
  isSameDay,
  monthEnd,
  monthStart,
  nextDateForDay,
  startOfDay,
  timeToMinutes,
} from '../../common/utils';
import { AttendanceDto, TutorChangeDto, TutorReviewDto } from './tutor.dto';

@Injectable()
export class TutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
  ) {}

  private lessonInclude = {
    attendance: true,
    pair: {
      include: {
        student: { include: { parent: true } },
        tutor: { include: { user: true } },
      },
    },
  } as const;

  async dashboard(userId: string) {
    const tutor = await this.access.tutorProfile(userId);
    const now = new Date();
    const lessons = await this.prisma.lessonSession.findMany({
      where: { pair: { tutorId: tutor.id, status: 'aktif' } },
      include: this.lessonInclude,
      orderBy: { start: 'asc' },
    });
    const next = lessons.find((lesson) => lesson.start > now) ?? null;
    const toFill = lessons.filter(
      (lesson) => !lesson.attendance && lesson.start <= now,
    );
    const disputed = lessons.filter(
      (lesson) => lesson.attendance?.validation === 'keberatan',
    );
    const upcoming = lessons
      .filter((lesson) => lesson.start > now)
      .slice(0, 4)
      .map((lesson) => ({
        id: lesson.id,
        subject: lesson.subject,
        studentName: lesson.pair.student.name,
        start: lesson.start,
        end: lesson.end,
      }));

    const activeMonth = monthStart(now);
    const inMonth = lessons.filter(
      (lesson) =>
        lesson.start >= activeMonth &&
        lesson.start <= monthEnd(now) &&
        lesson.start <= now,
    );
    const held = inMonth.filter((lesson) => lesson.attendance?.held);
    const validated = inMonth.filter(
      (lesson) => lesson.attendance?.validation === 'sudah_divalidasi',
    );
    const waiting = inMonth.filter(
      (lesson) => lesson.attendance?.validation === 'belum_divalidasi',
    );
    const disputedMonth = inMonth.filter(
      (lesson) => lesson.attendance?.validation === 'keberatan',
    );

    const tasks: any[] = [];
    if (toFill.length) {
      const first = toFill[0];
      tasks.push({
        id: 'presensi',
        icon: 'clipboard',
        title: `Isi presensi ${toFill.length} sesi`,
        description: `${first.subject} · ${first.pair.student.name} · ${first.start.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}`,
        to: '/tutor/presensi',
      });
    }
    if (disputed.length) {
      tasks.push({
        id: 'keberatan',
        icon: 'alert',
        title: `${disputed.length} presensi dikeberatan wali`,
        description: `${disputed[0].subject} · ${disputed[0].pair.student.name}`,
        to: '/tutor/presensi',
      });
    }

    const student = next?.pair.student;
    return {
      tutor: { name: displayName(tutor.user.name) },
      nextSession: next
        ? {
            id: next.id,
            subject: next.subject,
            start: next.start,
            end: next.end,
            student: {
              name: student?.name ?? '',
              initials: initials(student?.name ?? ''),
              grade: `Kelas ${student?.grade ?? ''}`,
            },
            address: student?.address ?? '',
          }
        : null,
      tasks,
      upcoming,
      recap: {
        month: now.toLocaleDateString('id-ID', { month: 'long' }),
        held: held.length,
        validated: validated.length,
        waitingParent: waiting.length,
        disputed: disputedMonth.length,
      },
    };
  }

  async account(userId: string) {
    const [tutor, contact, version] = await Promise.all([
      this.access.tutorProfile(userId),
      this.settings.lbbContact(),
      this.settings.appVersion(),
    ]);
    return {
      name: displayName(tutor.user.name),
      initials: tutor.initials || initials(tutor.user.name),
      role: 'Tutor',
      email: tutor.user.email ?? '',
      teaching: {
        subjects: tutor.subjects,
        levels: tutor.levels.join('–'),
        availability: `${tutor.days.join('–')}, ${tutor.availableFrom}–${tutor.availableUntil}`,
        rate: tutor.ratePerSession ?? 0,
      },
      lbbContact: contact,
      appVersion: version,
    };
  }

  async sessions(userId: string) {
    const tutor = await this.access.tutorProfile(userId);
    const now = new Date();
    const lessons = await this.prisma.lessonSession.findMany({
      where: { pair: { tutorId: tutor.id, status: 'aktif' } },
      include: this.lessonInclude,
      orderBy: { start: 'asc' },
    });
    const toFill = lessons
      .filter((lesson) => !lesson.attendance && lesson.start <= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const laterToday = lessons
      .filter(
        (lesson) =>
          !lesson.attendance && lesson.start > now && isSameDay(lesson.start, now),
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const filled = lessons
      .filter((lesson) => lesson.attendance)
      .sort((a, b) => b.start.getTime() - a.start.getTime());
    return {
      toFill: toFill.map(serializeTutorSession),
      laterToday: laterToday.map(serializeTutorSession),
      filled: filled.map(serializeTutorSession),
    };
  }

  async status(userId: string, month?: string) {
    const tutor = await this.access.tutorProfile(userId);
    const now = new Date();
    const active = month ? monthStart(new Date(month)) : monthStart(now);
    const lessons = await this.prisma.lessonSession.findMany({
      where: { pair: { tutorId: tutor.id } },
      include: this.lessonInclude,
      orderBy: { start: 'desc' },
    });
    const months = uniqueMonths(lessons.map((lesson) => lesson.start), now);
    const started = lessons.filter(
      (lesson) =>
        lesson.start >= active &&
        lesson.start <= monthEnd(active) &&
        lesson.start <= now,
    );
    const withStatus = (status: string) =>
      started
        .filter((lesson) => lesson.attendance?.validation === status)
        .map(serializeTutorSession);
    return {
      months,
      month: active,
      total: started.length,
      disputed: withStatus('keberatan'),
      waiting: withStatus('belum_divalidasi'),
      notCollected: started
        .filter((lesson) => !lesson.attendance)
        .map(serializeTutorSession),
      verified: withStatus('sudah_divalidasi'),
    };
  }

  async history(userId: string, month?: string, studentName?: string) {
    const tutor = await this.access.tutorProfile(userId);
    const now = new Date();
    const active = month ? monthStart(new Date(month)) : monthStart(now);
    const lessons = await this.prisma.lessonSession.findMany({
      where: { pair: { tutorId: tutor.id } },
      include: this.lessonInclude,
      orderBy: { start: 'desc' },
    });
    const students = [
      ...new Set(lessons.map((lesson) => lesson.pair.student.name)),
    ].sort();
    const selected =
      studentName && students.includes(studentName) ? studentName : null;
    const inMonth = lessons.filter(
      (lesson) =>
        lesson.start >= active &&
        lesson.start <= monthEnd(active) &&
        lesson.start <= now &&
        (!selected || lesson.pair.student.name === selected),
    );
    const held = inMonth.filter((lesson) => lesson.attendance?.held);
    const byStudent = new Map<string, number>();
    held.forEach((lesson) =>
      byStudent.set(
        lesson.pair.student.name,
        (byStudent.get(lesson.pair.student.name) ?? 0) + 1,
      ),
    );
    return {
      months: uniqueMonths(lessons.map((lesson) => lesson.start), now),
      month: active,
      students,
      student: selected,
      sessions: inMonth.map(serializeTutorSession),
      summary: {
        held: held.length,
        cancelled: inMonth.filter(
          (lesson) => lesson.attendance && !lesson.attendance.held,
        ).length,
        studentCount: new Set(inMonth.map((lesson) => lesson.pair.student.name))
          .size,
        byStudent: [...byStudent]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      },
    };
  }

  async session(userId: string, id: string) {
    const tutor = await this.access.tutorProfile(userId);
    const session = await this.prisma.lessonSession.findUnique({
      where: { id },
      include: this.lessonInclude,
    });
    if (!session || session.pair.tutorId !== tutor.id) {
      throw ApiException.notFound('Sesi tidak ditemukan');
    }
    const parent = session.pair.student.parent;
    const previous = await this.prisma.lessonSession.findFirst({
      where: {
        pair: { studentId: session.pair.studentId },
        start: { lt: session.start },
        attendance: { held: true },
      },
      include: { attendance: true },
      orderBy: { start: 'desc' },
    });
    return {
      ...serializeTutorSession(session),
      parent: {
        name: parent?.name ?? '',
        phone: parent?.whatsapp ?? '',
        whatsapp: (parent?.whatsapp ?? '').replace(/\D/g, '').replace(/^0/, '62'),
      },
      previous: previous
        ? {
            date: previous.start,
            subject: previous.subject,
            ...(previous.attendance?.topic
              ? { topic: previous.attendance.topic }
              : {}),
            ...(previous.attendance?.notes
              ? { notes: previous.attendance.notes }
              : {}),
          }
        : null,
    };
  }

  async submitAttendance(userId: string, id: string, dto: AttendanceDto) {
    const tutor = await this.access.tutorProfile(userId);
    const session = await this.prisma.lessonSession.findUnique({
      where: { id },
      include: this.lessonInclude,
    });
    if (!session || session.pair.tutorId !== tutor.id) {
      throw ApiException.notFound('Sesi tidak ditemukan');
    }
    if (session.attendance) {
      throw ApiException.conflict(
        'already_filled',
        'Presensi sesi ini sudah diisi',
      );
    }
    if (session.start > new Date()) {
      throw ApiException.badRequest(
        'not_started',
        'Sesi belum dimulai',
      );
    }
    if (!dto.held && !dto.cancelReason?.trim()) {
      throw ApiException.unprocessable(
        'Alasan pembatalan wajib diisi',
      );
    }
    const record = await this.prisma.attendanceRecord.create({
      data: dto.held
        ? {
            sessionId: id,
            held: true,
            actualStart: dto.actualStart ?? null,
            actualEnd: dto.actualEnd ?? null,
            studentPresent: dto.studentPresent ?? true,
            studentAttendance: dto.studentPresent === false ? 'Tidak hadir' : 'Hadir',
            tutorAttendance: 'Hadir',
            topic: dto.topic?.trim() ?? null,
            notes: dto.notes?.trim() ?? null,
            attachmentName: dto.attachment?.name ?? null,
            attachmentSize: dto.attachment?.size ?? null,
            validation: 'belum_divalidasi',
          }
        : {
            sessionId: id,
            held: false,
            cancelReason: dto.cancelReason?.trim() ?? null,
            validation: 'belum_divalidasi',
          },
    });
    const parentId = session.pair.student.parentId;
    await this.notifications.create(parentId, {
      kind: 'validasi',
      title: 'Presensi baru perlu divalidasi',
      body: `${session.subject} · ${session.pair.student.name}`,
      to: `/wali/absensi/${session.id}`,
    });
    return serializeTutorSession({ ...session, attendance: record });
  }

  async uploadDocumentation(userId: string, file: Express.Multer.File) {
    const saved = await this.storage.save(file, userId);
    return { name: saved.name, size: saved.size, url: saved.url };
  }

  async schedule(userId: string, week = 0) {
    const tutor = await this.access.tutorProfile(userId);
    const now = new Date();
    const active = Math.min(Math.max(Math.trunc(week) || 0, 0), 3);
    const weeks = Array.from({ length: 4 }, (_, index) => {
      const from = addDays(startOfDay(now), index * 7);
      return { from, to: addDays(from, 6) };
    });
    const from = weeks[active].from;
    const to = addDays(from, 7);
    const lessons = await this.prisma.lessonSession.findMany({
      where: {
        pair: { tutorId: tutor.id, status: 'aktif' },
        start: { gte: from, lt: to },
      },
      include: this.lessonInclude,
      orderBy: { start: 'asc' },
    });
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(from, index);
      const sessions = lessons
        .filter((lesson) => isSameDay(lesson.start, date))
        .map((lesson) => ({
          id: lesson.id,
          routineId: lesson.pairId,
          subject: lesson.subject,
          start: lesson.start,
          end: lesson.end,
          student: {
            name: lesson.pair.student.name,
            grade: `Kelas ${lesson.pair.student.grade} ${lesson.pair.student.level}`,
          },
          address: lesson.pair.student.address ?? '',
          shortAddress: (lesson.pair.student.address ?? '').split(',')[0],
        }));
      return { date, sessions };
    });
    return {
      week: active,
      weeks,
      days: days.filter((day) => day.sessions.length > 0),
      freeDays: days
        .filter((day) => day.sessions.length === 0)
        .map((day) => dayName(day.date.getDay())),
    };
  }

  async scheduleSession(userId: string, id: string) {
    return this.session(userId, id);
  }

  async submitChange(userId: string, dto: TutorChangeDto) {
    const tutor = await this.access.tutorProfile(userId);
    const pair = await this.prisma.pair.findFirst({
      where: { id: dto.routineId, tutorId: tutor.id },
      include: { student: { include: { parent: true } }, sessions: true },
    });
    if (!pair) throw ApiException.notFound('Jadwal tidak ditemukan');
    const routine =
      pair.sessions.find((session) => session.subject === pair.subjects[0]) ??
      pair.sessions[0];
    const toWeekday = dayIndexFromName(dto.day);
    const fromWeekday = routine?.dayOfWeek ?? toWeekday;
    const fromStartTime = routine?.startTime ?? dto.startTime;
    const request = await this.prisma.scheduleChangeRequest.create({
      data: {
        pairId: pair.id,
        routineId: routine?.id ?? null,
        studentId: pair.studentId,
        tutorId: tutor.id,
        subject: routine?.subject ?? pair.subjects[0] ?? '',
        durationMinutes: routine
          ? timeToMinutes(routine.endTime) - timeToMinutes(routine.startTime)
          : 90,
        fromWeekday,
        fromStartTime,
        toWeekday,
        toStartTime: dto.startTime,
        scope: dto.scope,
        effectiveDate:
          dto.scope === 'sekali'
            ? nextSessionDate(toWeekday, dto.startTime)
            : addDays(nextSessionDate(toWeekday, dto.startTime), 7),
        reason: dto.reason.trim(),
      },
      include: {
        tutor: { include: { user: true } },
        student: { include: { parent: true } },
      },
    });
    await this.notifications.notifyRole('pengelola', {
      kind: 'jadwal',
      title: 'Pengajuan perubahan jadwal dari tutor',
      body: `${request.student.name} · ${dayName(request.toWeekday)} ${request.toStartTime}`,
      to: `/pengelola/les/pengajuan/${request.id}`,
    });
    return serializeChangeRequest(request);
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

function displayName(name: string) {
  return /^kak\s/i.test(name) ? name : `Kak ${name}`;
}

function uniqueMonths(dates: Date[], now: Date) {
  const keys = new Set<number>([
    monthStart(now).getTime(),
    ...dates.map((date) => monthStart(date).getTime()),
  ]);
  return [...keys].sort((a, b) => b - a).map((time) => new Date(time));
}

function dayIndexFromName(name: string) {
  const map: Record<string, number> = {
    minggu: 0,
    senin: 1,
    selasa: 2,
    rabu: 3,
    kamis: 4,
    jumat: 5,
    sabtu: 6,
  };
  const key = name.trim().toLowerCase();
  if (!(key in map)) throw ApiException.unprocessable('Hari tidak valid');
  return map[key];
}

function nextSessionDate(dayOfWeek: number, startTime: string) {
  const date = nextDateForDay(dayOfWeek);
  const [hours, minutes] = startTime.split('.').map(Number);
  date.setHours(hours || 16, minutes || 0, 0, 0);
  return date;
}
