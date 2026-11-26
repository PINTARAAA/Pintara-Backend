import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export type AppRole = 'wali' | 'tutor' | 'pengelola';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: AppRole;
  email?: string | null;
  whatsapp?: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
