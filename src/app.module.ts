import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { env } from './config/env';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RedisThrottlerStorage } from './infrastructure/redis/redis-throttler.storage';
import { StorageModule } from './infrastructure/storage/storage.module';
import { SharedModule } from './modules/shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { WaliModule } from './modules/wali/wali.module';
import { TutorModule } from './modules/tutor/tutor.module';
import { PengelolaModule } from './modules/pengelola/pengelola.module';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [
          { name: 'default', ttl: env.throttleTtlMs, limit: env.throttleLimit },
          { name: 'auth', ttl: env.throttleTtlMs, limit: env.authThrottleLimit },
        ],
        storage,
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    SharedModule,
    AuthModule,
    HealthModule,
    WaliModule,
    TutorModule,
    PengelolaModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
