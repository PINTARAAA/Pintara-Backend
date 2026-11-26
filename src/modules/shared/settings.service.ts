import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string, fallback = ''): Promise<string> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row?.value ?? fallback;
  }

  async getMany(keys: string[]): Promise<Record<string, string>> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: keys } },
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async lbbContact() {
    const settings = await this.getMany([
      'lbb_name',
      'lbb_whatsapp',
      'lbb_display',
    ]);
    return {
      name: settings.lbb_name ?? 'Pengelola LBB Jelajah Ilmu',
      whatsapp: settings.lbb_whatsapp ?? '6281234567890',
      display: settings.lbb_display ?? '0812-3456-7890',
    };
  }

  async appVersion(): Promise<string> {
    return this.get('app_version', '1.0.0');
  }
}
