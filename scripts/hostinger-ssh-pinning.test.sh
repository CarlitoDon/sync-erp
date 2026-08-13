#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
helper_path="$repo_root/scripts/hostinger-ssh-pinning.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/sync-erp-hostinger-ssh-pinning-test.XXXXXX")"
trap 'rm -rf "$test_root"' EXIT

fail() {
  printf 'hostinger-ssh-pinning contract test failed: %s\n' "$1" >&2
  exit 1
}

assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"

  if [ "$expected" != "$actual" ]; then
    fail "$label"
  fi
}

assert_file_absent() {
  local file="$1"
  local label="$2"

  if [ -e "$file" ]; then
    fail "$label"
  fi
}

assert_no_pin_output() {
  local needle="$1"
  local output_file="$2"
  local label="$3"

  if grep -F "$needle" "$output_file" >/dev/null 2>&1; then
    fail "$label"
  fi
}

file_mode() {
  local file="$1"
  local mode=""

  if mode="$(stat -c '%a' "$file" 2>/dev/null)"; then
    printf '%s\n' "$mode"
  else
    stat -f '%Lp' "$file"
  fi
}

assert_no_helper_files() {
  local runner_dir="$1"
  local candidate=""

  for candidate in "$runner_dir"/hostinger-known-hosts.*; do
    if [ -e "$candidate" ]; then
      fail "failed helper invocation left a temporary known_hosts file under $runner_dir"
    fi
  done
}

new_case() {
  local name="$1"

  case_root="$test_root/$name"
  case_runner="$case_root/runner-temp"
  case_env="$case_root/github.env"
  case_stdout="$case_root/stdout"
  case_stderr="$case_root/stderr"
  mkdir -p "$case_runner"
  case_runner_real="$(cd "$case_runner" && pwd -P)"
  : > "$case_env"
  : > "$case_stdout"
  : > "$case_stderr"
}

run_helper() {
  local host_state="$1"
  local pin_state="$2"
  local port_state="$3"
  local runner_value="${4:-$case_runner}"
  local env_state="${5:-set}"
  local -a helper_env

  helper_env=(env -i "PATH=$PATH" "HOME=$test_root/home" "RUNNER_TEMP=$runner_value")

  case "$host_state" in
    missing) ;;
    blank) helper_env+=(HOSTINGER_HOST=) ;;
    valid) helper_env+=("HOSTINGER_HOST=$test_host") ;;
    mismatch) helper_env+=(HOSTINGER_HOST=other.example.test) ;;
    unsafe) helper_env+=(HOSTINGER_HOST='host.example.test;marker') ;;
    *) fail 'unknown HOSTINGER_HOST test state' ;;
  esac

  case "$pin_state" in
    missing) ;;
    blank) helper_env+=(HOSTINGER_SSH_KNOWN_HOSTS='   ') ;;
    valid) helper_env+=("HOSTINGER_SSH_KNOWN_HOSTS=$test_known_hosts") ;;
    invalid) helper_env+=(HOSTINGER_SSH_KNOWN_HOSTS='SYNTHETIC_PIN_SENTINEL_DO_NOT_LOG') ;;
    fingerprint) helper_env+=(HOSTINGER_SSH_KNOWN_HOSTS='[host.example.test]:65002 ssh-ed25519 SHA256:SYNTHETIC_PIN_SENTINEL_DO_NOT_LOG') ;;
    mismatch) helper_env+=("HOSTINGER_SSH_KNOWN_HOSTS=$mismatch_known_hosts") ;;
    *) fail 'unknown HOSTINGER_SSH_KNOWN_HOSTS test state' ;;
  esac

  case "$port_state" in
    unset) ;;
    valid) helper_env+=(HOSTINGER_SSH_PORT=65002) ;;
    mismatch) helper_env+=(HOSTINGER_SSH_PORT=65003) ;;
    blank) helper_env+=(HOSTINGER_SSH_PORT=) ;;
    invalid) helper_env+=(HOSTINGER_SSH_PORT='65002;marker') ;;
    out_of_range) helper_env+=(HOSTINGER_SSH_PORT=65536) ;;
    *) fail 'unknown HOSTINGER_SSH_PORT test state' ;;
  esac

  case "$env_state" in
    set) helper_env+=("GITHUB_ENV=$case_env") ;;
    unset) ;;
    unsafe) helper_env+=(GITHUB_ENV=relative/github.env) ;;
    *) fail 'unknown GITHUB_ENV test state' ;;
  esac

  if "${helper_env[@]}" bash "$helper_path" > "$case_stdout" 2> "$case_stderr"; then
    return 0
  fi
  return 1
}

