import { UserRole } from '../generated/prisma/enums.js';

/** Ban biên tập: được tạo audio (Radio AI / bản thu), duyệt bài, không bị giới hạn đăng bài */
export const STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.EDITOR];

export function isStaff(role: UserRole | undefined | null): boolean {
  return role != null && STAFF_ROLES.includes(role);
}
