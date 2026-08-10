import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const MAX_URL_LENGTH = 2_048;
const MAX_REQUEST_BODY_BYTES = 1_048_576;
const DEFAULT_MAX_RESPONSE_BYTES = 65_536;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_DNS_TIMEOUT_MS = 3_000;
const MAX_DNS_TIMEOUT_MS = 10_000;

const ALLOWED_PORTS_BY_PROTOCOL: Readonly<Record<string, ReadonlySet<number>>> = {
  'http:': new Set([80]),
  'https:': new Set([443]),
};

const LOCAL_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
];

const boundedPositiveInt = (
  value: number | undefined,
  fallback: number,
  maximum: number
) =>
  Number.isFinite(value)
    ? Math.min(Math.max(Math.floor(value as number), 1), maximum)
    : fallback;

export type WebhookTransportRequest = {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
  maxResponseBytes?: number;
};

export type PinnedWebhookRequest = WebhookTransportRequest & {
  pinnedAddress: string;
};

export type WebhookTransportResponse = {
  statusCode: number;
};

export type WebhookHostResolver = (
  hostname: string
) => Promise<readonly string[]>;

export type WebhookRequestExecutor = (
  request: PinnedWebhookRequest
) => Promise<WebhookTransportResponse>;

export interface WebhookTransport {
  send(request: WebhookTransportRequest): Promise<WebhookTransportResponse>;
}

export type WebhookTransportDependencies = {
  resolveHost?: WebhookHostResolver;
  request?: WebhookRequestExecutor;
  dnsTimeoutMs?: number;
};

export class WebhookSecurityError extends Error {
  readonly code = 'WEBHOOK_SECURITY_POLICY';

  constructor(message = 'Webhook endpoint rejected by security policy') {
    super(message);
    this.name = 'WebhookSecurityError';
  }
}

export class WebhookTransportError extends Error {
  readonly code = 'WEBHOOK_TRANSPORT_FAILURE';

  constructor(message = 'Webhook request failed') {
    super(message);
    this.name = 'WebhookTransportError';
  }
}

export const describeWebhookError = (error: unknown) => {
  if (error instanceof WebhookSecurityError) {
    return error.message;
  }

  if (error instanceof WebhookTransportError) {
    return error.message;
  }

  return 'Webhook request failed';
};

const defaultResolveHost: WebhookHostResolver = async (hostname) => {
  const records = await dnsLookup(hostname, {
    all: true,
    verbatim: true,
  });

  return records.map((record) => record.address);
};

const withTimeout = <T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutError: WebhookTransportError
): Promise<T> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject(timeoutError);
    }, timeoutMs);

    operation.then(
      (value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });

const isInIpv4Range = (
  address: number,
  start: number,
  end: number
) => address >= start && address <= end;

const parseIpv4 = (address: string): number | null => {
  const parts = address.split('.');

  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  const octets = parts.map(Number);

  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return null;
  }

  return octets.reduce((value, octet) => value * 256 + octet, 0);
};

const parseIpv6 = (address: string): bigint | null => {
  const normalized = address.toLowerCase();

  if (normalized.includes('%')) {
    return null;
  }

  const sections = normalized.split('::');

  if (sections.length > 2) {
    return null;
  }

  const parseSection = (section: string): number[] => {
    if (!section) {
      return [];
    }

    const parts = section.split(':');
    const values: number[] = [];

    for (const [index, part] of parts.entries()) {
      if (part.includes('.')) {
        if (index !== parts.length - 1) {
          return [];
        }

        const ipv4 = parseIpv4(part);

        if (ipv4 === null) {
          return [];
        }

        values.push((ipv4 >>> 16) & 0xffff, ipv4 & 0xffff);
        continue;
      }

      if (!/^[0-9a-f]{1,4}$/.test(part)) {
        return [];
      }

      values.push(Number.parseInt(part, 16));
    }

    return values;
  };

  const left = parseSection(sections[0] ?? '');
  const right = sections.length === 2 ? parseSection(sections[1] ?? '') : [];

  if (
    left.length === 0 && sections[0] !== '' && sections.length === 2
  ) {
    return null;
  }

  if (
    right.length === 0 && sections.length === 2 && sections[1] !== ''
  ) {
    return null;
  }

  const missing = sections.length === 2 ? 8 - left.length - right.length : 0;

  if (missing < 1 || left.length + right.length + missing !== 8) {
    return null;
  }

  const hextets = [
    ...left,
    ...Array.from({ length: missing }, () => 0),
    ...right,
  ];

  if (hextets.length !== 8) {
    return null;
  }

  return hextets.reduce(
    (value, hextet) => (value << 16n) | BigInt(hextet),
    0n
  );
};

const range = (value: bigint, prefix: bigint, bits: number) =>
  value >> BigInt(128 - bits) === prefix;

