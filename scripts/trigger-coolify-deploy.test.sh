#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
helper_path="$repo_root/scripts/trigger-coolify-deploy.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/sync-erp-coolify-trigger-test.XXXXXX")"
fake_bin="$test_root/bin"
args_file="$test_root/curl-args"
config_file="$test_root/curl-config"
mkdir -p "$fake_bin"

cleanup() {
  rm -rf -- "$test_root"
}
trap cleanup EXIT

fail() {
  printf 'trigger-coolify-deploy contract test failed: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  [[ "$haystack" == *"$needle"* ]] || fail "expected output to contain: $needle"
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  [[ "$haystack" != *"$needle"* ]] || fail "output unexpectedly contained sensitive value or forbidden text"
}

assert_file_contains() {
  local path="$1"
  local needle="$2"
  grep -F -- "$needle" "$path" >/dev/null || fail "expected $path to contain: $needle"
}

assert_file_not_contains() {
  local path="$1"
  local needle="$2"
  if grep -F -- "$needle" "$path" >/dev/null 2>&1; then
    fail "$path unexpectedly contained URL or secret material"
  fi
}

assert_file_not_contains_exact_line() {
  local path="$1"
  local line="$2"
  if grep -Fx -- "$line" "$path" >/dev/null 2>&1; then
    fail "$path unexpectedly contained the obsolete workflow guard"
  fi
}

workflow_path="$repo_root/.github/workflows/deploy-coolify.yml"
ci_workflow_path="$repo_root/.github/workflows/ci-cd.yml"
helper_path="$repo_root/scripts/trigger-coolify-deploy.sh"
assert_file_contains "$ci_workflow_path" 'run: bash scripts/trigger-coolify-deploy.test.sh'
assert_file_not_contains "$ci_workflow_path" 'run: npm run test:coolify-trigger'
assert_file_contains "$workflow_path" 'COOLIFY_CALLER_EVENT_NAME: ${{ inputs.caller_event }}'
assert_file_contains "$workflow_path" 'if [[ -n "$COOLIFY_CALLER_EVENT_NAME" ]]; then'
assert_file_contains "$workflow_path" 'elif [[ "$GITHUB_EVENT_NAME" == workflow_dispatch && "$COOLIFY_SERVICE" != bot ]]; then'
assert_file_not_contains_exact_line "$workflow_path" '          if [[ "$GITHUB_EVENT_NAME" == workflow_dispatch && "$COOLIFY_SERVICE" != bot ]]; then'
assert_file_contains "$helper_path" 'event_name="${GITHUB_EVENT_NAME:-}"'
assert_file_contains "$helper_path" 'event_name="${COOLIFY_CALLER_EVENT_NAME:-}"'
assert_file_contains "$helper_path" 'if [ "$event_name" = '\''workflow_call'\'' ]; then'

cat > "$fake_bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail

: > "$FAKE_CURL_ARGS_FILE"
for argument in "$@"; do
  printf '%s\n' "$argument" >> "$FAKE_CURL_ARGS_FILE"
done
cat > "$FAKE_CURL_CONFIG_FILE"
if [ "${FAKE_CURL_EXIT:-0}" -ne 0 ]; then
  printf '%s\n' 'synthetic curl diagnostic must stay hidden' >&2
  exit "$FAKE_CURL_EXIT"
fi
printf '%s' "${FAKE_CURL_STATUS:-202}"
FAKE_CURL
chmod 700 "$fake_bin/curl"

synthetic_secret='synthetic-coolify-webhook-secret-never-log'
synthetic_url='https://coolify.example.test/hooks/synthetic-webhook'
common_env=(
  "PATH=$fake_bin:$PATH"
  "FAKE_CURL_ARGS_FILE=$args_file"
  "FAKE_CURL_CONFIG_FILE=$config_file"
  "COOLIFY_DEPLOY_WEBHOOK=$synthetic_url"
)

run_success() {
  local service="$1"
  local environment="$2"
  local ref="$3"
  local status="${4:-202}"
  local output
  : > "$args_file"
  : > "$config_file"
  output="$(env "${common_env[@]}" FAKE_CURL_STATUS="$status" GITHUB_EVENT_NAME=push GITHUB_REF="$ref" \
    bash "$helper_path" "$service" "$environment" 2>&1)" || fail "expected $service/$environment to succeed"
  assert_contains "$output" "Coolify deploy webhook accepted for $service/$environment (HTTP $status)."
  assert_not_contains "$output" "$synthetic_url"
  assert_not_contains "$output" "$synthetic_secret"
  assert_file_contains "$args_file" '-q'
  [ "$(sed -n '1p' "$args_file")" = '-q' ] || fail 'curl -q was not the first argument'
  assert_file_contains "$args_file" '--globoff'
  assert_file_contains "$args_file" '--config'
  assert_file_contains "$args_file" '-'
  assert_file_not_contains "$args_file" "$synthetic_url"
  assert_file_contains "$config_file" "url = \"$synthetic_url\""
  assert_file_contains "$config_file" 'request = POST'
  assert_file_contains "$config_file" 'connect-timeout = 10'
  assert_file_contains "$config_file" 'max-time = 30'
  assert_file_contains "$config_file" 'max-redirs = 0'
  assert_file_contains "$config_file" 'retry = 0'
  assert_file_contains "$config_file" 'output = /dev/null'
  assert_file_contains "$config_file" 'write-out = "%{http_code}"'
}

