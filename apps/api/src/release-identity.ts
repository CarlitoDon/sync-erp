import { readFileSync } from 'node:fs';
import path from 'node:path';

export const UNKNOWN_RELEASE_VALUE = 'unknown';
export const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/i;

export interface ReleaseIdentity {
  commit: string;
  version: string;
}

interface ReleaseManifest {
  commit?: unknown;
  version?: unknown;
}

function getManifestPath(): string {
  return path.resolve(
    process.env.SYNC_ERP_RELEASE_MANIFEST_PATH?.trim() ||
      path.join(process.cwd(), 'release.json')
  );
}

function unknownRelease(): ReleaseIdentity {
  return {
    commit: UNKNOWN_RELEASE_VALUE,
    version: UNKNOWN_RELEASE_VALUE,
  };
}

export function getReleaseIdentity(): ReleaseIdentity {
  let manifest: ReleaseManifest;

  try {
    manifest = JSON.parse(
      readFileSync(getManifestPath(), 'utf8')
    ) as ReleaseManifest;
  } catch {
    return unknownRelease();
  }

  return {
    commit:
      typeof manifest.commit === 'string' &&
      RELEASE_SHA_PATTERN.test(manifest.commit)
        ? manifest.commit
        : UNKNOWN_RELEASE_VALUE,
    version:
      typeof manifest.version === 'string' && manifest.version.trim()
        ? manifest.version
        : UNKNOWN_RELEASE_VALUE,
  };
}
