import type { CorsOptions } from 'cors';

function isProdLikeEnv(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging' ||
    process.env.SECURE_COOKIES === 'true'
  );
}

function isEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

// CORS origin configuration - supports multiple origins and gated preview hosts.
export const getCorsOrigin = ():
  | string
  | string[]
  | NonNullable<CorsOptions['origin']> => {
  const corsOrigin =
    process.env.CORS_ORIGIN ||
    process.env.CORS_ALLOWED_ORIGINS ||
    'http://localhost:5173';

  const origins = corsOrigin.split(',').map((o) => o.trim());
  const prodLike = isProdLikeEnv();
  const allowVercelPreviews =
    !prodLike || isEnabled(process.env.CORS_ALLOW_VERCEL_PREVIEWS);
  const allowLocalhost =
    !prodLike || isEnabled(process.env.CORS_ALLOW_LOCALHOST);

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (origins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (
      allowVercelPreviews &&
      (origin.endsWith('.vercel.app') ||
        origin === 'https://sync-erp.vercel.app')
    ) {
      callback(null, true);
      return;
    }

    if (
      allowLocalhost &&
      (origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:'))
    ) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  };
};