export const isDisallowedIpAddress = (address: string): boolean => {
  const ipv4 = parseIpv4(address);

  if (ipv4 !== null && net.isIP(address) === 4) {
    // 192.175.48.0/24 is IANA globally reachable and intentionally eligible.
    return (
      isInIpv4Range(ipv4, 0x00000000, 0x00ffffff) ||
      isInIpv4Range(ipv4, 0x0a000000, 0x0affffff) ||
      isInIpv4Range(ipv4, 0x64400000, 0x647fffff) ||
      isInIpv4Range(ipv4, 0x7f000000, 0x7fffffff) ||
      isInIpv4Range(ipv4, 0xa9fe0000, 0xa9feffff) ||
      isInIpv4Range(ipv4, 0xac100000, 0xac1fffff) ||
      isInIpv4Range(ipv4, 0xc0000000, 0xc00000ff) ||
      isInIpv4Range(ipv4, 0xc0000200, 0xc00002ff) ||
      isInIpv4Range(ipv4, 0xc01fc400, 0xc01fc4ff) ||
      isInIpv4Range(ipv4, 0xc034c100, 0xc034c1ff) ||
      isInIpv4Range(ipv4, 0xc0586300, 0xc05863ff) ||
      isInIpv4Range(ipv4, 0xc6120000, 0xc613ffff) ||
      isInIpv4Range(ipv4, 0xc6336400, 0xc63364ff) ||
      isInIpv4Range(ipv4, 0xc0a80000, 0xc0a8ffff) ||
      isInIpv4Range(ipv4, 0xcb007100, 0xcb0071ff) ||
      isInIpv4Range(ipv4, 0xe0000000, 0xefffffff) ||
      isInIpv4Range(ipv4, 0xf0000000, 0xffffffff)
    );
  }

  if (net.isIP(address) !== 6) {
    return true;
  }

  const ipv6 = parseIpv6(address);

  if (ipv6 === null) {
    return true;
  }

  const mappedIpv4 = ipv6 >> 32n === 0xffffn;

  if (mappedIpv4) {
    const mapped = Number(ipv6 & 0xffffffffn);
    return isDisallowedIpAddress(
      `${mapped >>> 24}.${(mapped >>> 16) & 0xff}.${(mapped >>> 8) & 0xff}.${mapped & 0xff}`
    );
  }

  return (
    ipv6 === 0n ||
    ipv6 === 1n ||
    !range(ipv6, 0x1n, 3) ||
    range(ipv6, 0x7en, 7) ||
    range(ipv6, 0x3fan, 10) ||
    range(ipv6, 0x3fbn, 10) ||
    range(ipv6, 0x20010001n, 32) ||
    range(ipv6, 0x20010002n, 48) ||
    range(ipv6, 0x20010003n, 32) ||
    range(ipv6, 0x20010004n, 48) ||
    range(ipv6, 0x20010010n, 32) ||
    range(ipv6, 0x20010020n, 32) ||
    range(ipv6, 0x20010db8n, 32) ||
    range(ipv6, 0x20010000n, 32) ||
    range(ipv6, 0x2002n, 16) ||
    range(ipv6, 0x3ffen, 16) ||
    (ipv6 >> 120n) === 0xffn
  );
};

const normalizedHostname = (hostname: string) =>
  hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

const isLocalHostname = (hostname: string) => {
  const withoutTrailingDot = hostname.replace(/\.$/, '').toLowerCase();

  return (
    withoutTrailingDot === 'localhost' ||
    LOCAL_HOST_SUFFIXES.some((suffix) => withoutTrailingDot.endsWith(suffix))
  );
};

const isUnsafePort = (protocol: string, port: number) =>
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65_535 ||
  !ALLOWED_PORTS_BY_PROTOCOL[protocol]?.has(port);

export const parseWebhookUrl = (rawUrl: string) => {
  const hasControlCharacter =
    typeof rawUrl === 'string' &&
    [...rawUrl].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 0x1f || code === 0x7f;
    });

  if (
    typeof rawUrl !== 'string' ||
    rawUrl.length === 0 ||
    rawUrl.length > MAX_URL_LENGTH ||
    rawUrl !== rawUrl.trim() ||
    hasControlCharacter
  ) {
    throw new WebhookSecurityError();
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new WebhookSecurityError();
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    !url.hostname
  ) {
    throw new WebhookSecurityError();
  }

  const hostname = normalizedHostname(url.hostname);

  if (
    !hostname ||
    hostname.includes('%') ||
    isLocalHostname(hostname)
  ) {
    throw new WebhookSecurityError();
  }

  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));

  if (isUnsafePort(url.protocol, port)) {
    throw new WebhookSecurityError();
  }

  const ipVersion = net.isIP(hostname);

  if (ipVersion !== 0 && isDisallowedIpAddress(hostname)) {
    throw new WebhookSecurityError();
  }

  return {
    url,
    hostname,
    port,
    isLiteralIp: ipVersion !== 0,
  };
};

