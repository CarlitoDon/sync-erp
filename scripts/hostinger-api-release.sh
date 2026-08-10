#!/usr/bin/env bash

# Hostinger API release transaction.
#
# The workflow uploads an immutable artifact and this script runs on Hostinger.
# A database migration is deliberately performed before the PM2 switch. A
# failed migration exits while the previous application is still serving;
# migrations are forward-only and are never rolled back by this script.

set -euo pipefail

ACTION="${1:-}"
if [[ "$ACTION" != "deploy" ]]; then
  echo "Usage: $0 deploy" >&2
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

target="$HOME/public_html/${DEPLOY_DIR}"
release_root="$target/releases"
release_dir="$release_root/$EXPECTED_SHA"
rollback_root="$target/.release-rollback"
rollback_file="$rollback_root/$EXPECTED_SHA.json"
state_file="$target/.release-state.json"
pm2="$HOME/node-pm2/node_modules/.bin/pm2"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

resolve_link() {
  local link="$1"
  local destination
  destination="$(readlink "$link")"
  case "$destination" in
    /*) printf '%s\n' "$destination" ;;
    *) printf '%s/%s\n' "$(cd "$(dirname "$link")" && pwd -P)" "$destination" ;;
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
  mv -f "$temporary" "$link"
}

validate_release() {
  local release_path="$1"
  local expected_commit="$2"
  local allow_unknown_version="${3:-0}"
  local manifest_values
  local manifest_commit

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
  local verifier_path="$release_path/verify-release-health.mjs"

  # The legacy in-place release may predate the verifier file. The new
  # release already contains the same verifier, so use it to validate the
  # retained release during rollback without mutating the old directory.
  if [[ ! -f "$verifier_path" ]]; then
    verifier_path="$release_dir/verify-release-health.mjs"
  fi
  [[ -f "$verifier_path" ]] || return 1

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

  node "$verifier_path" \
    --url "http://127.0.0.1:${port}/health" \
    --expected-sha "$expected_commit"
  node "$verifier_path" \
    --url "http://127.0.0.1:${port}/mcp/health" \
    --expected-sha "$expected_commit"

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

  if [[ -f "$state_file" ]]; then
    PREVIOUS_STATE_EXISTS=1
    state_values="$(read_state "$state_file")" ||
      fail "Active release state is unreadable: ${state_file}. Refusing deployment."
    IFS=$'\t' read -r PREVIOUS_SHA PREVIOUS_VERSION PREVIOUS_RELEASE PREVIOUS_PM2 PREVIOUS_PORT <<< "$state_values"
    if [[ ! -L "$target/current" ]]; then
      fail "Active release state exists without ${target}/current; refusing deployment."
    fi
    current_path="$(resolve_link "$target/current")"
    [[ "$current_path" == "$PREVIOUS_RELEASE" ]] ||
      fail "Active release state and current symlink disagree; refusing deployment."
  elif [[ -f "$target/release.json" ]]; then
    PREVIOUS_SHA_AND_VERSION="$(read_manifest "$target" 1)" ||
      fail "Legacy active release manifest is unreadable; refusing deployment."
    IFS=$'\t' read -r PREVIOUS_SHA PREVIOUS_VERSION <<< "$PREVIOUS_SHA_AND_VERSION"
    PREVIOUS_RELEASE="$target"
    PREVIOUS_PM2="$PM2_NAME"
    PREVIOUS_PORT="$APP_PORT"
    PREVIOUS_IS_LEGACY=1
  else
    fail "No previous known-good release found under ${target}; refusing deployment. Restore a release and PM2 definition before retrying."
  fi

  [[ "$PREVIOUS_PORT" =~ ^[0-9]+$ ]] ||
    fail "Previous release metadata has an invalid port; refusing deployment."
  validate_release "$PREVIOUS_RELEASE" "$PREVIOUS_SHA" "$PREVIOUS_IS_LEGACY"
  require_online_pm2 "$PREVIOUS_PM2"
  if ! curl -fsS --connect-timeout 5 --max-time 10 \
    "http://127.0.0.1:${PREVIOUS_PORT}/health" >/dev/null; then
    fail "Previous release ${PREVIOUS_SHA} is not healthy on port ${PREVIOUS_PORT}; refusing destructive deployment."
  fi
}

write_rollback_metadata() {
  mkdir -p "$rollback_root"
  write_state "$rollback_file" \
    "$PREVIOUS_SHA" "$PREVIOUS_VERSION" "$PREVIOUS_RELEASE" \
    "$PREVIOUS_PM2" "$PREVIOUS_PORT"
}

restore_previous() {
  local reason="$1"
  echo "Restoring previous release ${PREVIOUS_SHA} after ${reason}."
  validate_release "$PREVIOUS_RELEASE" "$PREVIOUS_SHA" "$PREVIOUS_IS_LEGACY"

  stop_release "$PM2_NAME"
  if [[ "$PREVIOUS_PM2" != "$PM2_NAME" ]]; then
    stop_release "$PREVIOUS_PM2"
  fi
  start_release "$PREVIOUS_RELEASE" "$PREVIOUS_PM2" "$PREVIOUS_PORT"
  if ! verify_local_release "$PREVIOUS_RELEASE" "$PREVIOUS_PORT" "$PREVIOUS_SHA"; then
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

cp "$PREVIOUS_RELEASE/.env" "$release_staging/.env"
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

if ! verify_local_release "$release_dir" "$APP_PORT" "$EXPECTED_SHA"; then
  restore_previous "new local health or release-identity failure"
  fail "New release ${EXPECTED_SHA} failed local health or release identity; previous release restored."
fi

atomic_symlink "$release_dir" "$target/current"
write_state "$state_file" "$EXPECTED_SHA" "$NEW_VERSION" "$release_dir" "$PM2_NAME" "$APP_PORT"
"$pm2" save
rm -f "$rollback_file"
echo "Activated API release ${EXPECTED_SHA} from ${release_dir}; previous release ${PREVIOUS_SHA} remains retained."
