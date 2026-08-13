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

assert_workflow_helper_step() {
  local workflow_path="$1"
  local helper_block=""
  local host_line=""
  local pin_line=""
  local helper_line=""

  helper_block="$(awk '
    /^      - name: Setup SSH$/ || /^      - name: Pin Hostinger SSH host key$/ {
      in_helper_step = 1
      next
    }
    in_helper_step && /^      - name:/ { exit }
    in_helper_step { print }
  ' "$workflow_path")"
  if [ -z "$helper_block" ]; then
    fail "Hostinger workflow does not have a bounded SSH pinning step: $workflow_path"
  fi

  if ! grep -F 'HOSTINGER_HOST: ${{ secrets.HOSTINGER_HOST }}' <<<"$helper_block" >/dev/null 2>&1; then
    fail "Hostinger workflow pinning step does not receive HOSTINGER_HOST: $workflow_path"
  fi
  if ! grep -F 'HOSTINGER_SSH_KNOWN_HOSTS: ${{ secrets.HOSTINGER_SSH_KNOWN_HOSTS }}' <<<"$helper_block" >/dev/null 2>&1; then
    fail "Hostinger workflow pinning step does not receive the reviewed known_hosts secret: $workflow_path"
  fi
  if ! grep -F 'scripts/hostinger-ssh-pinning.sh' <<<"$helper_block" >/dev/null 2>&1; then
    fail "Hostinger workflow pinning step does not invoke the shared helper: $workflow_path"
  fi

  host_line="$(grep -nF 'HOSTINGER_HOST: ${{ secrets.HOSTINGER_HOST }}' <<<"$helper_block" | head -n 1 | cut -d: -f1 || true)"
  pin_line="$(grep -nF 'HOSTINGER_SSH_KNOWN_HOSTS: ${{ secrets.HOSTINGER_SSH_KNOWN_HOSTS }}' <<<"$helper_block" | head -n 1 | cut -d: -f1 || true)"
  helper_line="$(grep -nF 'scripts/hostinger-ssh-pinning.sh' <<<"$helper_block" | head -n 1 | cut -d: -f1 || true)"
  if [ -z "$host_line" ] || [ -z "$pin_line" ] || [ -z "$helper_line" ] ||
    [ "$helper_line" -le "$host_line" ] || [ "$helper_line" -le "$pin_line" ]; then
    fail "Hostinger workflow helper is not invoked after both host and pin secret are in its environment: $workflow_path"
  fi
}

