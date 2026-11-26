import { HttpException } from '@nestjs/common';

export class ApiException extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }

  static badRequest(message = 'Permintaan tidak valid', details?: unknown) {
    return new ApiException(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Silakan login terlebih dahulu') {
    return new ApiException(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Anda tidak memiliki akses untuk aksi ini') {
    return new ApiException(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Data tidak ditemukan') {
    return new ApiException(404, 'NOT_FOUND', message);
  }

  static conflict(code: string, message: string, details?: unknown) {
    return new ApiException(409, code, message, details);
  }

  static unprocessable(message = 'Data tidak dapat diproses', details?: unknown) {
    return new ApiException(422, 'VALIDATION_ERROR', message, details);
  }
}
