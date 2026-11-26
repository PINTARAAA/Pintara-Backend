import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ApiException } from '../../common/errors';
import { LoginDto } from './login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
        ],
      },
    });

    if (!user) {
      throw new ApiException(401, 'invalid_credentials', 'Email atau password salah');
    }
    if (!user.isActive) {
      throw new ApiException(403, 'account_inactive', 'Akun Anda sedang dinonaktifkan');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new ApiException(401, 'invalid_credentials', 'Email atau password salah');
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      name: user.name,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      username: user.username,
      email: user.email,
      whatsapp: user.whatsapp,
      token,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiException.unauthorized('Akun tidak ditemukan');
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      username: user.username,
      email: user.email,
      whatsapp: user.whatsapp,
    };
  }

  async logout() {
    return { ok: true };
  }
}
