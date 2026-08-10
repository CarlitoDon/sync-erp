import { PrismaClient } from './generated/client/client.js';

export function assertDisposableDatabase(prisma: PrismaClient) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not defined.');
  }

  // Allow localhost (usually test containers)
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return;
  }

  // Allow explicit disposable marker
  if (process.env.ALLOW_DISPOSABLE_DATABASE === 'true') {
    return;
  }

  // Deny everything else that looks like production or non-test URLs
  // This is a simple guard - add more robust checks if needed
  if (url.includes('supabase.co') && !url.includes('test')) {
    throw new Error('Security Error: Attempted to run tests against a production or staging database URL.');
  }
}
