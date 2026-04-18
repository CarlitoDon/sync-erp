import '../src/di-setup'; // Register DI services
import { vi, beforeEach } from 'vitest';

// Enums are now loaded dynamically in the mock factory to avoid hoisting issues

// Only import and setup mocks for unit tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockPrisma: any;
let resetMocks: () => void = () => {};

// Import mocks dynamically for unit tests
const setupMocks = async () => {
  try {
    const prismaMock = await import('./unit/mocks/prisma.mock');
    mockPrisma = prismaMock.mockPrisma;
    resetMocks = prismaMock.resetMocks;
  } catch {
    // Integration tests don't need mocks
  }
};

// Mock @sync-erp/database only for unit tests
vi.mock('@sync-erp/database', async (importOriginal) => {
  // Check current test file path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = (globalThis as Record<string, unknown>).__vitest_worker__ as Record<string, unknown> | undefined;
  const filepath = (state?.filepath as string) || '';

  // Unit tests get mocked prisma
  if (filepath.includes('/test/unit/')) {
    const { mockPrisma: mp } =
      await import('./unit/mocks/prisma.mock');
    const Enums = await import('./unit/mocks/enums');
    return {
      prisma: mp,
      ...Enums,
      Prisma: {},
    };
  }

  // Integration/e2e tests get real database
  const original = await importOriginal();
  return original;
});

// Re-export for test files
export { mockPrisma, resetMocks };

beforeEach(async () => {
  await setupMocks();
  if (resetMocks) resetMocks();
});