# Exercise every explicit service/environment mapping and both branch routes.
run_success api staging refs/heads/dev 202
run_success bot staging refs/heads/dev 204
run_success mcp staging refs/heads/dev 299
run_success api production refs/heads/main 200
run_success bot production refs/heads/main 201
run_success mcp production refs/heads/main 202

run_failure() {
  local expected="$1"
  shift
  local output
  if output="$("$@" 2>&1)"; then
    fail "expected command to fail: $expected"
  fi
  assert_contains "$output" "$expected"
  assert_not_contains "$output" "$synthetic_url"
  assert_not_contains "$output" "$synthetic_secret"
}

# Exact secret naming is actionable for all six routes and does not require
# reading or printing any real secret value.
for route in \
  'api staging COOLIFY_DEPLOY_WEBHOOK_API_STAGING' \
  'api production COOLIFY_DEPLOY_WEBHOOK_API_PRODUCTION' \
  'bot staging COOLIFY_DEPLOY_WEBHOOK_BOT_STAGING' \
  'bot production COOLIFY_DEPLOY_WEBHOOK_BOT_PRODUCTION' \
  'mcp staging COOLIFY_DEPLOY_WEBHOOK_MCP_STAGING' \
  'mcp production COOLIFY_DEPLOY_WEBHOOK_MCP_PRODUCTION'; do
  read -r service environment secret_name <<< "$route"
  run_failure "missing Coolify webhook secret; set $secret_name" \
    env "PATH=$fake_bin:$PATH" "FAKE_CURL_ARGS_FILE=$args_file" \
      "FAKE_CURL_CONFIG_FILE=$config_file" GITHUB_EVENT_NAME=push \
      GITHUB_REF="$([ "$environment" = staging ] && printf '%s' refs/heads/dev || printf '%s' refs/heads/main)" \
      env -u COOLIFY_DEPLOY_WEBHOOK bash "$helper_path" "$service" "$environment"
done

run_failure 'unsupported service' env "${common_env[@]}" GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/dev \
  bash "$helper_path" worker staging
run_failure 'unsupported environment' env "${common_env[@]}" GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/dev \
  bash "$helper_path" api preview
run_failure 'environment '\''staging'\'' does not match branch routing' env "${common_env[@]}" \
  GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/main bash "$helper_path" api staging
run_failure 'deployment requires GITHUB_REF refs/heads/dev or refs/heads/main' env "${common_env[@]}" \
  GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/feature/test bash "$helper_path" api staging
run_failure 'pull_request deployments are disabled' env "${common_env[@]}" \
  GITHUB_EVENT_NAME=pull_request GITHUB_REF=refs/heads/dev bash "$helper_path" api staging
run_failure 'unsupported GitHub event' env "${common_env[@]}" \
  GITHUB_EVENT_NAME=schedule GITHUB_REF=refs/heads/dev bash "$helper_path" api staging
run_failure 'workflow_call requires COOLIFY_CALLER_EVENT_NAME=push or workflow_dispatch' \
  env "${common_env[@]}" GITHUB_EVENT_NAME=workflow_call GITHUB_REF=refs/heads/dev \
  bash "$helper_path" api staging
run_failure 'pull_request deployments are disabled' env "${common_env[@]}" \
  GITHUB_EVENT_NAME=workflow_call COOLIFY_CALLER_EVENT_NAME=pull_request GITHUB_REF=refs/heads/dev \
  bash "$helper_path" api staging

run_success_with_xtrace() {
  local output
  output="$(env "${common_env[@]}" GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/dev \
    bash -x "$helper_path" api staging 2>&1)" || fail 'xtrace smoke test unexpectedly failed'
  assert_not_contains "$output" "$synthetic_url"
}
run_success_with_xtrace

# Non-2xx responses, including a redirect, fail closed. 299 is a valid 2xx
# response and was accepted above.
for status in 300 301 399 400 500; do
  run_failure "Coolify rejected api/staging webhook with HTTP $status" \
    env "${common_env[@]}" FAKE_CURL_STATUS="$status" GITHUB_EVENT_NAME=push \
      GITHUB_REF=refs/heads/dev bash "$helper_path" api staging
done

run_failure 'webhook request failed for api/staging (network or curl error)' \
  env "${common_env[@]}" FAKE_CURL_EXIT=7 GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/dev \
  bash "$helper_path" api staging

for unsafe_url in \
  'http://coolify.example.test/hooks/synthetic' \
  'https://coolify.example.test/hooks/synthetic";echo-injected' \
  "https://coolify.example.test/hooks/synthetic'quoted" \
  'https://coolify.example.test/hooks/synthetic\backslash' \
  'https://coolify.example.test/hooks/synthetic path' \
  'https://coolify.example.test/hooks/synthetic#fragment' \
  'https:///hooks/missing-host' \
  'https://coolify.example.test:bad/hooks/synthetic'; do
  run_failure 'Coolify webhook URL' env "PATH=$fake_bin:$PATH" \
    "FAKE_CURL_ARGS_FILE=$args_file" "FAKE_CURL_CONFIG_FILE=$config_file" \
    COOLIFY_DEPLOY_WEBHOOK="$unsafe_url" GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/dev \
    bash "$helper_path" api staging
done

printf 'trigger-coolify-deploy contract tests passed.\n'
