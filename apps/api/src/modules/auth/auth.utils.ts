import { hash, compare } from 'bcrypt';

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
