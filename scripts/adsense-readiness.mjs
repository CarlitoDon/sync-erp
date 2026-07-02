import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);

function parseArgs(argv) {
  const args = new Map();

  for (const arg of argv) {
    const [key, ...valueParts] = arg.split('=');
    if (key.startsWith('--')) {
      args.set(key, valueParts.join('=') || 'true');
    }
  }

  return args;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    env[key] = rawValue
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim();
  }

  return env;
}

function readEnv(name, envFileValues) {
  const value = process.env[name] ?? envFileValues[name];
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function fail(message, details = []) {
  console.error(`AdSense readiness failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const envFile = path.resolve(
  repoRoot,
  args.get('--env-file') ?? 'apps/web/.env.production'
);
const adsFile = path.resolve(
  repoRoot,
  args.get('--ads-file') ?? 'apps/web/public/ads.txt'
);

const envFileValues = parseEnvFile(envFile);
const adsTxt = fs.existsSync(adsFile)
  ? fs.readFileSync(adsFile, 'utf8')
  : '';

const enabled = readEnv('VITE_GOOGLE_ADSENSE_ENABLED', envFileValues);
const autoAdsEnabled = readEnv(
  'VITE_GOOGLE_ADSENSE_AUTO_ADS_ENABLED',
  envFileValues
);
const clientId = readEnv(
  'VITE_GOOGLE_ADSENSE_CLIENT_ID',
  envFileValues
);
const defaultSlot = readEnv(
  'VITE_GOOGLE_ADSENSE_DEFAULT_SLOT',
  envFileValues
);
const footerSlot = readEnv(
  'VITE_GOOGLE_ADSENSE_FOOTER_SLOT',
  envFileValues
);

const errors = [];
if (enabled !== 'true') {
  errors.push('VITE_GOOGLE_ADSENSE_ENABLED must be true.');
}

if (autoAdsEnabled && autoAdsEnabled !== 'true') {
  errors.push(
    'VITE_GOOGLE_ADSENSE_AUTO_ADS_ENABLED must be true when set.'
  );
}

if (!clientId || !/^ca-pub-\d+$/.test(clientId)) {
  errors.push(
    'VITE_GOOGLE_ADSENSE_CLIENT_ID must be a real ca-pub-* ID.'
  );
}

const usingAutoAds = autoAdsEnabled === 'true';

if (!usingAutoAds) {
  if (!defaultSlot || !/^\d+$/.test(defaultSlot)) {
    errors.push(
      'VITE_GOOGLE_ADSENSE_DEFAULT_SLOT must be a numeric AdSense slot ID unless Auto Ads is enabled.'
    );
  }

  if (!footerSlot || !/^\d+$/.test(footerSlot)) {
    errors.push(
      'VITE_GOOGLE_ADSENSE_FOOTER_SLOT must be a numeric AdSense slot ID unless Auto Ads is enabled.'
    );
  }
} else {
  if (defaultSlot && !/^\d+$/.test(defaultSlot)) {
    errors.push(
      'VITE_GOOGLE_ADSENSE_DEFAULT_SLOT must be numeric when set.'
    );
  }

  if (footerSlot && !/^\d+$/.test(footerSlot)) {
    errors.push(
      'VITE_GOOGLE_ADSENSE_FOOTER_SLOT must be numeric when set.'
    );
  }
}

const adsLine = adsTxt
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) =>
    /^google\.com,\s*pub-\d+,\s*DIRECT,\s*f08c47fec0942fa0$/i.test(
      line
    )
  );

if (!adsLine) {
  errors.push(
    'apps/web/public/ads.txt must contain the real Google seller line.'
  );
}

if (clientId && adsLine) {
  const publisherId = clientId.replace(/^ca-/, '');
  if (!adsLine.includes(publisherId)) {
    errors.push(
      'ads.txt publisher ID must match VITE_GOOGLE_ADSENSE_CLIENT_ID.'
    );
  }
}

if (errors.length > 0) {
  fail('production AdSense configuration is incomplete.', [
    `env file checked: ${path.relative(repoRoot, envFile)}`,
    `ads.txt checked: ${path.relative(repoRoot, adsFile)}`,
    ...errors,
  ]);
}

console.log('AdSense readiness passed.');