assert_workflow_ssh_contract() {
  local workflow_path="$1"
  local helper_line=""
  local first_ssh_operation_line=""
  local first_control_socket_line=""
  local known_hosts_secret_refs=""
  local port_declarations=""

  assert_workflow_helper_step "$workflow_path"

  known_hosts_secret_refs="$(grep -Fc 'HOSTINGER_SSH_KNOWN_HOSTS' "$workflow_path" || true)"
  assert_equal 1 "$known_hosts_secret_refs" 'workflow referenced HOSTINGER_SSH_KNOWN_HOSTS somewhere beyond the secret binding'
  if ! grep -F 'HOSTINGER_SSH_KNOWN_HOSTS: ${{ secrets.HOSTINGER_SSH_KNOWN_HOSTS }}' "$workflow_path" >/dev/null 2>&1; then
    fail "workflow does not bind the reviewed known_hosts secret by name: $workflow_path"
  fi

  if grep -E 'ssh-keyscan|StrictHostKeyChecking[[:space:]]*=[[:space:]]*no|UserKnownHostsFile[[:space:]]*=[[:space:]]*/dev/null' "$workflow_path" >/dev/null 2>&1; then
    fail "Hostinger workflow contains a forbidden unpinned SSH option: $workflow_path"
  fi
  for required_option in \
    '-o StrictHostKeyChecking=yes' \
    '-o "UserKnownHostsFile=${HOSTINGER_KNOWN_HOSTS_FILE}"' \
    'SSH_OPTS=(-p "$HOSTINGER_SSH_PORT"' \
    'SCP_OPTS=(-P "$HOSTINGER_SSH_PORT"'; do
    if ! grep -F -- "$required_option" "$workflow_path" >/dev/null 2>&1; then
      fail "Hostinger workflow is missing required SSH contract '${required_option}': $workflow_path"
    fi
  done

  port_declarations="$(grep -Fc "HOSTINGER_SSH_PORT: '65002'" "$workflow_path" || true)"
  if [ "$port_declarations" -lt 2 ]; then
    fail "Hostinger workflow does not pin both helper and operation environments to port 65002: $workflow_path"
  fi
  if grep -E 'HOSTINGER_SSH_PORT:[[:space:]]*' "$workflow_path" | grep -vF "HOSTINGER_SSH_PORT: '65002'" >/dev/null 2>&1; then
    fail "Hostinger workflow declares a non-65002 SSH port: $workflow_path"
  fi

  if grep -nE '^[[:space:]]+ssh[[:space:]]' "$workflow_path" | grep -vF 'ssh "${SSH_OPTS[@]}"' >/dev/null 2>&1; then
    fail "Hostinger workflow has an SSH operation that bypasses SSH_OPTS: $workflow_path"
  fi
  if grep -nE '^[[:space:]]+(timeout[[:space:]]+[0-9]+[[:space:]]+)?scp[[:space:]]' "$workflow_path" | grep -vF 'scp "${SCP_OPTS[@]}"' >/dev/null 2>&1; then
    fail "Hostinger workflow has an SCP operation that bypasses SCP_OPTS: $workflow_path"
  fi

  helper_line="$(grep -nF 'scripts/hostinger-ssh-pinning.sh' "$workflow_path" | head -n 1 | cut -d: -f1 || true)"
  first_ssh_operation_line="$(grep -nE '^[[:space:]]+(ssh[[:space:]]|ssh-add[[:space:]]|eval[[:space:]]+.*ssh-agent|timeout[[:space:]]+[0-9]+[[:space:]]+scp[[:space:]])' "$workflow_path" | head -n 1 | cut -d: -f1 || true)"
  if [ -z "$helper_line" ] || [ -z "$first_ssh_operation_line" ] || [ "$helper_line" -ge "$first_ssh_operation_line" ]; then
    fail "Hostinger workflow performs an SSH-related operation before host pinning: $workflow_path"
  fi

  first_control_socket_line="$(grep -nE 'CONTROL_PATH=|Control(Path|Master|Persist)=' "$workflow_path" | head -n 1 | cut -d: -f1 || true)"
  if [ -n "$first_control_socket_line" ] && [ "$helper_line" -ge "$first_control_socket_line" ]; then
    fail "Hostinger workflow configures a control socket before host pinning: $workflow_path"
  fi
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
    wildcard) helper_env+=("HOSTINGER_SSH_KNOWN_HOSTS=$wildcard_known_hosts") ;;
    negated) helper_env+=("HOSTINGER_SSH_KNOWN_HOSTS=$negated_known_hosts") ;;
    multi_host) helper_env+=("HOSTINGER_SSH_KNOWN_HOSTS=$multi_host_known_hosts") ;;
    mixed_malformed) helper_env+=("HOSTINGER_SSH_KNOWN_HOSTS=$mixed_malformed_known_hosts") ;;
    duplicate_conflict) helper_env+=("HOSTINGER_SSH_KNOWN_HOSTS=$duplicate_conflicting_known_hosts") ;;
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

assert_rejected_pin() {
  local name="$1"
  local pin_state="$2"

  new_case "$name"
  if run_helper valid "$pin_state" unset; then
    fail "$pin_state known_hosts content was accepted"
  fi
  assert_no_helper_files "$case_runner"
  assert_no_pin_output "$synthetic_public_key" "$case_stdout" "$pin_state stdout leaked the supplied key"
  assert_no_pin_output "$synthetic_public_key" "$case_stderr" "$pin_state stderr leaked the supplied key"
  assert_no_pin_output "$synthetic_second_public_key" "$case_stdout" "$pin_state stdout leaked the second supplied key"
  assert_no_pin_output "$synthetic_second_public_key" "$case_stderr" "$pin_state stderr leaked the second supplied key"
}

assert_xtrace_output_clean() {
  local label="$1"
  local output_file=""

  for output_file in "$case_stdout" "$case_stderr"; do
    assert_no_pin_output "$xtrace_known_hosts" "$output_file" "$label exposed the multiline pin"
    assert_no_pin_output 'SYNTHETIC_PIN_SENTINEL' "$output_file" "$label exposed the pin sentinel"
    assert_no_pin_output 'XTRACE_MULTILINE_PIN_DO_NOT_LOG' "$output_file" "$label exposed the xtrace marker"
  done
}

assert_xtrace_source_behavior() {
  new_case xtrace-source
  if ! env -i \
    "PATH=$PATH" \
    "HOME=$test_root/home" \
    "HOSTINGER_HOST=$test_host" \
    "HOSTINGER_SSH_KNOWN_HOSTS=$xtrace_known_hosts" \
    "RUNNER_TEMP=$case_runner" \
    "GITHUB_ENV=$case_env" \
    bash -c '
      set -x
      source_path="$1"
      shift
      source "$source_path"
      success_status=$?
      case "$-" in *x*) success_xtrace=on ;; *) success_xtrace=off ;; esac
      HOSTINGER_HOST=
      export HOSTINGER_HOST
      source "$source_path"
      failure_status=$?
      case "$-" in *x*) failure_xtrace=on ;; *) failure_xtrace=off ;; esac
      printf "success_status=%s success_xtrace=%s failure_status=%s failure_xtrace=%s\\n" \
        "$success_status" "$success_xtrace" "$failure_status" "$failure_xtrace"
    ' _ "$helper_path" > "$case_stdout" 2> "$case_stderr"; then
    fail 'source xtrace regression case did not complete'
  fi
  assert_equal \
    'success_status=0 success_xtrace=on failure_status=1 failure_xtrace=on' \
    "$(cat "$case_stdout")" \
    'source xtrace regression case did not restore the caller state'
  assert_xtrace_output_clean 'source xtrace regression case'
}

