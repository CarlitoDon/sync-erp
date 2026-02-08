/**
 * Environment Configuration Validator
 *
 * Standardized environment variable names for Sync ERP ecosystem:
 * - SYNC_ERP_API_SECRET: Authentication for sync-erp API
 * - SYNC_ERP_BOT_SECRET: Authentication for sync-erp Bot
 * - SYNC_ERP_API_URL: URL to sync-erp API
 * - SYNC_ERP_BOT_URL: URL to sync-erp Bot
 */

export type ServiceName =
  | 'api'
  | 'bot'
  | 'web'
  | 'proxy'
  | 'database'
  | 'unknown';

export class EnvironmentValidator {
  private serviceName: ServiceName;

  constructor(serviceName: ServiceName = 'unknown') {
    this.serviceName = serviceName;
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  private logWarning(varName: string, message: string): void {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  [ENV:${this.serviceName}] ${varName}: ${message}`
    );
  }

  private logInfo(varName: string, value: string): void {
    // eslint-disable-next-line no-console
    console.log(
      `✅ [ENV:${this.serviceName}] ${varName}: ${
        value ? `***${value.slice(-4)}` : 'EMPTY'
      }`
    );
  }

  /**
   * Get SYNC_ERP_API_SECRET - Authentication for sync-erp API
   */
  getApiSecret(fallback = ''): string {
    const secret = process.env.SYNC_ERP_API_SECRET;

    if (secret) {
      this.logInfo('SYNC_ERP_API_SECRET', secret);
      return secret;
    }

    if (this.isDevelopment()) {
      this.logInfo(
        'SYNC_ERP_API_SECRET',
        'Using default dev key (dev_sync_erp_secret_key_2026)'
      );
      return fallback || 'dev_sync_erp_secret_key_2026';
    }

    this.logWarning(
      'SYNC_ERP_API_SECRET',
      '❌ MISSING in Production! Services cannot authenticate.'
    );
    return fallback;
  }

  /**
   * Get SYNC_ERP_BOT_SECRET - Authentication for sync-erp Bot
   */
  getBotSecret(fallback = ''): string {
    const secret = process.env.SYNC_ERP_BOT_SECRET;

    if (secret) {
      this.logInfo('SYNC_ERP_BOT_SECRET', secret);
      return secret;
    }

    if (this.isDevelopment()) {
      this.logInfo(
        'SYNC_ERP_BOT_SECRET',
        'Using default dev key (dev_bot_secret_key_2026)'
      );
      return fallback || 'dev_bot_secret_key_2026';
    }

    this.logWarning(
      'SYNC_ERP_BOT_SECRET',
      '❌ MISSING in Production! Bot authentication will fail.'
    );
    return fallback;
  }

  /**
   * Get SYNC_ERP_API_URL
   */
  getApiUrl(fallback = 'http://localhost:3001/api/trpc'): string {
    const url = process.env.SYNC_ERP_API_URL;

    if (!url) {
      if (!this.isDevelopment()) {
        this.logWarning(
          'SYNC_ERP_API_URL',
          '❌ MISSING in Production! TRPC Client cannot connect to API.'
        );
      } else {
        this.logInfo(
          'SYNC_ERP_API_URL',
          `Using default dev URL (${fallback})`
        );
      }
      return fallback;
    }

    this.logInfo('SYNC_ERP_API_URL', url);
    return url;
  }

  /**
   * Get SYNC_ERP_BOT_URL
   */
  getBotUrl(fallback = 'http://localhost:3000'): string {
    const url = process.env.SYNC_ERP_BOT_URL;

    if (!url) {
      if (!this.isDevelopment()) {
        this.logWarning(
          'SYNC_ERP_BOT_URL',
          '❌ MISSING in Production! Cannot connect to Bot service.'
        );
      } else {
        this.logInfo(
          'SYNC_ERP_BOT_URL',
          `Using default dev URL (${fallback})`
        );
      }
      return fallback;
    }

    this.logInfo('SYNC_ERP_BOT_URL', url);
    return url;
  }

  /**
   * Print full environment configuration summary
   */
  logConfiguration(): void {
    // eslint-disable-next-line no-console
    console.log(`\n========================================`);
    // eslint-disable-next-line no-console
    console.log(`📋 Environment Configuration [${this.serviceName}]`);
    // eslint-disable-next-line no-console
    console.log('========================================');

    // eslint-disable-next-line no-console
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

    // Auth Methods
    // eslint-disable-next-line no-console
    console.log('\n🔐 Authentication:');
    this.getApiSecret();
    this.getBotSecret();

    // API URLs
    // eslint-disable-next-line no-console
    console.log('\n🌐 API Endpoints:');
    this.getApiUrl();
    this.getBotUrl();

    // eslint-disable-next-line no-console
    console.log('\n========================================\n');
  }
}

/**
 * Create an environment validator for a specific service
 */
export function createEnvValidator(
  serviceName: ServiceName
): EnvironmentValidator {
  return new EnvironmentValidator(serviceName);
}
