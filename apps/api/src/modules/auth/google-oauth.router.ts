import { Router } from 'express';
import type { CookieOptions, Request, Response } from 'express';
import { container, ServiceKeys } from '../common/di';
import { AuthService } from './auth.service';
import {
  GoogleOAuthService,
  type GoogleOAuthIntent,
} from './google-oauth.service';

const router = Router();
const authService = container.resolve<AuthService>(
  ServiceKeys.AUTH_SERVICE
);
const googleOAuthService = container.resolve<GoogleOAuthService>(
  ServiceKeys.GOOGLE_OAUTH_SERVICE
);

const GOOGLE_STATE_COOKIE = 'googleOAuthState';

function getSessionCookieOptions(): CookieOptions {
  const isSecureEnv =
    process.env.SECURE_COOKIES === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging';

  return {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: isSecureEnv ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function getStateCookieOptions(): CookieOptions {
  const isSecureEnv =
    process.env.SECURE_COOKIES === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging';

  return {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  };
}

function getAuthAuditContext(req: Request) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;
  const forwardedIp = forwardedValue?.split(',')[0]?.trim();

  return {
    correlationId:
      req.headers['x-correlation-id']?.toString() ||
      req.headers['x-request-id']?.toString(),
    ipAddress:
      forwardedIp ||
      req.ip ||
      req.socket.remoteAddress ||
      undefined,
    userAgent: req.headers['user-agent']?.toString(),
  };
}

function getIntentFromQuery(rawIntent: unknown): GoogleOAuthIntent {
  return rawIntent === 'register' ? 'register' : 'login';
}

function redirectWithError(
  res: Response,
  intent: GoogleOAuthIntent,
  errorCode: string
) {
  res.redirect(
    302,
    googleOAuthService.getErrorRedirectUrl(intent, errorCode)
  );
}

router.get('/start', (req, res) => {
  const intent = getIntentFromQuery(req.query.intent);

  if (!googleOAuthService.isConfigured()) {
    redirectWithError(res, intent, 'google_oauth_not_configured');
    return;
  }

  const { authorizationUrl, state } =
    googleOAuthService.createAuthorizationUrl(intent);

  res.cookie(
    GOOGLE_STATE_COOKIE,
    state,
    getStateCookieOptions()
  );
  res.redirect(302, authorizationUrl);
});

router.get('/callback', async (req, res) => {
  let intent: GoogleOAuthIntent = 'login';

  try {
    if (!googleOAuthService.isConfigured()) {
      redirectWithError(res, intent, 'google_oauth_not_configured');
      return;
    }

    const state = req.query.state?.toString();
    const storedState = req.cookies[GOOGLE_STATE_COOKIE];
    const providerError = req.query.error?.toString();

    if (state && storedState && state === storedState) {
      const statePayload = googleOAuthService.validateState(state);
      intent = statePayload.intent;
    }

    if (providerError) {
      redirectWithError(res, intent, 'google_oauth_cancelled');
      return;
    }

    if (!state || !storedState || state !== storedState) {
      redirectWithError(res, intent, 'google_oauth_failed');
      return;
    }

    const code = req.query.code?.toString();
    if (!code) {
      redirectWithError(res, intent, 'google_oauth_failed');
      return;
    }

    const profile =
      await googleOAuthService.exchangeCodeForProfile(code);
    const result = await authService.authenticateWithGoogle(
      profile,
      getAuthAuditContext(req)
    );

    if (!result.success) {
      const errorCode =
        result.error?.code === 'PRECONDITION_FAILED'
          ? 'google_email_not_verified'
          : result.error?.code === 'CONFLICT'
            ? 'google_account_link_conflict'
            : 'google_oauth_failed';
      redirectWithError(res, intent, errorCode);
      return;
    }

    res.cookie(
      'sessionId',
      result.session!.id,
      getSessionCookieOptions()
    );
    res.redirect(302, googleOAuthService.getSuccessRedirectUrl());
  } catch {
    redirectWithError(res, intent, 'google_oauth_failed');
  } finally {
    res.clearCookie(
      GOOGLE_STATE_COOKIE,
      getStateCookieOptions()
    );
  }
});

export const googleOAuthRouter = router;