const defaultRequestExecutor: WebhookRequestExecutor = (request) =>
  new Promise((resolve, reject) => {
    const url = new URL(request.url);
    const hostname = normalizedHostname(url.hostname);
    const client = url.protocol === 'https:' ? https : http;
    const bodyBytes = Buffer.byteLength(request.body, 'utf8');
    const maxResponseBytes = boundedPositiveInt(
      request.maxResponseBytes,
      DEFAULT_MAX_RESPONSE_BYTES,
      DEFAULT_MAX_RESPONSE_BYTES
    );
    let settled = false;

    const finishFailure = (error: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(totalTimer);
      reject(
        error instanceof WebhookTransportError
          ? error
          : new WebhookTransportError()
      );
    };

    const requestHandle = client.request(
      {
        protocol: url.protocol,
        hostname,
        port: url.port || (url.protocol === 'https:' ? '443' : '80'),
        path: `${url.pathname || '/'}${url.search}`,
        method: request.method,
        headers: {
          ...request.headers,
          Host: url.host,
          Connection: 'close',
          'Content-Length': bodyBytes.toString(),
        },
        agent: false,
        lookup: ((
          _hostname: string,
          _options: object,
          callback: (
            error: NodeJS.ErrnoException | null,
            address: string,
            family: number
          ) => void
        ) => {
          const family = net.isIP(request.pinnedAddress);

          if (family === 0) {
            callback(new WebhookTransportError(), '', 0);
            return;
          }

          callback(null, request.pinnedAddress, family);
        }) as import('node:net').LookupFunction,
        ...(url.protocol === 'https:'
          ? {
              rejectUnauthorized: true,
              ...(net.isIP(hostname) === 0
                ? { servername: hostname }
                : {}),
            }
          : {}),
      },
      (response) => {
        let receivedBytes = 0;

        response.on('data', (chunk: Buffer | string) => {
          receivedBytes += Buffer.byteLength(chunk);

          if (receivedBytes > maxResponseBytes) {
            requestHandle.destroy();
            finishFailure(
              new WebhookTransportError('Webhook response exceeded size limit')
            );
          }
        });

        response.on('end', () => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(totalTimer);
          resolve({ statusCode: response.statusCode ?? 0 });
        });

        response.on('error', () => finishFailure(new WebhookTransportError()));
      }
    );

    const totalTimer = setTimeout(() => {
      requestHandle.destroy();
      finishFailure(new WebhookTransportError('Webhook request timed out'));
    }, request.timeoutMs);

    requestHandle.on('error', finishFailure);
    requestHandle.setTimeout(request.timeoutMs, () => {
      requestHandle.destroy();
      finishFailure(new WebhookTransportError('Webhook request timed out'));
    });

    try {
      requestHandle.write(request.body);
      requestHandle.end();
    } catch {
      finishFailure(new WebhookTransportError());
    }
  });

export class SafeWebhookTransport implements WebhookTransport {
  private readonly resolveHost: WebhookHostResolver;
  private readonly request: WebhookRequestExecutor;
  private readonly dnsTimeoutMs: number;

  constructor(dependencies: WebhookTransportDependencies = {}) {
    this.resolveHost = dependencies.resolveHost ?? defaultResolveHost;
    this.request = dependencies.request ?? defaultRequestExecutor;
    this.dnsTimeoutMs = boundedPositiveInt(
      dependencies.dnsTimeoutMs,
      DEFAULT_DNS_TIMEOUT_MS,
      MAX_DNS_TIMEOUT_MS
    );
  }

  async send(
    request: WebhookTransportRequest
  ): Promise<WebhookTransportResponse> {
    if (Buffer.byteLength(request.body, 'utf8') > MAX_REQUEST_BODY_BYTES) {
      throw new WebhookSecurityError();
    }

    const parsed = parseWebhookUrl(request.url);
    let pinnedAddress = parsed.hostname;

    if (!parsed.isLiteralIp) {
      let addresses: readonly string[];

      try {
        addresses = await withTimeout(
          this.resolveHost(parsed.hostname),
          this.dnsTimeoutMs,
          new WebhookTransportError('Webhook DNS lookup timed out')
        );
      } catch (error) {
        if (error instanceof WebhookTransportError) {
          throw error;
        }

        throw new WebhookTransportError('Webhook DNS lookup failed');
      }

      if (
        addresses.length === 0 ||
        addresses.some((address) => isDisallowedIpAddress(address))
      ) {
        throw new WebhookSecurityError();
      }

      pinnedAddress = addresses[0] as string;
    }

    const response = await this.request({
      ...request,
      pinnedAddress,
      timeoutMs: boundedPositiveInt(
        request.timeoutMs,
        MAX_TIMEOUT_MS,
        MAX_TIMEOUT_MS
      ),
      maxResponseBytes: boundedPositiveInt(
        request.maxResponseBytes,
        DEFAULT_MAX_RESPONSE_BYTES,
        DEFAULT_MAX_RESPONSE_BYTES
      ),
    });

    if (response.statusCode >= 300 && response.statusCode < 400) {
      throw new WebhookSecurityError('Webhook redirects are disabled');
    }

    return response;
  }
}

export const defaultWebhookTransport = new SafeWebhookTransport();
