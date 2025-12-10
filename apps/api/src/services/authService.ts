import { prisma } from '@sync-erp/database';
import { RegisterPayload, LoginPayload } from '@sync-erp/shared';
import { hashPassword, comparePassword } from './authUtil.js';
import { createSession } from './sessionService.js';
import { User, Session } from '@prisma/client';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: {
    code: string;
    message: string;
  };
}

export async function register(payload: RegisterPayload): Promise<AuthResult> {
  const { email, password, name } = payload;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return {
      success: false,
      error: { code: 'CONFLICT', message: 'Email already exists' },
    };
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hashedPassword,
    },
  });

  // Create session (auto-login)
  const session = await createSession(user.id);

  return {
    success: true,
    user,
    session,
  };
}

export async function login(payload: LoginPayload): Promise<AuthResult> {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } };
  }

  const isValid = await comparePassword(password, user.passwordHash);

  if (!isValid) {
    return { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } };
  }

  const session = await createSession(user.id);

  return {
    success: true,
    user,
    session,
  };
}

export async function logout(_sessionId: string) {
  // Moved to separate file or here? T020 says implement logout logic here.
  // Assuming imported from sessionService or just calling deleteSession.
  // But keeping it empty if not needed yet for T010/T015.
  // T020 is Phase 5.
}
