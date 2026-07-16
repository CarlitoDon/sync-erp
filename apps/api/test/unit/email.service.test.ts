<<<<<<< HEAD
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
=======
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
>>>>>>> origin/dev
import { EmailService } from '../../src/modules/common/services/email.service';

describe('EmailService Unit', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses log provider by default', async () => {
    const service = new EmailService();
<<<<<<< HEAD
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
=======
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation(() => {});
>>>>>>> origin/dev

    const result = await service.sendVerificationEmail({
      to: 'user@example.com',
      name: 'User',
      verificationUrl: 'http://localhost:5173/verify-email?token=abc',
    });

    expect(result).toEqual({
      delivered: true,
      provider: 'log',
    });
    expect(logSpy).toHaveBeenCalled();
  });

  it('falls back to log provider when resend is configured without api key', async () => {
    process.env.SYNC_ERP_EMAIL_PROVIDER = 'resend';
    delete process.env.RESEND_API_KEY;
<<<<<<< HEAD
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
=======
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation(() => {});
>>>>>>> origin/dev
    const service = new EmailService();

    const result = await service.sendVerificationEmail({
      to: 'user@example.com',
      name: 'User',
      verificationUrl: 'http://localhost:5173/verify-email?token=abc',
    });

    expect(result).toEqual({
      delivered: true,
      provider: 'log',
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('fails in production when log provider is used', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SYNC_ERP_EMAIL_PROVIDER = 'log';
    const service = new EmailService();

    const result = await service.sendVerificationEmail({
      to: 'user@example.com',
      name: 'User',
<<<<<<< HEAD
      verificationUrl: 'https://app.sync-erp.com/verify-email?token=abc',
=======
      verificationUrl:
        'https://app.sync-erp.com/verify-email?token=abc',
>>>>>>> origin/dev
    });

    expect(result).toEqual({
      delivered: false,
      provider: 'log',
      error: 'Log email provider is not allowed in production.',
    });
  });

  it('fails in production when resend api key is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SYNC_ERP_EMAIL_PROVIDER = 'resend';
    delete process.env.RESEND_API_KEY;
    const service = new EmailService();

    const result = await service.sendVerificationEmail({
      to: 'user@example.com',
      name: 'User',
<<<<<<< HEAD
      verificationUrl: 'https://app.sync-erp.com/verify-email?token=abc',
=======
      verificationUrl:
        'https://app.sync-erp.com/verify-email?token=abc',
>>>>>>> origin/dev
    });

    expect(result).toEqual({
      delivered: false,
      provider: 'resend',
      error: 'RESEND_API_KEY is missing.',
    });
  });
});
