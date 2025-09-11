import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (typeof UserRole)[keyof typeof UserRole][]) =>
  SetMetadata(ROLES_KEY, roles);
