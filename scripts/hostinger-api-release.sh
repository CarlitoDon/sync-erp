#!/usr/bin/env bash

# Hostinger API release transaction.
#
# The workflow uploads an immutable artifact and this script runs on Hostinger.
# A database migration is deliberately performed before the PM2 switch. A
# failed migration exits while the previous application is still serving;
# migrations are forward-only and are never rolled back by this script.

set -euo pipefail

ACTION="${1:-}"
if [[ "$ACTION" != "deploy" && "$ACTION" != "rollback-drill" ]]; then
  echo "Usage: $0 deploy|rollback-drill" >&2
  exit 2
fi

required_env=(
  DEPLOY_DIR
  PM2_NAME
  APP_PORT
  RUNTIME_ENV
  DATABASE_PROJECT_REF
  EXPECTED_SHA
  REMOTE_API_ARCHIVE
  REMOTE_RUNTIME_ENV
  API_URL
  API_BASE_URL
  WEB_URL
  OAUTH_REDIRECT_URL
  CORS_ORIGINS
)

for name in "${required_env[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required deployment variable ${name}." >&2
    exit 2
  fi
done

if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "EXPECTED_SHA must be a 40-character hexadecimal commit." >&2
  exit 2
fi

if [[ ! "$APP_PORT" =~ ^[0-9]+$ ]]; then
  echo "APP_PORT must be numeric." >&2
  exit 2
fi

if [[ "$ACTION" == "rollback-drill" ]]; then
  if [[ "$RUNTIME_ENV" != "staging" ||
    "$DEPLOY_DIR" != "apps/api-staging" ||
    "$PM2_NAME" != "sync-erp-api-staging" ||
    "$APP_PORT" != "3001" ||
    "$DATABASE_PROJECT_REF" != "ctesbnhcqubamrtcxxqi" ]]; then
    echo "Rollback drill is staging-only; refusing non-staging deployment target." >&2
    exit 2
  fi
  if [[ "${ROLLBACK_DRILL_CONFIRMATION:-}" != "ROLLBACK_STAGING" ]]; then
    echo "Rollback drill requires ROLLBACK_DRILL_CONFIRMATION=ROLLBACK_STAGING." >&2
    exit 2
  fi
  if [[ -z "${DRILL_ID:-}" || ! "$DRILL_ID" =~ ^[A-Za-z0-9._-]{1,80}$ ]]; then
    echo "Rollback drill requires a safe DRILL_ID." >&2
    exit 2
  fi
fi

target="$HOME/public_html/${DEPLOY_DIR}"
release_root="$target/releases"
if [[ "$ACTION" == "rollback-drill" ]]; then
  release_dir="$release_root/.rollback-drill-${DRILL_ID}"
else
  release_dir="$release_root/$EXPECTED_SHA"
fi
rollback_root="$target/.release-rollback"
rollback_file="$rollback_root/$EXPECTED_SHA.json"
state_file="$target/.release-state.json"
pm2="$HOME/node-pm2/node_modules/.bin/pm2"

# The production API was historically deployed in-place and may have a
# usable .env plus a running legacy process, but no release metadata. A
# bootstrap is permitted only when the workflow supplies this explicit
# authorization. Once the first release state is written, normal deployments
# use the immutable-release path and this branch is never reached again.
bootstrap_confirmation="BOOTSTRAP_PRODUCTION_API"
legacy_sha="0000000000000000000000000000000000000000"
PREVIOUS_IS_FRESH=0
PREVIOUS_IS_LEGACY=0
BASE_ENV_FILE=""

if [[ "$ACTION" == "deploy" && "${BOOTSTRAP_CONFIRMATION:-}" == "$bootstrap_confirmation" ]]; then
  if [[ "$RUNTIME_ENV" != "production" ||
    "$DEPLOY_DIR" != "apps/api" ||
    "$PM2_NAME" != "sync-erp-api" ||
    "$APP_PORT" != "3002" ||
    "$DATABASE_PROJECT_REF" != "vktglrwmbrhtddpmekda" ]]; then
    echo "Production bootstrap authorization does not match the API production target." >&2
    exit 2
  fi
fi

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

