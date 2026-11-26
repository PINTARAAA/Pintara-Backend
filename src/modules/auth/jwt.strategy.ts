import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { env } from '../../config/env';
import { AuthUser, AppRole } from '../../common/decorators';
import { ApiException } from '../../common/errors';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        email: true,
        whatsapp: true,
        isActive: true,
      },
    });
    if (!user) throw ApiException.unauthorized('Akun tidak ditemukan');
    if (!user.isActive) {
      throw ApiException.forbidden('Akun Anda sedang dinonaktifkan');
    }
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role as AppRole,
      email: user.email,
      whatsapp: user.whatsapp,
    };
  }
}
