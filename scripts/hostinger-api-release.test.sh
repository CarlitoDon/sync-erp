#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
release_script="$repo_root/scripts/hostinger-api-release.sh"
real_node="$(command -v node)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/sync-erp-hostinger-release-test.XXXXXX")"
trap 'rm -rf "$test_root"' EXIT

assert_contains() {
  local needle="$1"
  local haystack="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Expected output to contain: ${needle}" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

write_file() {
  local file="$1"
  local contents="$2"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$contents" > "$file"
}

make_mocks() {
  local root="$1"
  local bin="$root/bin"
  mkdir -p "$bin"

  cat > "$bin/node" <<'MOCK_NODE'
#!/usr/bin/env bash
set -euo pipefail

for argument in "$@"; do
  if [[ "$argument" == node_modules/prisma/build/index.js || "$argument" == */node_modules/prisma/build/index.js ]]; then
    if [[ -n "${MOCK_MIGRATION_LOG:-}" ]]; then
      printf 'prisma migrate deploy\n' >> "$MOCK_MIGRATION_LOG"
    fi
    if [[ "${MOCK_MIGRATION_RESULT:-success}" == "fail" ]]; then
      echo "mock migration failure" >&2
      exit 1
    fi
    exit 0
  fi
done

current_cwd=""
if [[ -f "${MOCK_PM2_STORE:-}" ]]; then
  current_line="$(cat "$MOCK_PM2_STORE")"
  current_cwd="$(printf '%s' "$current_line" | cut -d '|' -f 2)"
fi

if [[ "${1:-}" == */verify-release-health.mjs ]]; then
  edge_request=0
  for argument in "$@"; do
    if [[ "$argument" == https://* ]]; then
      edge_request=1
    fi
  done
  if [[ "${MOCK_EDGE_HEALTH_RESULT:-success}" == "fail" &&
    "$edge_request" -eq 1 &&
    "$current_cwd" == *"/releases/${EXPECTED_SHA}" ]]; then
    echo "mock public edge release identity failure" >&2
    exit 1
  fi
  if [[ "${MOCK_HEALTH_RESULT:-success}" == "fail" && "$current_cwd" == *"/releases/${EXPECTED_SHA}" ]]; then
    echo "mock release identity failure" >&2
    exit 1
  fi
  exit 0
fi

if [[ "${1:-}" == */verify-google-oauth-config.mjs ]]; then
  if [[ -n "${MOCK_OAUTH_LOG:-}" ]]; then
    printf '%s\n' "$*" >> "$MOCK_OAUTH_LOG"
  fi
  if [[ "${MOCK_OAUTH_RESULT:-success}" == "fail" && "$current_cwd" == *"/releases/${EXPECTED_SHA}" ]]; then
    echo "mock OAuth redirect failure" >&2
    exit 1
  fi
  exit 0
fi

exec "$REAL_NODE" "$@"
MOCK_NODE
  chmod +x "$bin/node"

  cat > "$bin/sleep" <<'MOCK_SLEEP'
#!/usr/bin/env bash
exit 0
MOCK_SLEEP
  chmod +x "$bin/sleep"

  cat > "$bin/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
set -euo pipefail

header_file=""
url=""
for ((index = 1; index <= $#; index += 1)); do
  argument="${!index}"
  if [[ "$argument" == "-D" ]]; then
    next=$((index + 1))
    header_file="${!next}"
  fi
  if [[ "$argument" == http://* || "$argument" == https://* ]]; then
    url="$argument"
  fi
done

current_cwd=""
if [[ -f "${MOCK_PM2_STORE:-}" ]]; then
  current_line="$(cat "$MOCK_PM2_STORE")"
  current_cwd="$(printf '%s' "$current_line" | cut -d '|' -f 2)"
fi

if [[ "${MOCK_HEALTH_RESULT:-success}" == "fail" && "$current_cwd" == *"/releases/${EXPECTED_SHA}" ]]; then
  exit 1
fi

if [[ -n "$header_file" ]]; then
  printf 'access-control-allow-origin: %s\n' "${WEB_URL}" > "$header_file"
fi

printf '{"status":"ok"}\n'
MOCK_CURL
  chmod +x "$bin/curl"

  mkdir -p "$root/node-pm2/node_modules/.bin"
  cat > "$root/node-pm2/node_modules/.bin/pm2" <<'MOCK_PM2'
#!/usr/bin/env bash
set -euo pipefail

store="$MOCK_PM2_STORE"
command_name="${1:-}"
case "$command_name" in
  pid)
    name="${2:-}"
    if [[ -f "$store" && "$(cut -d '|' -f 1 "$store")" == "$name" ]]; then
      printf '4242\n'
    else
      printf '0\n'
    fi
    ;;
  describe)
    name="${2:-}"
    [[ -f "$store" && "$(cut -d '|' -f 1 "$store")" == "$name" ]]
    ;;
  start)
    name=""
    cwd=""
    for ((index = 1; index <= $#; index += 1)); do
      argument="${!index}"
      if [[ "$argument" == "--name" ]]; then
        next=$((index + 1))
        name="${!next}"
      elif [[ "$argument" == "--cwd" ]]; then
        next=$((index + 1))
        cwd="${!next}"
      fi
    done
    if [[ "${MOCK_START_RESULT:-success}" == "fail" && "$cwd" == *"/releases/${EXPECTED_SHA}" ]]; then
      echo "mock PM2 start failure" >&2
      exit 1
    fi
    printf '%s|%s|%s|4242\n' "$name" "$cwd" "${PORT}" > "$store"
    ;;
  delete)
    name="${2:-}"
    if [[ -f "$store" && "$(cut -d '|' -f 1 "$store")" == "$name" ]]; then
      rm -f "$store"
    fi
    ;;
  logs)
    ;;
  save)
    touch "$MOCK_PM2_SAVED"
    ;;
  *)
    echo "unsupported mock pm2 command: $*" >&2
    exit 1
    ;;
esac
MOCK_PM2
  chmod +x "$root/node-pm2/node_modules/.bin/pm2"
}

new_sha="$(printf 'a%.0s' {1..40})"
old_sha="$(printf 'b%.0s' {1..40})"

setup_case() {
  local name="$1"
  local root="$test_root/$name"
  local target="$root/public_html/apps/api-staging"
  local artifact="$root/artifact"
  local archive="$root/api.tar.gz"
  local runtime_env="$root/runtime.env"
  local mocks="$root/mocks"

  mkdir -p "$target/dist" "$artifact/dist" "$artifact/prisma" \
    "$artifact/node_modules/prisma/build" "$mocks"
  make_mocks "$root"

  write_file "$target/dist/index.js" 'old release'
  write_file "$target/.env" 'EXISTING_CONFIG=true'
  # The first staging release predates release-version metadata. The helper
  # must preserve it as a known-good legacy release while using an explicit
  # unknown version in rollback metadata.
  write_file "$target/release.json" "{\"schemaVersion\":1,\"service\":\"sync-erp-api\",\"commit\":\"${old_sha}\"}"

  write_file "$artifact/dist/index.js" 'new release'
  write_file "$artifact/package.json" '{"name":"@sync-erp/api"}'
  write_file "$artifact/release.json" "{\"schemaVersion\":1,\"service\":\"sync-erp-api\",\"commit\":\"${new_sha}\",\"version\":\"new\"}"
  write_file "$artifact/prisma.config.ts" 'export default {};'
  write_file "$artifact/prisma/schema.prisma" 'datasource db { provider = "postgresql" }'
  write_file "$artifact/node_modules/prisma/build/index.js" 'mock prisma'
  write_file "$artifact/node_modules/express/package.json" '{}'
  write_file "$artifact/node_modules/@sentry/node/package.json" '{}'
  write_file "$artifact/node_modules/ioredis/package.json" '{}'
  write_file "$artifact/node_modules/@sync-erp/database/package.json" '{}'
  write_file "$artifact/node_modules/@sync-erp/database/dist/index.js" 'mock database'
  write_file "$artifact/verify-release-health.mjs" 'mock verifier'
  write_file "$artifact/verify-google-oauth-config.mjs" 'mock OAuth verifier'
  tar -czf "$archive" -C "$artifact" .

  {
    printf 'GOOGLE_OAUTH_CLIENT_ID=%s\n' "$(printf 'client' | base64 | tr -d '\n')"
    printf 'GOOGLE_OAUTH_CLIENT_SECRET=%s\n' "$(printf 'secret' | base64 | tr -d '\n')"
    printf 'SYNC_ERP_AUTH_STATE_SECRET=%s\n' "$(printf 'auth' | base64 | tr -d '\n')"
    printf 'DATABASE_URL=%s\n' "$(printf 'postgres.ctesbnhcqubamrtcxxqi:5432/db' | base64 | tr -d '\n')"
  } > "$runtime_env"

  printf 'sync-erp-api-staging|%s|3001|4242\n' "$target" > "$root/pm2.store"

  printf '%s\n' "$root"
}

run_release() {
  local root="$1"
  shift
  local action="${1:-deploy}"
  local target="$root/public_html/apps/api-staging"
  local archive="$root/api.tar.gz"
  local runtime_env="$root/runtime.env"
  local output
  local status=0

  output="$({
    HOME="$root" \
      PATH="$root/bin:$PATH" \
      REAL_NODE="$real_node" \
      MOCK_PM2_STORE="$root/pm2.store" \
      MOCK_PM2_SAVED="$root/pm2.saved" \
      MOCK_HEALTH_RESULT="${MOCK_HEALTH_RESULT:-success}" \
      MOCK_EDGE_HEALTH_RESULT="${MOCK_EDGE_HEALTH_RESULT:-success}" \
      MOCK_OAUTH_RESULT="${MOCK_OAUTH_RESULT:-success}" \
      MOCK_MIGRATION_RESULT="${MOCK_MIGRATION_RESULT:-success}" \
      MOCK_START_RESULT="${MOCK_START_RESULT:-success}" \
      MOCK_MIGRATION_LOG="${MOCK_MIGRATION_LOG:-$root/migrations.log}" \
      MOCK_OAUTH_LOG="${MOCK_OAUTH_LOG:-$root/oauth.log}" \
      DEPLOY_DIR='apps/api-staging' \
      PM2_NAME='sync-erp-api-staging' \
      APP_PORT='3001' \
      RUNTIME_ENV="${MOCK_RUNTIME_ENV:-staging}" \
      DATABASE_PROJECT_REF='ctesbnhcqubamrtcxxqi' \
      EXPECTED_SHA="$new_sha" \
      REMOTE_API_ARCHIVE="$(basename "$archive")" \
      REMOTE_RUNTIME_ENV="$(basename "$runtime_env")" \
      API_URL='https://api-staging.example/api/trpc' \
      API_BASE_URL='https://api-staging.example' \
      WEB_URL='https://web-staging.example' \
      OAUTH_REDIRECT_URL='https://api-staging.example/callback' \
      CORS_ORIGINS='https://web-staging.example' \
      ROLLBACK_DRILL_CONFIRMATION='ROLLBACK_STAGING' \
      DRILL_ID='deterministic-test' \
      bash "$release_script" "$action"
  } 2>&1)" || status=$?

  printf '%s\n' "$output"
  return "$status"
}