validate_bootstrap_paths() {
  local parent_path="$HOME"
  local component

  for component in public_html apps "${DEPLOY_DIR##*/}"; do
    parent_path="$parent_path/$component"
    if [[ -L "$parent_path" ]]; then
      fail "Production bootstrap path component ${parent_path} must not be a symlink."
    fi
    if [[ ! -d "$parent_path" ]]; then
      fail "Production bootstrap path component ${parent_path} must be an existing directory."
    fi
  done
  if [[ ! -d "$target" || -L "$target" ]]; then
    fail "Production bootstrap target ${target} must be a real directory."
  fi

  for path_name in release_root rollback_root; do
    local path_value="${!path_name}"
    if [[ -e "$path_value" || -L "$path_value" ]]; then
      if [[ ! -d "$path_value" || -L "$path_value" ]]; then
        fail "Production bootstrap path ${path_value} must be a real directory; refusing symlinked or non-directory state."
      fi
    fi
  done
}

resolve_link() {
  local link="$1"
  local destination
  destination="$(readlink "$link")"
  case "$destination" in
    /*) (cd "$destination" 2>/dev/null && pwd -P) || printf '%s\n' "$destination" ;;
    *) (cd "$(dirname "$link")/$destination" 2>/dev/null && pwd -P) || printf '%s/%s\n' "$(cd "$(dirname "$link")" && pwd -P)" "$destination" ;;
  esac
}

read_manifest() {
  local release_path="$1"
  local allow_unknown_version="${2:-0}"
  node --input-type=module - "$release_path/release.json" "$allow_unknown_version" <<'NODE'
import { readFileSync } from 'node:fs';

const [manifestPath, allowUnknownVersion] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!/^[0-9a-f]{40}$/i.test(manifest.commit)) {
  throw new Error(`Invalid release commit in ${manifestPath}.`);
}
if (typeof manifest.version !== 'string' || !manifest.version.trim()) {
  if (allowUnknownVersion === '1') {
    process.stderr.write(
      `Legacy release manifest ${manifestPath} has no valid version; using unknown.\n`
    );
    process.stdout.write(`${manifest.commit}\tunknown\n`);
    process.exit(0);
  }
  throw new Error(`Invalid release version in ${manifestPath}.`);
}
process.stdout.write(`${manifest.commit}\t${manifest.version}\n`);
NODE
}

write_state() {
  local destination="$1"
  local commit="$2"
  local version="$3"
  local release_path="$4"
  local pm2_name="$5"
  local port="$6"
  local temporary="${destination}.tmp.$$"

  node --input-type=module - "$temporary" "$commit" "$version" "$release_path" "$pm2_name" "$port" <<'NODE'
import { writeFileSync } from 'node:fs';

const [destination, commit, version, releasePath, pm2Name, port] =
  process.argv.slice(2);
writeFileSync(
  destination,
  `${JSON.stringify({
    schemaVersion: 1,
    service: 'sync-erp-api',
    commit,
    version,
    releasePath,
    pm2Name,
    port: Number(port),
  }, null, 2)}\n`,
  'utf8'
);
NODE
  mv -f "$temporary" "$destination"
}

read_state() {
  local source="$1"
  node --input-type=module - "$source" <<'NODE'
import { readFileSync } from 'node:fs';

const [statePath] = process.argv.slice(2);
const state = JSON.parse(readFileSync(statePath, 'utf8'));
if (state.schemaVersion !== 1 || state.service !== 'sync-erp-api') {
  throw new Error(`Unsupported release state in ${statePath}.`);
}
if (!/^[0-9a-f]{40}$/i.test(state.commit)) {
  throw new Error(`Invalid release commit in ${statePath}.`);
}
if (typeof state.version !== 'string' || !state.version.trim()) {
  throw new Error(`Invalid release version in ${statePath}.`);
}
if (typeof state.releasePath !== 'string' || !state.releasePath.startsWith('/')) {
  throw new Error(`Invalid release path in ${statePath}.`);
}
if (typeof state.pm2Name !== 'string' || !state.pm2Name.trim()) {
  throw new Error(`Invalid PM2 name in ${statePath}.`);
}
if (!Number.isInteger(state.port) || state.port < 1) {
  throw new Error(`Invalid port in ${statePath}.`);
}
process.stdout.write(
  [state.commit, state.version, state.releasePath, state.pm2Name, state.port]
    .join('\t') + '\n'
);
NODE
}

atomic_symlink() {
  local destination="$1"
  local link="$2"
  local temporary="${link}.tmp.$$"
  rm -f "$temporary"
  ln -s "$destination" "$temporary"
  if ! node --input-type=module - "$temporary" "$link" <<'NODE'
import { renameSync } from 'node:fs';

const [temporary, link] = process.argv.slice(2);
renameSync(temporary, link);
NODE
  then
    rm -f "$temporary"
    return 1
  fi
}

validate_release() {
  local release_path="$1"
  local expected_commit="$2"
  local allow_unknown_version="${3:-0}"
  local manifest_values
  local manifest_commit

  if [[ "$allow_unknown_version" == "2" ]]; then
    if [[ ! -d "$release_path" || -L "$release_path" ]]; then
      fail "Legacy production application directory is missing or unsafe: ${release_path}."
    fi
    for required_file in .env dist/index.js; do
      if [[ ! -f "$release_path/$required_file" || -L "$release_path/$required_file" ]]; then
        fail "Legacy production application is incomplete (missing ${required_file}); refusing bootstrap."
      fi
    done
    return 0
  fi

  if [[ ! -d "$release_path" ]]; then
    fail "Previous release directory is missing: ${release_path}. Refusing deployment; restore it from the retained release or backup first."
  fi
  for required_file in release.json .env dist/index.js; do
    if [[ ! -f "$release_path/$required_file" ]]; then
      fail "Previous release ${release_path} is incomplete (missing ${required_file}); refusing deployment and rollback."
    fi
  done

  manifest_values="$(read_manifest "$release_path" "$allow_unknown_version")" ||
    fail "Previous release manifest is unreadable: ${release_path}/release.json."
  IFS=$'\t' read -r manifest_commit _ <<< "$manifest_values"
  if [[ "$manifest_commit" != "$expected_commit" ]]; then
    fail "Release identity mismatch for ${release_path}: expected ${expected_commit}, found ${manifest_commit}."
  fi
}

verify_legacy_local_release() {
  local port="$1"

  curl -fsS --connect-timeout 5 --max-time 10 \
    "http://127.0.0.1:${port}/health" >/dev/null
}

pm2_pid() {
  local name="$1"
  "$pm2" pid "$name" 2>/dev/null | tail -n 1 | tr -d '[:space:]' || true
}

require_online_pm2() {
  local name="$1"
  local pid
  pid="$(pm2_pid "$name")"
  case "$pid" in
    ''|0|*[!0-9]*)
      fail "Previous PM2 process ${name} is not online; refusing destructive deployment. Start the known-good release or restore PM2 state first."
      ;;
  esac
}

require_offline_pm2() {
  local name="$1"
  local pid
  pid="$(pm2_pid "$name")"
  case "$pid" in
    ''|0) ;;
    *[!0-9]*) fail "Could not determine whether PM2 process ${name} is online; refusing fresh bootstrap." ;;
    *) fail "Fresh production bootstrap found an existing PM2 process ${name}; refusing to stop an unverified process." ;;
  esac
}

require_owned_pm2() {
  local name="$1"
  local expected_cwd="$2"
  local expected_port="$3"

  if ! "$pm2" jlist | node --input-type=module -e '
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

const [name, rawExpectedCwd, expectedPort] = process.argv.slice(1);
const canonicalize = (value) => {
  if (typeof value !== "string" || !value) return null;
  try {
    return realpathSync(value);
  } catch {
    return null;
  }
};

const expectedCwd = canonicalize(rawExpectedCwd);
if (!expectedCwd) process.exit(1);

const rawReleaseRoot = `${rawExpectedCwd}/releases`;
let releaseRoot = null;
try {
  const releaseRootStat = lstatSync(rawReleaseRoot);
  if (!releaseRootStat.isDirectory() || releaseRootStat.isSymbolicLink()) {
    process.exit(1);
  }
  releaseRoot = canonicalize(rawReleaseRoot);
} catch {
  // A first in-place bootstrap may not have a releases directory yet.
}

const processes = JSON.parse(readFileSync(0, "utf8"));
const matches = processes.filter((process) => process.name === name);
if (matches.length !== 1) process.exit(1);

const env = matches[0].pm2_env ?? {};
const actualCwd = canonicalize(env.pm_cwd ?? env.cwd);
const actualScript = canonicalize(env.pm_exec_path);
if (!actualCwd || !actualScript) process.exit(1);

const isInPlace = actualCwd === expectedCwd;
const releaseRelativePath = releaseRoot ? relative(releaseRoot, actualCwd) : "";
const isImmutableRelease =
  Boolean(releaseRoot) &&
  /^[0-9a-f]{40}$/i.test(releaseRelativePath) &&
  !releaseRelativePath.includes("/") &&
  !releaseRelativePath.includes("\\\\") &&
  !releaseRelativePath.startsWith("..");
const expectedScript = canonicalize(resolve(actualCwd, "dist/index.js"));

if (
  !isInPlace && !isImmutableRelease ||
  !expectedScript ||
  actualScript !== expectedScript ||
  String(env.PORT ?? "") !== String(expectedPort)
) {
  process.exit(1);
}

process.stdout.write(actualCwd);
' "$name" "$expected_cwd" "$expected_port"
  then
    fail "PM2 process ${name} is not owned by the expected API release at ${expected_cwd} on port ${expected_port}."
  fi
}

write_proxy() {
  local port="$1"
  local temporary
  temporary="$(mktemp "$target/.htaccess.XXXXXX")"
  printf '%s\n' \
    "# PM2 proxy - API running on localhost:${port} via PM2" \
    'RewriteEngine On' \
    "RewriteRule ^(.*)\$ http://localhost:${port}/\$1 [P,L]" \
    > "$temporary"
  mv -f "$temporary" "$target/.htaccess"
}

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  local temporary
  temporary="$(mktemp "${file}.XXXXXX")"
  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    index($0, key "=") == 1 {
      if (!found) {
        print key "=" value
        found = 1
      }
      next
    }
    { print }
    END {
      if (!found) print key "=" value
    }
  ' "$file" > "$temporary"
  mv -f "$temporary" "$file"
}

decode_secret() {
  local key="$1"
  local encoded
  encoded="$(sed -n "s/^${key}=//p" "$HOME/${REMOTE_RUNTIME_ENV}" | tail -n 1)"
  [[ -n "$encoded" ]] || fail "Missing ${key} in transferred runtime environment."
  printf '%s' "$encoded" | base64 --decode
}

validate_database_url() {
  local database_url="$1"
  case "$database_url" in
    *"postgres.${DATABASE_PROJECT_REF}:"*|*"@db.${DATABASE_PROJECT_REF}.supabase.co"*) ;;
    *) fail "DATABASE_URL does not match the expected ${RUNTIME_ENV} Supabase project." ;;
  esac
}

start_release() {
  local release_path="$1"
  local name="$2"
  local port="$3"

  NODE_OPTIONS="--v8-pool-size=1" UV_THREADPOOL_SIZE=1 \
    SYNC_ERP_API_URL="$API_URL" \
    SYNC_ERP_API_BASE_URL="$API_BASE_URL" \
    SYNC_ERP_WEB_URL="$WEB_URL" \
    GOOGLE_OAUTH_REDIRECT_URI="$OAUTH_REDIRECT_URL" \
    CORS_ORIGIN="$CORS_ORIGINS" \
    CORS_ALLOWED_ORIGINS="$CORS_ORIGINS" \
    HOSTINGER_ENV="$RUNTIME_ENV" \
    PORT="$port" NODE_ENV="$RUNTIME_ENV" \
    "$pm2" start dist/index.js --name "$name" --cwd "$release_path" --time
}

stop_release() {
  local name="$1"
  local old_pids=""
  for pid_file in "$HOME/.pm2/pids/${name}-"*.pid; do
    [[ -r "$pid_file" ]] || continue
    old_pid=""
    IFS= read -r old_pid < "$pid_file" || true
    case "$old_pid" in
      ''|*[!0-9]*) continue ;;
    esac
    old_pids="${old_pids} ${old_pid}"
  done
  "$pm2" delete "$name" >/dev/null 2>&1 || true
  for old_pid in $old_pids; do
    kill "$old_pid" 2>/dev/null || true
  done
  sleep 2
}

verify_local_release() {
  local release_path="$1"
  local port="$2"
  local expected_commit="$3"
  local cors_headers
  local edge_base_url="${API_BASE_URL%/}"
  local verifier_path="$release_path/verify-release-health.mjs"
  local oauth_verifier_path="$release_path/verify-google-oauth-config.mjs"

  # The legacy in-place release may predate the verifier file. The new
  # release already contains the same verifier, so use it to validate the
  # retained release during rollback without mutating the old directory.
  if [[ ! -f "$verifier_path" ]]; then
    verifier_path="$release_dir/verify-release-health.mjs"
  fi
  [[ -f "$verifier_path" ]] || return 1

  # The OAuth verifier is shipped with the new release and runs against the
  # API's loopback listener. Keep the expected callback public and exact; the
  # verifier never follows or prints the provider redirect.
  if [[ "$ACTION" != "rollback-drill" ]]; then
    if [[ ! -f "$oauth_verifier_path" ]]; then
      oauth_verifier_path="$release_dir/verify-google-oauth-config.mjs"
    fi
    [[ -f "$oauth_verifier_path" ]] || return 1
  fi

  for attempt in 1 2 3 4 5 6; do
    if curl -fsS --connect-timeout 5 --max-time 10 \
      "http://127.0.0.1:${port}/health" >/dev/null; then
      break
    fi
    if [[ "$attempt" -eq 6 ]]; then
      "$pm2" logs "$PM2_NAME" --lines 80 --nostream || true
      return 1
    fi
    sleep 5
  done

  if ! node "$verifier_path" \
    --url "http://127.0.0.1:${port}/health" \
    --expected-sha "$expected_commit"; then
    return 1
  fi
  if ! node "$verifier_path" \
    --url "http://127.0.0.1:${port}/mcp/health" \
    --expected-sha "$expected_commit"; then
    return 1
  fi

  # The GitHub runner can be blocked by the Hostinger edge WAF. Verify the
  # public DNS/TLS/proxy path from the Hostinger host itself while the new
  # process is already listening, but before current is switched. A failure
  # therefore still enters the existing previous-release recovery path.
  if [[ "$ACTION" != "rollback-drill" ]]; then
    if ! node "$verifier_path" \
      --url "${edge_base_url}/health" \
      --expected-sha "$expected_commit"; then
      return 1
    fi
    if ! node "$verifier_path" \
      --url "${edge_base_url}/mcp/health" \
      --expected-sha "$expected_commit"; then
      return 1
    fi
  fi

  if [[ "$ACTION" != "rollback-drill" ]]; then
    if ! node "$oauth_verifier_path" \
      --request-url "http://127.0.0.1:${port}/api/auth/google/start?intent=login" \
      --expected-redirect-uri "$OAUTH_REDIRECT_URL"; then
      return 1
    fi
  fi

  cors_headers="$(mktemp)"
  if ! curl -fsS --connect-timeout 5 --max-time 10 \
    -o /dev/null \
    -D "$cors_headers" \
    -X OPTIONS \
    "http://127.0.0.1:${port}/api/trpc/auth.me" \
    -H "Origin: ${WEB_URL}" \
    -H 'Access-Control-Request-Method: GET'; then
    rm -f "$cors_headers"
    return 1
  fi
  if ! grep -Fqi "access-control-allow-origin: ${WEB_URL}" "$cors_headers"; then
    rm -f "$cors_headers"
    return 1
  fi
  rm -f "$cors_headers"
}

load_previous_release() {
  PREVIOUS_STATE_EXISTS=0
  PREVIOUS_IS_LEGACY=0
  PREVIOUS_IS_FRESH=0
  BASE_ENV_FILE=""

  if [[ -f "$state_file" ]]; then
    PREVIOUS_STATE_EXISTS=1
    state_values="$(read_state "$state_file")" ||
      fail "Active release state is unreadable: ${state_file}. Refusing deployment."
    IFS=$'\t' read -r PREVIOUS_SHA PREVIOUS_VERSION PREVIOUS_RELEASE PREVIOUS_PM2 PREVIOUS_PORT <<< "$state_values"
    if [[ ! -L "$target/current" ]]; then
      fail "Active release state exists without ${target}/current; refusing deployment."
    fi
    current_path="$(resolve_link "$target/current")"
    current_physical="$(cd "$current_path" 2>/dev/null && pwd -P || echo "$current_path")"
    previous_physical="$(cd "$PREVIOUS_RELEASE" 2>/dev/null && pwd -P || echo "$PREVIOUS_RELEASE")"
    if [[ "$current_physical" != "$previous_physical" ]]; then
      if [[ -d "$current_physical" && -f "$current_physical/release.json" ]]; then
        echo "WARNING: Active release state (${previous_physical}) disagrees with current symlink (${current_physical}). Aligning state to current symlink." >&2
        PREVIOUS_RELEASE="$current_physical"
        if manifest_values="$(read_manifest "$PREVIOUS_RELEASE" 1 2>/dev/null)"; then
          IFS=$'\t' read -r PREVIOUS_SHA PREVIOUS_VERSION <<< "$manifest_values"
        fi
      elif [[ -d "$previous_physical" && -f "$previous_physical/release.json" ]]; then
        echo "WARNING: Active release state (${previous_physical}) disagrees with current symlink (${current_physical}). Re-aligning symlink to active state." >&2
        atomic_symlink "$previous_physical" "$target/current"
      else
        fail "Active release state (${previous_physical}) and current symlink (${current_physical}) disagree; refusing deployment."
      fi
    fi
  elif [[ -f "$target/release.json" ]]; then
    PREVIOUS_SHA_AND_VERSION="$(read_manifest "$target" 1)" ||
      fail "Legacy active release manifest is unreadable; refusing deployment."
    IFS=$'\t' read -r PREVIOUS_SHA PREVIOUS_VERSION <<< "$PREVIOUS_SHA_AND_VERSION"
    PREVIOUS_RELEASE="$target"
    PREVIOUS_PM2="$PM2_NAME"
    PREVIOUS_PORT="$APP_PORT"
    PREVIOUS_IS_LEGACY=1
  elif [[ "$ACTION" == "deploy" && "${BOOTSTRAP_CONFIRMATION:-}" == "$bootstrap_confirmation" ]]; then
    validate_bootstrap_paths
    if [[ ! -d "$target" || -L "$target" ]]; then
      fail "Production bootstrap requires an existing application directory: ${target}."
    fi
    if [[ ! -f "$target/.env" || -L "$target/.env" || ! -s "$target/.env" ]]; then
      fail "Production bootstrap requires a pre-provisioned non-empty ${target}/.env; refusing to create a release without the existing runtime configuration."
    fi
    if [[ -e "$target/current" || -L "$target/current" ]]; then
      fail "Production bootstrap found ${target}/current without release state; reconcile the target before retrying."
    fi

    if [[ -d "$target/dist" && ! -L "$target/dist" &&
      -f "$target/dist/index.js" && ! -L "$target/dist/index.js" ]]; then
      PREVIOUS_SHA="$legacy_sha"
      PREVIOUS_VERSION="legacy-unknown"
      PREVIOUS_RELEASE="$target"
      PREVIOUS_PM2="$PM2_NAME"
      PREVIOUS_PORT="$APP_PORT"
      PREVIOUS_IS_LEGACY=2
      BASE_ENV_FILE="$target/.env"
      require_owned_pm2 "$PM2_NAME" "$target" "$APP_PORT"
      echo "Explicit production bootstrap authorization accepted; retaining the legacy in-place API as the rollback target."
    else
      unexpected_entry="$(find "$target" -mindepth 1 -maxdepth 1 \
        ! -name '.env' ! -name '.htaccess' -print -quit)"
      if [[ -n "$unexpected_entry" ]]; then
        fail "Production bootstrap target contains existing files but no recognizable legacy API; refusing destructive initialization."
      fi
      PREVIOUS_IS_FRESH=1
      PREVIOUS_RELEASE=""
      PREVIOUS_PM2="$PM2_NAME"
      PREVIOUS_PORT="$APP_PORT"
      BASE_ENV_FILE="$target/.env"
      require_offline_pm2 "$PM2_NAME"
      echo "Explicit production bootstrap authorization accepted; no legacy API was found, so this is a first runtime activation."
    fi
  else
    fail "No previous known-good release found under ${target}; refusing deployment. Restore a release and PM2 definition before retrying."
  fi

  if [[ "$PREVIOUS_IS_FRESH" -eq 1 ]]; then
    return 0
  fi

  [[ "$PREVIOUS_PORT" =~ ^[0-9]+$ ]] ||
    fail "Previous release metadata has an invalid port; refusing deployment."
  validate_release "$PREVIOUS_RELEASE" "$PREVIOUS_SHA" "$PREVIOUS_IS_LEGACY"
  require_online_pm2 "$PREVIOUS_PM2"
  if ! verify_legacy_local_release "$PREVIOUS_PORT"; then
    fail "Previous release ${PREVIOUS_SHA} is not healthy on port ${PREVIOUS_PORT}; refusing destructive deployment."
  fi
  BASE_ENV_FILE="${BASE_ENV_FILE:-$PREVIOUS_RELEASE/.env}"
}

write_rollback_metadata() {
  if [[ "$PREVIOUS_IS_FRESH" -eq 1 ]]; then
    return 0
  fi
  mkdir -p "$rollback_root"
  write_state "$rollback_file" \
    "$PREVIOUS_SHA" "$PREVIOUS_VERSION" "$PREVIOUS_RELEASE" \
    "$PREVIOUS_PM2" "$PREVIOUS_PORT"
}

restore_previous() {
  local reason="$1"

  if [[ "$PREVIOUS_IS_FRESH" -eq 1 ]]; then
    echo "No previous API release existed; removing the failed bootstrap release after ${reason}."
    stop_release "$PM2_NAME"
    rm -rf "$release_dir"
    rmdir -- "$release_root" 2>/dev/null || true
    return 0
  fi

  echo "Restoring previous release ${PREVIOUS_SHA} after ${reason}."
  validate_release "$PREVIOUS_RELEASE" "$PREVIOUS_SHA" "$PREVIOUS_IS_LEGACY"

  stop_release "$PM2_NAME"
  if [[ "$PREVIOUS_PM2" != "$PM2_NAME" ]]; then
    stop_release "$PREVIOUS_PM2"
  fi
  start_release "$PREVIOUS_RELEASE" "$PREVIOUS_PM2" "$PREVIOUS_PORT"
  if [[ "$PREVIOUS_IS_LEGACY" -eq 2 ]]; then
    if ! verify_legacy_local_release "$PREVIOUS_PORT"; then
      fail "Rollback could not make the legacy production API healthy; investigate PM2 and Hostinger manually before retrying."
    fi
  elif ! verify_local_release "$PREVIOUS_RELEASE" "$PREVIOUS_PORT" "$PREVIOUS_SHA"; then
    fail "Rollback could not make previous release ${PREVIOUS_SHA} healthy; investigate PM2 and Hostinger manually before retrying."
  fi

  if [[ "$PREVIOUS_STATE_EXISTS" -eq 1 ]]; then
    atomic_symlink "$PREVIOUS_RELEASE" "$target/current"
    write_state "$state_file" \
      "$PREVIOUS_SHA" "$PREVIOUS_VERSION" "$PREVIOUS_RELEASE" \
      "$PREVIOUS_PM2" "$PREVIOUS_PORT"
  else
    rm -f "$state_file" "$target/current"
  fi
  "$pm2" save
  rm -f "$rollback_file"
  echo "Previous release ${PREVIOUS_SHA} restored; database migrations were not rolled back."
}

cleanup_remote() {
  if [[ -n "${release_staging:-}" && -d "$release_staging" ]]; then
    rm -rf "$release_staging"
  fi
  if [[ "${PREVIOUS_IS_FRESH:-0}" -eq 1 ]]; then
    rmdir -- "$release_root" 2>/dev/null || true
  fi
  rm -f "$HOME/${REMOTE_API_ARCHIVE}" "$HOME/${REMOTE_RUNTIME_ENV}"
}
trap cleanup_remote EXIT

load_previous_release
write_rollback_metadata

mkdir -p "$release_root"
if [[ -e "$release_dir" || -L "$release_dir" ]]; then
  fail "Release directory already exists for ${EXPECTED_SHA}: ${release_dir}. Refusing to overwrite a retained release."
fi

release_staging="${release_root}/.${EXPECTED_SHA}.staging.$$"
rm -rf "$release_staging"
mkdir -p "$release_staging"

if [[ ! -f "$HOME/${REMOTE_API_ARCHIVE}" ]]; then
  fail "Uploaded API artifact is missing: $HOME/${REMOTE_API_ARCHIVE}."
fi
if [[ ! -f "$HOME/${REMOTE_RUNTIME_ENV}" ]]; then
  fail "Uploaded runtime environment is missing: $HOME/${REMOTE_RUNTIME_ENV}."
fi

tar -xzf "$HOME/${REMOTE_API_ARCHIVE}" -C "$release_staging"
for required_file in dist/index.js package.json release.json prisma.config.ts \
  prisma/schema.prisma node_modules/prisma/build/index.js \
  verify-release-health.mjs; do
  [[ -f "$release_staging/$required_file" ]] ||
    fail "Extracted release is incomplete (missing ${required_file})."
done
if [[ "$ACTION" != "rollback-drill" && ! -f "$release_staging/verify-google-oauth-config.mjs" ]]; then
  fail "Extracted release is incomplete (missing verify-google-oauth-config.mjs)."
fi
for runtime_package in \
  node_modules/express/package.json \
  node_modules/@sentry/node/package.json \
  node_modules/ioredis/package.json \
  node_modules/@sync-erp/database/package.json \
  node_modules/@sync-erp/database/dist/index.js; do
  [[ -f "$release_staging/$runtime_package" ]] ||
    fail "Extracted release is incomplete (missing ${runtime_package})."
done

new_manifest="$(read_manifest "$release_staging")" ||
  fail "Extracted release manifest is unreadable."
IFS=$'\t' read -r NEW_SHA NEW_VERSION <<< "$new_manifest"
[[ "$NEW_SHA" == "$EXPECTED_SHA" ]] ||
  fail "Extracted release identity ${NEW_SHA} does not match expected ${EXPECTED_SHA}."

cp "$BASE_ENV_FILE" "$release_staging/.env"
google_oauth_client_id="$(decode_secret GOOGLE_OAUTH_CLIENT_ID)"
google_oauth_client_secret="$(decode_secret GOOGLE_OAUTH_CLIENT_SECRET)"
sync_erp_auth_state_secret="$(decode_secret SYNC_ERP_AUTH_STATE_SECRET)"
database_url="$(decode_secret DATABASE_URL)"
validate_database_url "$database_url"

upsert_env "$release_staging/.env" SYNC_ERP_API_URL "$API_URL"
upsert_env "$release_staging/.env" SYNC_ERP_API_BASE_URL "$API_BASE_URL"
upsert_env "$release_staging/.env" SYNC_ERP_WEB_URL "$WEB_URL"
upsert_env "$release_staging/.env" GOOGLE_OAUTH_REDIRECT_URI "$OAUTH_REDIRECT_URL"
upsert_env "$release_staging/.env" GOOGLE_OAUTH_CLIENT_ID "$google_oauth_client_id"
upsert_env "$release_staging/.env" GOOGLE_OAUTH_CLIENT_SECRET "$google_oauth_client_secret"
upsert_env "$release_staging/.env" SYNC_ERP_AUTH_STATE_SECRET "$sync_erp_auth_state_secret"
upsert_env "$release_staging/.env" DATABASE_URL "$database_url"
upsert_env "$release_staging/.env" HOSTINGER_ENV "$RUNTIME_ENV"
upsert_env "$release_staging/.env" NODE_ENV "$RUNTIME_ENV"
upsert_env "$release_staging/.env" CORS_ORIGIN "$CORS_ORIGINS"
upsert_env "$release_staging/.env" CORS_ALLOWED_ORIGINS "$CORS_ORIGINS"

if [[ "$ACTION" == "rollback-drill" ]]; then
  echo "Rollback drill explicitly skips database migrations; migration history will not be modified."
else
  echo "Applying forward-only database migrations before switching application traffic."
  if ! (
    cd "$release_staging"
    DATABASE_URL="$database_url" HOSTINGER_ENV="$RUNTIME_ENV" NODE_ENV="$RUNTIME_ENV" \
      node node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts
  ); then
    echo "Database migration failed before application switch; previous release ${PREVIOUS_SHA} remains active." >&2
    echo "Migrations are forward-only; this deployment does not attempt database rollback." >&2
    exit 1
  fi
fi

mv "$release_staging" "$release_dir"
release_staging=""

stop_release "$PREVIOUS_PM2"
if [[ "$PREVIOUS_PM2" != "$PM2_NAME" ]]; then
  stop_release "$PM2_NAME"
fi
if ! start_release "$release_dir" "$PM2_NAME" "$APP_PORT"; then
  restore_previous "new PM2 startup failure"
  fail "New release ${EXPECTED_SHA} could not start; previous release restored."
fi

if [[ "$ACTION" == "rollback-drill" ]]; then
  echo "Rollback drill intentionally injecting failure after new release startup."
  restore_previous "intentional rollback drill failure injection"
  rm -rf "$release_dir"
  restored_pid="$(pm2_pid "$PREVIOUS_PM2")"
  require_online_pm2 "$PREVIOUS_PM2"
  echo "ROLLBACK_DRILL_RESULT=success"
  echo "ROLLBACK_DRILL_MIGRATIONS=skipped"
  echo "ROLLBACK_DRILL_NEW_SHA=${EXPECTED_SHA}"
  echo "ROLLBACK_DRILL_ATTEMPT_PATH=${release_dir}"
  echo "ROLLBACK_DRILL_PREVIOUS_SHA=${PREVIOUS_SHA}"
  echo "ROLLBACK_DRILL_PREVIOUS_VERSION=${PREVIOUS_VERSION}"
  echo "ROLLBACK_DRILL_PREVIOUS_RELEASE=${PREVIOUS_RELEASE}"
  echo "ROLLBACK_DRILL_PREVIOUS_PM2=${PREVIOUS_PM2}"
  echo "ROLLBACK_DRILL_PREVIOUS_PORT=${PREVIOUS_PORT}"
  echo "ROLLBACK_DRILL_PREVIOUS_PID=${restored_pid}"
  exit 0
fi

if ! verify_local_release "$release_dir" "$APP_PORT" "$EXPECTED_SHA"; then
  restore_previous "new local health or release-identity failure"
  fail "New release ${EXPECTED_SHA} failed local health or release identity; previous release restored."
fi

atomic_symlink "$release_dir" "$target/current"
write_state "$state_file" "$EXPECTED_SHA" "$NEW_VERSION" "$release_dir" "$PM2_NAME" "$APP_PORT"
"$pm2" save
rm -f "$rollback_file"
if [[ "$PREVIOUS_IS_FRESH" -eq 1 ]]; then
  echo "Activated API release ${EXPECTED_SHA} from ${release_dir}; production bootstrap completed without a previous release."
elif [[ "$PREVIOUS_IS_LEGACY" -eq 2 ]]; then
  echo "Activated API release ${EXPECTED_SHA} from ${release_dir}; legacy in-place release retained as the rollback target."
else
  echo "Activated API release ${EXPECTED_SHA} from ${release_dir}; previous release ${PREVIOUS_SHA} remains retained."
fi
