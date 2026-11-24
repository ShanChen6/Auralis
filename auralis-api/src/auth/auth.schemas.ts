import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email('Email không hợp lệ').max(255).toLowerCase(),
  username: z
    .string()
    .regex(
      /^[a-z0-9_]{3,30}$/,
      'Tên đăng nhập 3–30 ký tự: chữ thường, số, gạch dưới',
    ),
  displayName: z
    .string()
    .trim()
    .min(2, 'Tên hiển thị tối thiểu 2 ký tự')
    .max(60),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  /** Email hoặc tên đăng nhập */
  login: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;
