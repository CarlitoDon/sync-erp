import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GoogleOAuthService } from '../../src/modules/auth/google-oauth.service';

const managedEnvKeys = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'SYNC_ERP_AUTH_STATE_SECRET',
  'SYNC_ERP_API_BASE_URL',
  'SYNC_ERP_API_URL',
  'VITE_SYNC_ERP_API_URL',
  'SYNC_ERP_API_SECRET',
  'NODE_ENV',
] as const;

const originalEnv = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]])
);

function resetManagedEnv() {
  for (const key of managedEnvKeys) {
    const originalValue = originalEnv.get(key);
    if (originalValue === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = originalValue;
  }
}

describe('GoogleOAuthService', () => {
  beforeEach(() => {
    resetManagedEnv();
    for (const key of managedEnvKeys) {
      delete process.env[key];
    }
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    resetManagedEnv();
  });

  it('reports missing Google OAuth client settings', () => {
    process.env.SYNC_ERP_AUTH_STATE_SECRET = 'state-secret';
    process.env.GOOGLE_OAUTH_CLIENT_ID =
      'replace_with_google_oauth_client_id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET =
      'replace_with_google_oauth_client_secret';

    const service = new GoogleOAuthService();

    expect(service.isConfigured()).toBe(false);
    expect(service.getMissingConfigKeys()).toEqual([
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
    ]);

    process.env.GOOGLE_OAUTH_CLIENT_ID = 'change-me-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET =
      'change' + 'me-client-secret';

    expect(service.isConfigured()).toBe(false);
    expect(service.getMissingConfigKeys()).toEqual([
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
    ]);

    process.env.GOOGLE_OAUTH_CLIENT_ID = 'change_me_client_id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'change_me_client_secret';

    expect(service.isConfigured()).toBe(true);
  });

  it('allows SYNC_ERP_API_SECRET as a development-only state secret fallback', () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.SYNC_ERP_API_SECRET = 'local-api-secret';

    const service = new GoogleOAuthService();

    expect(service.isConfigured()).toBe(true);

    process.env.NODE_ENV = 'production';

    expect(service.isConfigured()).toBe(false);
    expect(service.getMissingConfigKeys()).toEqual([
      'SYNC_ERP_AUTH_STATE_SECRET',
    ]);
  });

  it('derives the callback URL from the configured API base URL', () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.SYNC_ERP_AUTH_STATE_SECRET = 'state-secret';
    process.env.SYNC_ERP_API_BASE_URL = 'http://localhost:3001';

    const service = new GoogleOAuthService();

    const { authorizationUrl, state } =
      service.createAuthorizationUrl('register');
    const url = new URL(authorizationUrl);

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3001/api/auth/google/callback'
    );
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(service.validateState(state)).toMatchObject({
      intent: 'register',
    });
  });
});
