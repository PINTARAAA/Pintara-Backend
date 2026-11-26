import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * Jenis notifikasi dalam aplikasi. Union ini mencakup seluruh jenis yang
 * dipetakan ke ikon oleh frontend per peran:
 *   - wali      : validasi | tagihan | jadwal | pembayaran | les
 *   - tutor     : presensi | keberatan | pengingat | rekap | honor
 *   - pengelola : pendaftaran | perubahan-jadwal | notifikasi-gagal |
 *                 keberatan | penawaran | pembayaran
 */
export type NotificationKind =
  | 'validasi'
  | 'tagihan'
  | 'jadwal'
  | 'pembayaran'
  | 'les'
  | 'presensi'
  | 'keberatan'
  | 'pengingat'
  | 'rekap'
  | 'honor'
  | 'pendaftaran'
  | 'perubahan-jadwal'
  | 'notifikasi-gagal'
  | 'penawaran';

export interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  to: string;
  status?: string;
}

export type LogNotificationKind =
  | 'pengingat-jadwal'
  | 'pengingat-presensi'
  | 'pendaftaran-baru'
  | 'hasil-verifikasi'
  | 'penawaran-tutor'
  | 'keberatan-presensi'
  | 'rekap-honor';

export type NotificationChannel = 'whatsapp' | 'email' | 'aplikasi';
export type NotificationLogStatus = 'terkirim' | 'gagal';

export interface NotificationRecipient {
  name: string;
  role: 'tutor' | 'wali' | 'pengelola';
  contact: string;
  accountId?: string;
}

export interface NotificationLogInput {
  kind: LogNotificationKind;
  channel: NotificationChannel;
  recipients: NotificationRecipient[];
  message: string;
  status?: NotificationLogStatus;
  attempts?: number;
  reason?: string;
  reasonShort?: string;
  permanent?: boolean;
  sentAt?: Date;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: NotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        to: input.to,
        status: input.status ?? null,
      },
    });
  }

  async notifyRole(role: string, input: NotificationInput) {
    const users = await this.prisma.user.findMany({
      where: { role, isActive: true },
      select: { id: true },
    });
    if (!users.length) return;
    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        kind: input.kind,
        title: input.title,
        body: input.body,
        to: input.to,
        status: input.status ?? null,
      })),
    });
  }

  /** Catat riwayat pengiriman (P13) untuk sebuah kejadian notifikasi. */
  async logEvent(input: NotificationLogInput) {
    const now = new Date();
    return this.prisma.notificationLog.create({
      data: {
        kind: input.kind,
        channel: input.channel,
        recipients: input.recipients as any,
        message: input.message,
        status: input.status ?? 'terkirim',
        attempts: input.attempts ?? 1,
        sentAt: input.sentAt ?? now,
        lastAttemptAt: input.sentAt ?? now,
        reason: input.reason ?? null,
        reasonShort: input.reasonShort ?? null,
        permanent: input.permanent ?? false,
      },
    });
  }

  async failedCount() {
    return this.prisma.notificationLog.count({ where: { status: 'gagal' } });
  }

  async list(userId: string) {
    const items = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const mapped = items.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      read: Boolean(item.readAt),
      to: item.to,
      ...(item.status ? { status: item.status } : {}),
    }));
    return {
      unread: mapped.filter((item) => !item.read),
      read: mapped.filter((item) => item.read),
    };
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}