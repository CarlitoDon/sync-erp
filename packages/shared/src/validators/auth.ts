import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email format');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[A-Za-z])(?=.*\d).+$/,
    'Password must include letters and numbers'
  );

export const registerSchema = z.object({
  email: emailSchema,
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long'),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(32, 'Invalid verification token'),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationSchema = z.infer<
  typeof resendVerificationSchema
>;