if [ ! -x "$helper_path" ]; then
  fail 'helper must be executable'
fi

mkdir -p "$test_root/home"
synthetic_key="$test_root/synthetic-ed25519"
if ! ssh-keygen -q -t ed25519 -N '' -f "$synthetic_key" >/dev/null 2>&1; then
  fail 'ssh-keygen could not create the synthetic test key'
fi
if ! synthetic_public_key="$(ssh-keygen -y -f "$synthetic_key" 2>/dev/null)"; then
  fail 'ssh-keygen could not derive the synthetic public test key'
fi

test_host='host.example.test'
test_known_hosts="[${test_host}]:65002 ${synthetic_public_key} # SYNTHETIC_PIN_SENTINEL"
mismatch_known_hosts="[other.example.test]:65002 ${synthetic_public_key}"

new_case valid
if run_helper valid valid unset; then :; else fail 'valid known_hosts content was rejected'; fi
exported_path="$(sed -n 's/^HOSTINGER_KNOWN_HOSTS_FILE=//p' "$case_env")"
if [ -z "$exported_path" ]; then
  fail 'successful helper invocation did not export the file path'
fi
case "$exported_path" in
  "$case_runner_real"/hostinger-known-hosts.*) ;;
  *) fail 'exported known_hosts path was not safely rooted under RUNNER_TEMP' ;;
esac
case "$exported_path" in
  *$'\n'*|*$'\r'*) fail 'exported known_hosts path contained a line break' ;;
esac
assert_equal "HOSTINGER_KNOWN_HOSTS_FILE=$exported_path" "$(cat "$case_env")" 'GITHUB_ENV contained more than the non-secret path export'
assert_equal 600 "$(file_mode "$exported_path")" 'temporary known_hosts file mode was not 600'
expected_contents="$case_root/expected-known-hosts"
printf '%s\n' "$test_known_hosts" > "$expected_contents"
if ! cmp -s "$expected_contents" "$exported_path"; then
  fail 'temporary known_hosts file did not preserve the reviewed content'
fi
assert_no_pin_output "$synthetic_public_key" "$case_stdout" 'valid helper stdout leaked the public pin'
assert_no_pin_output "$synthetic_public_key" "$case_stderr" 'valid helper stderr leaked the public pin'
assert_no_pin_output 'SYNTHETIC_PIN_SENTINEL' "$case_stdout" 'valid helper stdout leaked the pin sentinel'
assert_no_pin_output 'SYNTHETIC_PIN_SENTINEL' "$case_stderr" 'valid helper stderr leaked the pin sentinel'

new_case sourced
if ! current_process_path="$(
  env -i \
    "PATH=$PATH" \
    "HOME=$test_root/home" \
    "HOSTINGER_HOST=$test_host" \
    "HOSTINGER_SSH_KNOWN_HOSTS=$test_known_hosts" \
    "RUNNER_TEMP=$case_runner" \
    bash -c 'source_path="$1"; shift; source "$source_path" && printf "%s\\n" "$HOSTINGER_KNOWN_HOSTS_FILE"' _ "$helper_path" \
    2> "$case_stderr"
)"; then
  fail 'sourced helper invocation failed'
fi
case "$current_process_path" in
  "$case_runner_real"/hostinger-known-hosts.*) ;;
  *) fail 'sourced helper did not export the path in the current process' ;;
esac

new_case missing-host
if run_helper missing valid unset; then fail 'missing HOSTINGER_HOST was accepted'; fi
assert_no_helper_files "$case_runner"

new_case blank-pin
if run_helper valid blank unset; then fail 'blank known_hosts content was accepted'; fi
assert_no_helper_files "$case_runner"

new_case missing-pin
if run_helper valid missing unset; then fail 'missing known_hosts content was accepted'; fi
assert_no_helper_files "$case_runner"

new_case invalid-pin
if run_helper valid invalid unset; then fail 'invalid known_hosts content was accepted'; fi
assert_no_helper_files "$case_runner"
assert_no_pin_output 'SYNTHETIC_PIN_SENTINEL_DO_NOT_LOG' "$case_stdout" 'invalid-pin stdout leaked the supplied pin'
assert_no_pin_output 'SYNTHETIC_PIN_SENTINEL_DO_NOT_LOG' "$case_stderr" 'invalid-pin stderr leaked the supplied pin'

