import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ApiException } from '../../common/errors';
import { AuthUser } from '../../common/decorators';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async waliStudent(userId: string, studentId?: string) {
    if (studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, parentId: userId },
      });
      if (!student) throw ApiException.notFound('Siswa tidak ditemukan');
      return student;
    }
    const student = await this.prisma.student.findFirst({
      where: { parentId: userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!student) throw ApiException.notFound('Siswa tidak ditemukan');
    return student;
  }

  async waliStudents(userId: string) {
    return this.prisma.student.findMany({
      where: { parentId: userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async tutorProfile(userId: string) {
    const tutor = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!tutor) throw ApiException.forbidden('Profil tutor tidak ditemukan');
    return tutor;
  }

  async sessionForUser(user: AuthUser, sessionId: string) {
    const session = await this.prisma.lessonSession.findUnique({
      where: { id: sessionId },
      include: {
        attendance: true,
        pair: {
          include: {
            student: { include: { parent: true } },
            tutor: { include: { user: true } },
          },
        },
      },
    });
    if (!session) throw ApiException.notFound('Sesi tidak ditemukan');

    if (user.role === 'pengelola') return session;
    if (user.role === 'wali' && session.pair.student.parentId === user.id) {
      return session;
    }
    if (user.role === 'tutor' && session.pair.tutor.userId === user.id) {
      return session;
    }
    throw ApiException.forbidden('Anda tidak memiliki akses ke sesi ini');
  }

  async pairForUser(user: AuthUser, pairId: string) {
    const pair = await this.prisma.pair.findUnique({
      where: { id: pairId },
      include: {
        student: { include: { parent: true } },
        tutor: { include: { user: true } },
        sessions: true,
      },
    });
    if (!pair) throw ApiException.notFound('Jadwal tidak ditemukan');
    if (user.role === 'pengelola') return pair;
    if (user.role === 'wali' && pair.student.parentId === user.id) return pair;
    if (user.role === 'tutor' && pair.tutor.userId === user.id) return pair;
    throw ApiException.forbidden('Anda tidak memiliki akses ke jadwal ini');
  }
}
