import { ValidationPipe } from '@nestjs/common';

export function createValidationPipe() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
    exceptionFactory: (errors) => {
      const details: { field: string; message: string }[] = [];
      const walk = (list: any[], parent = '') => {
        for (const error of list) {
          const field = parent ? `${parent}.${error.property}` : error.property;
          if (error.constraints) {
            details.push({
              field,
              message: Object.values(error.constraints)[0] as string,
            });
          }
          if (error.children?.length) walk(error.children, field);
        }
      };
      walk(errors);
      const { ApiException } = require('./errors');
      return new ApiException(
        422,
        'VALIDATION_ERROR',
        'Data yang dikirim tidak valid',
        details,
      );
    },
  });
}
