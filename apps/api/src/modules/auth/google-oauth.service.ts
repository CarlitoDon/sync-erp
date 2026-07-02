import crypto from 'crypto';

const GOOGLE_AUTH_BASE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL =
  'https://openidconnect.googleapis.com/v1/userinfo';
const STATE_TTL_MS = 10 * 60 * 1000;
const PLACEHOLDER_PATTERN =
  /^(your_|replace_|change-?me|placeholder)/i;

export type GoogleOAuthIntent = 'login' | 'register';

interface GoogleOAuthStatePayload {
  intent: GoogleOAuthIntent;
  nonce: string;
  issuedAt: number;
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface GoogleOAuthProfile {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

export class GoogleOAuthService {
  isConfigured(): boolean {
    return this.getMissingConfigKeys().length === 0;
  }

  getMissingConfigKeys(): string[] {
    const missingKeys: string[] = [];

    if (isMissingConfigValue(process.env.GOOGLE_OAUTH_CLIENT_ID)) {
      missingKeys.push('GOOGLE_OAUTH_CLIENT_ID');
    }
    if (
      isMissingConfigValue(process.env.GOOGLE_OAUTH_CLIENT_SECRET)
    ) {
      missingKeys.push('GOOGLE_OAUTH_CLIENT_SECRET');
    }
    if (isMissingConfigValue(this.getStateSecret())) {
      missingKeys.push('SYNC_ERP_AUTH_STATE_SECRET');
    }

    return missingKeys;
  }

  getWebAppUrl(): string {
    return (
      process.env.SYNC_ERP_WEB_URL ||
      process.env.VITE_SYNC_ERP_WEB_URL ||
      process.env.APP_URL ||
      'http://localhost:5173'
    );
  }

  getSuccessRedirectUrl(): string {
    return `${this.getWebAppUrl()}/select-company`;
  }

  getErrorRedirectUrl(
    intent: GoogleOAuthIntent,
    errorCode: string
  ): string {
    const path = intent === 'register' ? '/register' : '/login';
    const redirectUrl = new URL(`${this.getWebAppUrl()}${path}`);
    redirectUrl.searchParams.set('authError', errorCode);
    return redirectUrl.toString();
  }

  createAuthorizationUrl(intent: GoogleOAuthIntent) {
    const config = this.getConfig();
    const state = this.signState({
      intent,
      nonce: crypto.randomBytes(16).toString('hex'),
      issuedAt: Date.now(),
    });

    const url = new URL(GOOGLE_AUTH_BASE_URL);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');

    return {
      authorizationUrl: url.toString(),
      state,
    };
  }

  validateState(state: string): GoogleOAuthStatePayload {
    const [encodedPayload, signature] = state.split('.');
    if (!encodedPayload || !signature) {
      throw new Error('Invalid OAuth state.');
    }

    const expectedSignature = this.createStateSignature(encodedPayload);
    if (signature.length !== expectedSignature.length) {
      throw new Error('Invalid OAuth state signature.');
    }

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      throw new Error('Invalid OAuth state signature.');
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as GoogleOAuthStatePayload;

    const isIntentValid =
      payload.intent === 'login' || payload.intent === 'register';
    if (!isIntentValid) {
      throw new Error('Invalid OAuth intent.');
    }

    if (
      !payload.issuedAt ||
      Date.now() - payload.issuedAt > STATE_TTL_MS
    ) {
      throw new Error('OAuth state has expired.');
    }

    return payload;
  }

  async exchangeCodeForProfile(
    code: string
  ): Promise<GoogleOAuthProfile> {
    const config = this.getConfig();

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      }),
    });

    const tokenJson =
      (await tokenResponse.json()) as GoogleTokenResponse;

    if (!tokenResponse.ok || !tokenJson.access_token) {
      throw new Error(
        tokenJson.error_description ||
          tokenJson.error ||
          'Failed to exchange Google authorization code.'
      );
    }

    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        authorization: `Bearer ${tokenJson.access_token}`,
      },
    });

    const userInfo =
      (await userInfoResponse.json()) as GoogleUserInfoResponse;

    if (!userInfoResponse.ok || !userInfo.sub || !userInfo.email) {
      throw new Error('Failed to load Google account profile.');
    }

    return {
      subject: userInfo.sub,
      email: userInfo.email.trim().toLowerCase(),
      emailVerified: Boolean(userInfo.email_verified),
      name:
        userInfo.name?.trim() ||
        userInfo.given_name?.trim() ||
        userInfo.email.trim().toLowerCase(),
      givenName: userInfo.given_name,
      familyName: userInfo.family_name,
      picture: userInfo.picture,
    };
  }

  private signState(payload: GoogleOAuthStatePayload): string {
    const encodedPayload = Buffer.from(
      JSON.stringify(payload),
      'utf8'
    ).toString('base64url');

    return `${encodedPayload}.${this.createStateSignature(encodedPayload)}`;
  }

  private createStateSignature(encodedPayload: string): string {
    return crypto
      .createHmac('sha256', this.getConfig().stateSecret)
      .update(encodedPayload)
      .digest('hex');
  }

  private getHttpApiBaseUrl(): string {
    const configuredUrl =
      process.env.SYNC_ERP_API_BASE_URL ||
      process.env.SYNC_ERP_API_URL ||
      process.env.VITE_SYNC_ERP_API_URL ||
      'http://localhost:3001/api/trpc';

    const normalizedUrl = configuredUrl
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api\/trpc$/, '/api')
      .replace(/\/trpc$/, '');

    return normalizedUrl.endsWith('/api')
      ? normalizedUrl
      : `${normalizedUrl}/api`;
  }

  private getRedirectUri(): string {
    return (
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      `${this.getHttpApiBaseUrl()}/auth/google/callback`
    );
  }

  private getStateSecret(): string | undefined {
    if (
      !isMissingConfigValue(process.env.SYNC_ERP_AUTH_STATE_SECRET)
    ) {
      return process.env.SYNC_ERP_AUTH_STATE_SECRET;
    }

    const isProductionLike =
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'staging';
    if (isProductionLike) {
      return undefined;
    }

    return isMissingConfigValue(process.env.SYNC_ERP_API_SECRET)
      ? undefined
      : process.env.SYNC_ERP_API_SECRET;
  }

  private getConfig(): GoogleOAuthConfig {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = this.getRedirectUri();
    const stateSecret = this.getStateSecret();

    if (!isConfiguredValue(clientId)) {
      throw new Error(
        'Google OAuth is not configured. Missing client or state settings.'
      );
    }

    if (!isConfiguredValue(clientSecret)) {
      throw new Error(
        'Google OAuth is not configured. Missing client or state settings.'
      );
    }

    if (!isConfiguredValue(stateSecret)) {
      throw new Error(
        'Google OAuth is not configured. Missing client or state settings.'
      );
    }

    return {
      clientId,
      clientSecret,
      redirectUri,
      stateSecret,
    };
  }
}

function isMissingConfigValue(value: string | undefined): boolean {
  return !value || PLACEHOLDER_PATTERN.test(value.trim());
}

function isConfiguredValue(value: string | undefined): value is string {
  return !isMissingConfigValue(value);
}
