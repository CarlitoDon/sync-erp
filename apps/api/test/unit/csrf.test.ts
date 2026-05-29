import { describe, expect, it } from 'vitest';
import { generateCsrfToken } from '../../src/middlewares/csrf';

describe('CSRF Middleware', () => {
  describe('generateCsrfToken', () => {
    it('generates a 64-character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates unique tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });
});
