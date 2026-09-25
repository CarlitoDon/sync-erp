import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBotConfig, isTestNumber } from '../../src/config/bot.config';

describe('Bot Configuration & Test Numbers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.BOT_WHITELIST_ENABLED;
    delete process.env.WHITELIST_ENABLED;
    delete process.env.STAFF_PROTECTION_ENABLED;
    delete process.env.BOT_IGNORE_STAFF;
    delete process.env.AUTO_TAKEOVER_ENABLED;
    delete process.env.BOT_AUTO_TAKEOVER;
    delete process.env.BOT_TEST_NUMBERS;
    delete process.env.TEST_CUSTOMER_PHONES;
    delete process.env.ALLOWED_CUSTOMER_PHONES;
    delete process.env.CARLA_WEBHOOK_URL;
    delete process.env.RARA_WEBHOOK_URL;
    delete process.env.WHATSAPP_DEBOUNCE_MS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Defaults', () => {
    it('provides sensible defaults when env is unset', () => {
      const config = getBotConfig();
      expect(config.whitelistEnabled).toBe(true);
      expect(config.staffProtectionEnabled).toBe(true);
      expect(config.autoTakeoverEnabled).toBe(true);
      expect(config.testNumbers.size).toBe(0);
      expect(config.allowedCustomerPhones.size).toBe(0);
      expect(config.webhookUrl).toBe('http://localhost:8045/webhook/rara');
      expect(config.debounceMs).toBe(7000);
    });
  });

  describe('Whitelist toggle', () => {
    it('disables whitelist when BOT_WHITELIST_ENABLED is false', () => {
      process.env.BOT_WHITELIST_ENABLED = 'false';
      expect(getBotConfig().whitelistEnabled).toBe(false);
    });

    it('supports alias WHITELIST_ENABLED', () => {
      process.env.WHITELIST_ENABLED = '0';
      expect(getBotConfig().whitelistEnabled).toBe(false);
    });
  });

  describe('Staff protection toggle', () => {
    it('disables staff protection when STAFF_PROTECTION_ENABLED is false', () => {
      process.env.STAFF_PROTECTION_ENABLED = 'false';
      expect(getBotConfig().staffProtectionEnabled).toBe(false);
    });
  });

  describe('Auto takeover toggle', () => {
    it('disables auto takeover when AUTO_TAKEOVER_ENABLED is false', () => {
      process.env.AUTO_TAKEOVER_ENABLED = 'false';
      expect(getBotConfig().autoTakeoverEnabled).toBe(false);
    });
  });

  describe('Webhook URL resolution', () => {
    it('prioritizes CARLA_WEBHOOK_URL over RARA_WEBHOOK_URL', () => {
      process.env.CARLA_WEBHOOK_URL = 'http://carla:8645/webhook';
      process.env.RARA_WEBHOOK_URL = 'http://rara:8045/webhook';
      expect(getBotConfig().webhookUrl).toBe('http://carla:8645/webhook');
    });

    it('uses RARA_WEBHOOK_URL if CARLA_WEBHOOK_URL is not set', () => {
      process.env.RARA_WEBHOOK_URL = 'http://rara:8045/webhook';
      expect(getBotConfig().webhookUrl).toBe('http://rara:8045/webhook');
    });
  });

  describe('Test numbers & isTestNumber', () => {
    it('identifies tester numbers in local and international formats', () => {
      process.env.BOT_TEST_NUMBERS = '085158858310, +62 812-9999-8888';
      const config = getBotConfig();
      expect(config.testNumbers.has('6285158858310')).toBe(true);
      expect(config.testNumbers.has('6281299998888')).toBe(true);

      expect(isTestNumber('085158858310')).toBe(true);
      expect(isTestNumber('6285158858310')).toBe(true);
      expect(isTestNumber('6285158858310@s.whatsapp.net')).toBe(true);
      expect(isTestNumber('081299998888')).toBe(true);

      expect(isTestNumber('081111111111')).toBe(false);
      expect(isTestNumber('')).toBe(false);
      expect(isTestNumber(null)).toBe(false);
    });
  });
});
