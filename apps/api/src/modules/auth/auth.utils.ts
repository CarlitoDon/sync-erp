import { hash, compare } from 'bcrypt';
import crypto from 'crypto';

export async function hashPassword(
  password: string
): Promise<string> {
  return hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return compare(password, hash);
}

export function generateEmailVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashEmailVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