assert_xtrace_executed_behavior() {
  new_case xtrace-executed
  if ! env -i \
    "PATH=$PATH" \
    "HOME=$test_root/home" \
    "HOSTINGER_HOST=$test_host" \
    "HOSTINGER_SSH_KNOWN_HOSTS=$xtrace_known_hosts" \
    "RUNNER_TEMP=$case_runner" \
    "GITHUB_ENV=$case_env" \
    bash -c '
      set -x
      bash -x "$1"
      success_status=$?
      case "$-" in *x*) success_xtrace=on ;; *) success_xtrace=off ;; esac
      HOSTINGER_HOST=
      export HOSTINGER_HOST
      bash -x "$1"
      failure_status=$?
      case "$-" in *x*) failure_xtrace=on ;; *) failure_xtrace=off ;; esac
      printf "success_status=%s success_xtrace=%s failure_status=%s failure_xtrace=%s\\n" \
        "$success_status" "$success_xtrace" "$failure_status" "$failure_xtrace"
    ' _ "$helper_path" > "$case_stdout" 2> "$case_stderr"; then
    fail 'executed xtrace regression case did not complete'
  fi
  assert_equal \
    'success_status=0 success_xtrace=on failure_status=1 failure_xtrace=on' \
    "$(cat "$case_stdout")" \
    'executed xtrace regression case did not complete with the expected states'
  assert_xtrace_output_clean 'executed xtrace regression case'
}

if [ ! -x "$helper_path" ]; then
  fail 'helper must be executable'
fi
if grep -E '(^|[[:space:]])(ssh|scp|ssh-keyscan|curl|nc|ncat|telnet|wget|dig|nslookup)([[:space:]]|$)|openssl[[:space:]]+s_client' "$helper_path" >/dev/null 2>&1; then
  fail 'helper contains a network-capable command; pin validation must remain local and offline'
fi

mkdir -p "$test_root/home"
synthetic_key="$test_root/synthetic-ed25519"
if ! ssh-keygen -q -t ed25519 -N '' -f "$synthetic_key" >/dev/null 2>&1; then
  fail 'ssh-keygen could not create the synthetic test key'
fi
if ! synthetic_public_key="$(ssh-keygen -y -f "$synthetic_key" 2>/dev/null)"; then
  fail 'ssh-keygen could not derive the synthetic public test key'
fi

synthetic_second_key="$test_root/synthetic-ed25519-second"
if ! ssh-keygen -q -t ed25519 -N '' -f "$synthetic_second_key" >/dev/null 2>&1; then
  fail 'ssh-keygen could not create the second synthetic test key'
fi
if ! synthetic_second_public_key="$(ssh-keygen -y -f "$synthetic_second_key" 2>/dev/null)"; then
  fail 'ssh-keygen could not derive the second synthetic test key'
fi

test_host='host.example.test'
test_known_hosts="[${test_host}]:65002 ${synthetic_public_key} # SYNTHETIC_PIN_SENTINEL"
mismatch_known_hosts="[other.example.test]:65002 ${synthetic_public_key}"
wildcard_known_hosts="[*.example.test]:65002 ${synthetic_public_key}"
negated_known_hosts="[*.example.test]:65002,[!other.example.test]:65002 ${synthetic_public_key}"
multi_host_known_hosts="[${test_host}]:65002,[other.example.test]:65002 ${synthetic_public_key}"
mixed_malformed_known_hosts="${test_known_hosts}"$'\n'"not-a-known-host-record"
duplicate_conflicting_known_hosts="[${test_host}]:65002 ${synthetic_public_key}"$'\n'"[${test_host}]:65002 ${synthetic_second_public_key}"
xtrace_known_hosts="${test_known_hosts}"$'\n'"# XTRACE_MULTILINE_PIN_DO_NOT_LOG"

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

assert_xtrace_source_behavior
assert_xtrace_executed_behavior

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

assert_rejected_pin wildcard-pin wildcard
assert_rejected_pin negated-pin negated
assert_rejected_pin multi-host-pin multi_host
assert_rejected_pin mixed-malformed-pin mixed_malformed
assert_rejected_pin duplicate-conflicting-pin duplicate_conflict

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
  assert_workflow_ssh_contract "$workflow_path"
done

printf 'Hostinger SSH pinning contract tests passed: validation, exact lookup, secure file export, cleanup, redaction, transfer gate, and workflow guards.\n'
