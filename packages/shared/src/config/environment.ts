/**
 * Environment Configuration Validator
 *
 * This file validates and logs all critical environment variables needed for
 * service-to-service communication in the Sync ERP ecosystem.
 *
 * Environment Variable Mapping:
 * - BOT_SECRET: Used by bot service and services authenticating with bot/API
 *   Default (dev): "dev_bot_secret_key_2026"
 *   Set in Railway/Vercel: Required in production
 *
 * - SYNC_ERP_API_URL: URL to sync-erp API backend
 *   Default (dev): "http://localhost:3001/api/trpc"
 *   Production: "https://sync-erp-api-production.up.railway.app/api/trpc"
 *
 * - API_KEY: Local service authentication (for santi-living)
 *   Default: "santi_secret_auth_token_2026"
 */

export class EnvironmentValidator {
  private static isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  private static logWarning(varName: string, message: string): void {
    // eslint-disable-next-line no-console
    console.warn(`⚠️  [ENV] ${varName}: ${message}`);
  }

  private static logInfo(varName: string, value: string): void {
    // eslint-disable-next-line no-console
    console.log(
      `✅ [ENV] ${varName}: ${
        value ? `***${value.slice(-4)}` : 'EMPTY'
      }`
    );
  }

  /**
   * Validate BOT_SECRET - Critical for service authentication
   * Priority: BOT_SECRET > SYNC_ERP_API_KEY > default
   */
  static getAuthSecret(fallback = ''): string {
    const botSecret = process.env.BOT_SECRET;
    const syncErpApiKey = process.env.SYNC_ERP_API_KEY;
    const hasBotSecret = Boolean(botSecret);
    const hasSyncErpKey = Boolean(syncErpApiKey);

    if (hasBotSecret) {
      this.logInfo('BOT_SECRET (Primary)', botSecret!);
      return botSecret!;
    }

    if (hasSyncErpKey) {
      this.logWarning(
        'SYNC_ERP_API_KEY',
        'Using deprecated SYNC_ERP_API_KEY. Please migrate to BOT_SECRET.'
      );
      this.logInfo('SYNC_ERP_API_KEY (Legacy)', syncErpApiKey!);
      return syncErpApiKey!;
    }

    if (this.isDevelopment()) {
      this.logInfo(
        'BOT_SECRET',
        'Using default dev key (dev_bot_secret_key_2026)'
      );
      return fallback;
    }

    this.logWarning(
      'BOT_SECRET',
      '❌ MISSING in Production! Services cannot authenticate.'
    );
    return fallback;
  }

  /**
   * Validate SYNC_ERP_API_URL
   */
  static getApiUrl(
    fallback = 'http://localhost:3001/api/trpc'
  ): string {
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
   * Validate API_KEY (local service authentication)
   */
  static getApiKey(fallback = ''): string {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      if (!this.isDevelopment()) {
        this.logWarning(
          'API_KEY',
          '❌ MISSING in Production! Local API authentication will fail.'
        );
      } else {
        // Quiet in dev unless needed
      }
    } else {
      this.logInfo('API_KEY', apiKey);
    }

    return apiKey || fallback;
  }

  /**
   * Print full environment configuration summary
   */
  static logConfiguration(): void {
    // eslint-disable-next-line no-console
    console.log('\n========================================');
    // eslint-disable-next-line no-console
    console.log('📋 Environment Configuration Summary');
    // eslint-disable-next-line no-console
    console.log('========================================');

    // eslint-disable-next-line no-console
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

    // Auth Methods
    // eslint-disable-next-line no-console
    console.log('\n🔐 Authentication:');
    this.getAuthSecret('dev_bot_secret_key_2026');
    this.getApiKey();

    // API URLs
    // eslint-disable-next-line no-console
    console.log('\n🌐 API Endpoints:');
    this.getApiUrl();

    // eslint-disable-next-line no-console
    console.log('\n========================================\n');
  }
}

// Auto-log on module load (dev only)
if (process.env.LOG_ENV_ON_LOAD !== 'false') {
  EnvironmentValidator.logConfiguration();
}

export default EnvironmentValidator;