setup_versioned_current() {
  local root="$1"
  local target="$root/public_html/apps/api-staging"
  local old_release="$target/releases/$old_sha"

  mkdir -p "$old_release/dist"
  cp "$target/dist/index.js" "$old_release/dist/index.js"
  cp "$target/.env" "$old_release/.env"
  write_file "$old_release/release.json" \
    "{\"schemaVersion\":1,\"service\":\"sync-erp-api\",\"commit\":\"${old_sha}\",\"version\":\"old\"}"
  ln -s "$old_release" "$target/current"
  write_file "$target/.release-state.json" \
    "{\"schemaVersion\":1,\"service\":\"sync-erp-api\",\"commit\":\"${old_sha}\",\"version\":\"old\",\"releasePath\":\"${old_release}\",\"pm2Name\":\"sync-erp-api-staging\",\"port\":3001}"
  printf 'sync-erp-api-staging|%s|3001|4242\n' "$old_release" > "$root/pm2.store"
}

success_root="$(setup_case success)"
success_output="$(run_release "$success_root")"
assert_contains "Activated API release ${new_sha}" "$success_output"
assert_contains 'using unknown' "$success_output"
assert_contains \
  '--request-url http://127.0.0.1:3001/api/auth/google/start?intent=login --expected-redirect-uri https://api-staging.example/callback' \
  "$(cat "$success_root/oauth.log")"