new_case fingerprint
if run_helper valid fingerprint unset; then fail 'fingerprint input was accepted as known_hosts content'; fi
assert_no_helper_files "$case_runner"
assert_no_pin_output 'SYNTHETIC_PIN_SENTINEL_DO_NOT_LOG' "$case_stdout" 'fingerprint stdout leaked the supplied pin'
assert_no_pin_output 'SYNTHETIC_PIN_SENTINEL_DO_NOT_LOG' "$case_stderr" 'fingerprint stderr leaked the supplied pin'

new_case host-mismatch
if run_helper mismatch valid unset; then fail 'hostname mismatch was accepted'; fi
assert_no_helper_files "$case_runner"

new_case port-mismatch
if run_helper valid valid mismatch; then fail 'port mismatch was accepted'; fi
assert_no_helper_files "$case_runner"

new_case unsafe-host
if run_helper unsafe valid unset; then fail 'unsafe hostname shape was accepted'; fi
assert_no_helper_files "$case_runner"

new_case unsafe-port
if run_helper valid valid invalid; then fail 'unsafe port shape was accepted'; fi
assert_no_helper_files "$case_runner"

new_case blank-port
if run_helper valid valid blank; then fail 'blank port was accepted'; fi
assert_no_helper_files "$case_runner"

new_case out-of-range-port
if run_helper valid valid out_of_range; then fail 'out-of-range port was accepted'; fi
assert_no_helper_files "$case_runner"

new_case unsafe-runner-temp
if run_helper valid valid unset relative-runner-temp; then fail 'relative RUNNER_TEMP was accepted'; fi
assert_file_absent "$test_root/relative-runner-temp" 'unsafe RUNNER_TEMP created a path outside the case directory'

new_case unsafe-github-env
if run_helper valid valid unset "$case_runner" unsafe; then fail 'unsafe GITHUB_ENV path was accepted'; fi
assert_no_helper_files "$case_runner"

new_case transfer-gate
transfer_marker="$case_root/transfer.marker"
if env -i \
  "PATH=$PATH" \
  "HOME=$test_root/home" \
  "HOSTINGER_HOST=$test_host" \
  HOSTINGER_SSH_KNOWN_HOSTS='SYNTHETIC_PIN_SENTINEL_DO_NOT_LOG' \
  "RUNNER_TEMP=$case_runner" \
  bash -c 'source_path="$1"; shift; source "$source_path"' _ "$helper_path" \
  > "$case_stdout" 2> "$case_stderr" \
  && printf transferred > "$transfer_marker"; then
  fail 'invalid helper invocation unexpectedly reached the transfer chain'
fi
assert_file_absent "$transfer_marker" 'transfer marker was created after helper failure'
assert_no_helper_files "$case_runner"
assert_no_pin_output 'SYNTHETIC_PIN_SENTINEL_DO_NOT_LOG' "$case_stdout" 'transfer-gate stdout leaked the supplied pin'
assert_no_pin_output 'SYNTHETIC_PIN_SENTINEL_DO_NOT_LOG' "$case_stderr" 'transfer-gate stderr leaked the supplied pin'

expected_workflows=(
  '.github/workflows/ci-cd.yml'
  '.github/workflows/deploy-mcp-hostinger.yml'
  '.github/workflows/staging-api-rollback-drill.yml'
)
for workflow in "${expected_workflows[@]}"; do
  workflow_path="$repo_root/$workflow"
  if [ ! -f "$workflow_path" ]; then
    fail "expected Hostinger workflow consumer is missing: $workflow"
  fi
  if ! grep -F 'scripts/hostinger-ssh-pinning.sh' "$workflow_path" >/dev/null 2>&1; then
    fail "Hostinger workflow consumer does not invoke the shared pinning helper: $workflow"
  fi
  if grep -E 'ssh-keyscan|StrictHostKeyChecking=no|UserKnownHostsFile=/dev/null' "$workflow_path" >/dev/null 2>&1; then
    fail "Hostinger workflow consumer contains a forbidden unpinned SSH option: $workflow"
  fi
done

printf 'Hostinger SSH pinning contract tests passed: validation, exact lookup, secure file export, cleanup, redaction, transfer gate, and workflow guards.\n'
