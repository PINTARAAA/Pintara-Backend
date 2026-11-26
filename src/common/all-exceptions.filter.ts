import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { ApiException } from './errors';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiException) {
      const body = exception.getResponse() as any;
      response.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: body.message,
          ...(exception.details !== undefined ? { details: exception.details } : {}),
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;
      const message =
        typeof body === 'string'
          ? body
          : Array.isArray(body?.message)
            ? body.message.join(', ')
            : (body?.message ?? exception.message);
      response.status(status).json({
        error: { code: body?.code ?? statusToCode(status), message },
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = Array.isArray(exception.meta?.target)
          ? exception.meta.target.join(', ')
          : String(exception.meta?.target ?? '');
        response.status(409).json({
          error: {
            code: 'CONFLICT',
            message: `Data dengan ${target || 'nilai'} tersebut sudah ada`,
          },
        });
        return;
      }
      if (exception.code === 'P2025') {
        response.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan' },
        });
        return;
      }
      if (exception.code === 'P2003') {
        response.status(409).json({
          error: {
            code: 'RELATION_CONFLICT',
            message: 'Data masih terhubung dengan data lain',
          },
        });
        return;
      }
    }

    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'Terjadi kesalahan pada server'
            : (exception as Error)?.message ?? 'Terjadi kesalahan pada server',
      },
    });
  }
}

function statusToCode(status: number) {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'ERROR';
  }
}
