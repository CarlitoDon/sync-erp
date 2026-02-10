/**
 * Auth Policy
 *
 * Enforces authentication and authorization rules.
 * All methods are stateless and unit-testable.
 *
 * Pattern: Policy.ensure*() throws DomainError if constraint violated.
 */

import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * AuthPolicy - Validation rules for authentication operations.
 */
export class AuthPolicy {
  /**
   * Ensure email format is valid.
   */
  static ensureValidEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new DomainError(
        'Invalid email format',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure password meets minimum requirements.
   */
  static ensureValidPassword(password: string): void {
    if (!password || password.length < 8) {
      throw new DomainError(
        'Password must be at least 8 characters long',
        400,
        DomainErrorCodes.INVALID_INPUT
      );
    }
  }

  /**
   * Ensure user exists for login.
   */
  static ensureUserExists(user: unknown, email: string): void {
    if (!user) {
      throw new DomainError(
        `Email ${email} tidak terdaftar. Silakan daftar akun baru atau periksa kembali email Anda.`,
        401,
        DomainErrorCodes.FORBIDDEN
      );
    }
  }

  /**
   * Ensure password is correct.
   */
  static ensurePasswordValid(isValid: boolean): void {
    if (!isValid) {
      throw new DomainError(
        'Password salah. Silakan coba lagi.',
        401,
        DomainErrorCodes.FORBIDDEN
      );
    }
  }

  /**
   * Ensure email is not already registered.
   */
  static ensureEmailNotTaken(existingUser: unknown): void {
    if (existingUser) {
      throw new DomainError(
        'Email already exists',
        409,
        DomainErrorCodes.ALREADY_EXISTS
      );
    }
  }

  /**
   * Ensure session is valid and not expired.
   */
  static ensureValidSession(
    session: { expiresAt?: Date } | null
  ): void {
    if (!session) {
      throw new DomainError(
        'Session not found',
        401,
        DomainErrorCodes.FORBIDDEN
      );
    }
    if (session.expiresAt && new Date() > session.expiresAt) {
      throw new DomainError(
        'Session has expired',
        401,
        DomainErrorCodes.FORBIDDEN
      );
    }
  }
}