[[ -f "$success_root/public_html/apps/api-staging/releases/${new_sha}/release.json" ]]
[[ "$(readlink "$success_root/public_html/apps/api-staging/current")" == "$success_root/public_html/apps/api-staging/releases/${new_sha}" ]]
[[ "$(node -e "console.log(JSON.parse(require('node:fs').readFileSync('$success_root/public_html/apps/api-staging/.release-state.json')).commit)")" == "$new_sha" ]]
[[ "$(cut -d '|' -f 2 "$success_root/pm2.store")" == "$success_root/public_html/apps/api-staging/releases/${new_sha}" ]]
[[ ! -e "$success_root/public_html/apps/api-staging/.release-rollback/${new_sha}.json" ]]

existing_current_root="$(setup_case existing-current-symlink)"
setup_versioned_current "$existing_current_root"
existing_current_output="$(run_release "$existing_current_root")"
assert_contains "Activated API release ${new_sha}" "$existing_current_output"
[[ "$(readlink "$existing_current_root/public_html/apps/api-staging/current")" == "$existing_current_root/public_html/apps/api-staging/releases/${new_sha}" ]]
[[ "$(node -e "console.log(JSON.parse(require('node:fs').readFileSync('$existing_current_root/public_html/apps/api-staging/.release-state.json')).commit)")" == "$new_sha" ]]
[[ "$(cut -d '|' -f 2 "$existing_current_root/pm2.store")" == "$existing_current_root/public_html/apps/api-staging/releases/${new_sha}" ]]

