import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface NotificationInput {
  kind: 'validasi' | 'tagihan' | 'jadwal' | 'pembayaran' | 'les';
  title: string;
  body: string;
  to: string;
  status?: string;
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