drill_root="$(setup_case rollback-drill)"
drill_output="$(MOCK_MIGRATION_LOG="$drill_root/drill-migrations.log" run_release "$drill_root" rollback-drill)"
assert_contains 'Rollback drill explicitly skips database migrations' "$drill_output"
assert_contains 'Rollback drill intentionally injecting failure after new release startup' "$drill_output"
assert_contains 'ROLLBACK_DRILL_RESULT=success' "$drill_output"
assert_contains 'ROLLBACK_DRILL_MIGRATIONS=skipped' "$drill_output"
assert_contains 'ROLLBACK_DRILL_ATTEMPT_PATH=' "$drill_output"
assert_contains "ROLLBACK_DRILL_PREVIOUS_SHA=${old_sha}" "$drill_output"
assert_contains "ROLLBACK_DRILL_PREVIOUS_RELEASE=$drill_root/public_html/apps/api-staging" "$drill_output"
[[ ! -s "$drill_root/drill-migrations.log" ]]
[[ "$(cut -d '|' -f 2 "$drill_root/pm2.store")" == "$drill_root/public_html/apps/api-staging" ]]
[[ "$(node -e "console.log(JSON.parse(require('node:fs').readFileSync('$drill_root/public_html/apps/api-staging/release.json')).commit)")" == "$old_sha" ]]
[[ ! -e "$drill_root/public_html/apps/api-staging/.release-rollback/${new_sha}.json" ]]
[[ ! -e "$drill_root/public_html/apps/api-staging/releases/.rollback-drill-deterministic-test" ]]

production_root="$(setup_case production-rejected)"
if production_output="$(MOCK_RUNTIME_ENV=production MOCK_MIGRATION_LOG="$production_root/production-migrations.log" run_release "$production_root" rollback-drill)"; then
  echo 'Expected production rollback drill to be rejected.' >&2
  exit 1
fi
assert_contains 'Rollback drill is staging-only' "$production_output"
[[ ! -s "$production_root/production-migrations.log" ]]
[[ "$(cut -d '|' -f 2 "$production_root/pm2.store")" == "$production_root/public_html/apps/api-staging" ]]

health_root="$(setup_case health-failure)"
if health_output="$(MOCK_HEALTH_RESULT=fail run_release "$health_root")"; then
  echo 'Expected health failure case to fail.' >&2
  exit 1
fi
assert_contains "Previous release ${old_sha} restored" "$health_output"
[[ "$(cut -d '|' -f 2 "$health_root/pm2.store")" == "$health_root/public_html/apps/api-staging" ]]
[[ ! -f "$health_root/public_html/apps/api-staging/.release-state.json" ]]

edge_root="$(setup_case public-edge-failure)"
if edge_output="$(MOCK_EDGE_HEALTH_RESULT=fail run_release "$edge_root")"; then
  echo 'Expected public edge health failure case to fail.' >&2
  exit 1
fi
assert_contains "Previous release ${old_sha} restored" "$edge_output"
[[ "$(cut -d '|' -f 2 "$edge_root/pm2.store")" == "$edge_root/public_html/apps/api-staging" ]]
[[ ! -f "$edge_root/public_html/apps/api-staging/.release-state.json" ]]

oauth_root="$(setup_case oauth-failure)"
if oauth_output="$(MOCK_OAUTH_RESULT=fail run_release "$oauth_root")"; then
  echo 'Expected OAuth redirect failure case to fail.' >&2
  exit 1
fi
assert_contains "Previous release ${old_sha} restored" "$oauth_output"
[[ "$(cut -d '|' -f 2 "$oauth_root/pm2.store")" == "$oauth_root/public_html/apps/api-staging" ]]
[[ ! -f "$oauth_root/public_html/apps/api-staging/.release-state.json" ]]

migration_root="$(setup_case migration-failure)"
if migration_output="$(MOCK_MIGRATION_RESULT=fail run_release "$migration_root")"; then
  echo 'Expected migration failure case to fail.' >&2
  exit 1
fi
assert_contains 'Migrations are forward-only' "$migration_output"
[[ "$(cut -d '|' -f 2 "$migration_root/pm2.store")" == "$migration_root/public_html/apps/api-staging" ]]
[[ ! -d "$migration_root/public_html/apps/api-staging/releases/${new_sha}" ]]

missing_root="$(setup_case missing-previous)"
rm -f "$missing_root/public_html/apps/api-staging/release.json"
if missing_output="$(run_release "$missing_root" rollback-drill)"; then
  echo 'Expected missing previous release case to fail.' >&2
  exit 1
fi
assert_contains 'No previous known-good release found' "$missing_output"

echo 'Hostinger API release rollback tests passed: success, health rollback, migration fail-closed, and no previous release.'
