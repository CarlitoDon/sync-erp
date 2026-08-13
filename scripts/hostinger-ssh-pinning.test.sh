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

first_matching_line() {
  local needle="$1"
  local file="$2"

  grep -nF -- "$needle" "$file" | head -n 1 | cut -d: -f1 || true
}

assert_line_before() {
  local first_needle="$1"
  local second_needle="$2"
  local file="$3"
  local first_line=""
  local second_line=""

  first_line="$(first_matching_line "$first_needle" "$file")"
  second_line="$(first_matching_line "$second_needle" "$file")"
  if [ -z "$first_line" ] || [ -z "$second_line" ] || [ "$first_line" -ge "$second_line" ]; then
    fail "workflow ordering invariant failed: '$first_needle' must precede '$second_needle' in $file"
  fi
}

assert_scp_cleanup_markers() {
  local file="$1"

  if ! awk '
    /scp "\$\{SCP_OPTS\[@\]\}"/ {
      pending = 1
      next
    }
    pending && /REMOTE_UPLOADS_PRESENT=1/ {
      pending = 0
      next
    }
    pending && /scp "\$\{SCP_OPTS\[@\]\}"/ {
      exit 1
    }
    END {
      exit pending ? 1 : 0
    }
  ' "$file"; then
    fail "every SCP operation must be followed by a cleanup marker: $file"
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

assert_rejected_runner_temp() {
  local name="$1"
  local suffix="$2"
  local unsafe_runner=""
  local candidate=""

  new_case "$name"
  unsafe_runner="$case_root/runner${suffix}"
  mkdir -p "$unsafe_runner"
  if run_helper valid valid unset "$unsafe_runner"; then
    fail "$name was accepted"
  fi
  for candidate in "$unsafe_runner"/hostinger-known-hosts.*; do
    if [ -e "$candidate" ]; then
      fail "$name left a temporary known_hosts file behind"
    fi
  done
}

workflow_helper_invocation_line() {
  local workflow_path="$1"

  awk '
    /^[[:space:]]+bash[[:space:]]+scripts\/hostinger-ssh-pinning\.sh([[:space:]]|$)/ ||
    /^[[:space:]]+run:[[:space:]]+bash[[:space:]]+scripts\/hostinger-ssh-pinning\.sh([[:space:]]|$)/ {
      print NR
      exit
    }
  ' "$workflow_path"
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
  helper_line="$(grep -nE '^[[:space:]]+(bash[[:space:]]+scripts/hostinger-ssh-pinning\.sh|run:[[:space:]]+bash[[:space:]]+scripts/hostinger-ssh-pinning\.sh)([[:space:]]|$)' <<<"$helper_block" | head -n 1 | cut -d: -f1 || true)"
  if [ -z "$host_line" ] || [ -z "$pin_line" ] || [ -z "$helper_line" ] ||
    [ "$helper_line" -le "$host_line" ] || [ "$helper_line" -le "$pin_line" ]; then
    fail "Hostinger workflow helper is not invoked after both host and pin secret are in its environment: $workflow_path"
  fi
}

assert_workflow_agent_contract() {
  local workflow_path="$1"
  local preexisting_line=""
  local unset_line=""
  local launch_line=""
  local eval_line=""
  local socket_line=""
  local pid_line=""
  local live_pid_line=""
  local created_line=""
  local add_line=""
  local cleanup_guard_line=""
  local cleanup_kill_line=""

  for required_agent_contract in \
    'SSH_AGENT_CREATED=0' \
    'if [ -e "$SSH_AGENT_SOCKET" ] || [ -L "$SSH_AGENT_SOCKET" ]; then' \
    'unset SSH_AUTH_SOCK SSH_AGENT_PID' \
    'SSH_AGENT_OUTPUT=""' \
    'if ! SSH_AGENT_OUTPUT="$(ssh-agent -a "$SSH_AGENT_SOCKET")"; then' \
    'if [ -z "$SSH_AGENT_OUTPUT" ] || ! eval "$SSH_AGENT_OUTPUT"; then' \
    '[ ! -S "$SSH_AGENT_SOCKET" ]' \
    'case "${SSH_AGENT_PID:-}" in' \
    'if [ "$SSH_AGENT_PID" -le 0 ] || ! kill -0 "$SSH_AGENT_PID" 2>/dev/null; then' \
    'SSH_AGENT_CREATED=1' \
    'if [ "$SSH_AGENT_CREATED" -eq 1 ]; then'; do
    if ! grep -F -- "$required_agent_contract" "$workflow_path" >/dev/null 2>&1; then
      fail "Hostinger workflow is missing SSH-agent contract '${required_agent_contract}': $workflow_path"
    fi
  done

  if grep -F 'eval "$(ssh-agent -a "$SSH_AGENT_SOCKET")"' "$workflow_path" >/dev/null 2>&1; then
    fail "Hostinger workflow still evaluates ssh-agent through an unchecked command substitution: $workflow_path"
  fi

  preexisting_line="$(first_matching_line 'if [ -e "$SSH_AGENT_SOCKET" ] || [ -L "$SSH_AGENT_SOCKET" ]; then' "$workflow_path")"
  unset_line="$(first_matching_line 'unset SSH_AUTH_SOCK SSH_AGENT_PID' "$workflow_path")"
  launch_line="$(first_matching_line 'if ! SSH_AGENT_OUTPUT="$(ssh-agent -a "$SSH_AGENT_SOCKET")"; then' "$workflow_path")"
  eval_line="$(first_matching_line 'if [ -z "$SSH_AGENT_OUTPUT" ] || ! eval "$SSH_AGENT_OUTPUT"; then' "$workflow_path")"
  socket_line="$(first_matching_line '[ ! -S "$SSH_AGENT_SOCKET" ]' "$workflow_path")"
  pid_line="$(first_matching_line 'case "${SSH_AGENT_PID:-}" in' "$workflow_path")"
  live_pid_line="$(first_matching_line 'if [ "$SSH_AGENT_PID" -le 0 ] || ! kill -0 "$SSH_AGENT_PID" 2>/dev/null; then' "$workflow_path")"
  created_line="$(first_matching_line 'SSH_AGENT_CREATED=1' "$workflow_path")"
  add_line="$(first_matching_line 'ssh-add "$SSH_KEY_FILE"' "$workflow_path")"
  cleanup_guard_line="$(first_matching_line 'if [ "$SSH_AGENT_CREATED" -eq 1 ]; then' "$workflow_path")"
  cleanup_kill_line="$(first_matching_line 'ssh-agent -k >/dev/null 2>&1 || true' "$workflow_path")"

  assert_line_before 'if [ -e "$SSH_AGENT_SOCKET" ] || [ -L "$SSH_AGENT_SOCKET" ]; then' 'unset SSH_AUTH_SOCK SSH_AGENT_PID' "$workflow_path"
  assert_line_before 'unset SSH_AUTH_SOCK SSH_AGENT_PID' 'if ! SSH_AGENT_OUTPUT="$(ssh-agent -a "$SSH_AGENT_SOCKET")"; then' "$workflow_path"
  assert_line_before 'if ! SSH_AGENT_OUTPUT="$(ssh-agent -a "$SSH_AGENT_SOCKET")"; then' 'if [ -z "$SSH_AGENT_OUTPUT" ] || ! eval "$SSH_AGENT_OUTPUT"; then' "$workflow_path"
  assert_line_before 'if [ -z "$SSH_AGENT_OUTPUT" ] || ! eval "$SSH_AGENT_OUTPUT"; then' '[ ! -S "$SSH_AGENT_SOCKET" ]' "$workflow_path"
  assert_line_before '[ ! -S "$SSH_AGENT_SOCKET" ]' 'case "${SSH_AGENT_PID:-}" in' "$workflow_path"
  assert_line_before 'case "${SSH_AGENT_PID:-}" in' 'if [ "$SSH_AGENT_PID" -le 0 ] || ! kill -0 "$SSH_AGENT_PID" 2>/dev/null; then' "$workflow_path"
  assert_line_before 'if [ "$SSH_AGENT_PID" -le 0 ] || ! kill -0 "$SSH_AGENT_PID" 2>/dev/null; then' 'SSH_AGENT_CREATED=1' "$workflow_path"
  assert_line_before 'SSH_AGENT_CREATED=1' 'ssh-add "$SSH_KEY_FILE"' "$workflow_path"
  if [ -z "$preexisting_line" ] || [ -z "$unset_line" ] || [ -z "$launch_line" ] || [ -z "$eval_line" ] ||
    [ -z "$socket_line" ] || [ -z "$pid_line" ] || [ -z "$live_pid_line" ] ||
    [ -z "$created_line" ] || [ -z "$add_line" ] || [ -z "$cleanup_guard_line" ] ||
    [ -z "$cleanup_kill_line" ]; then
    fail "Hostinger workflow SSH-agent ordering could not be inspected: $workflow_path"
  fi
  if [ "$cleanup_guard_line" -ge "$cleanup_kill_line" ]; then
    fail "Hostinger workflow can stop an agent without the created-agent guard: $workflow_path"
  fi
}

assert_workflow_ssh_contract() {
  local workflow_path="$1"
  local helper_line=""
  local first_transfer_or_remote_side_effect_line=""
  local known_hosts_secret_refs=""
  local port_declarations=""
  local writer_count=""
  local scp_count=""
  local upload_flag_count=""
  local key_writer_line=""
  local askpass_writer_line=""
  local ssh_add_line=""
  local cleanup_line=""
  local first_scp_line=""

  assert_workflow_helper_step "$workflow_path"
  assert_workflow_agent_contract "$workflow_path"

  known_hosts_secret_refs="$(grep -Fc 'HOSTINGER_SSH_KNOWN_HOSTS' "$workflow_path" || true)"
  assert_equal 1 "$known_hosts_secret_refs" 'workflow must reference HOSTINGER_SSH_KNOWN_HOSTS exactly once (the reviewed secret binding)'
  if ! grep -F 'HOSTINGER_SSH_KNOWN_HOSTS: ${{ secrets.HOSTINGER_SSH_KNOWN_HOSTS }}' "$workflow_path" >/dev/null 2>&1; then
    fail "workflow does not bind the reviewed known_hosts secret by name: $workflow_path"
  fi

  if grep -E 'ssh-keyscan|StrictHostKeyChecking[[:space:]]*=[[:space:]]*no|UserKnownHostsFile[[:space:]]*=[[:space:]]*/dev/null' "$workflow_path" >/dev/null 2>&1; then
    fail "Hostinger workflow contains a forbidden unpinned SSH option: $workflow_path"
  fi
  for required_option in \
    '-o StrictHostKeyChecking=yes' \
    '-o "UserKnownHostsFile=${HOSTINGER_KNOWN_HOSTS_FILE}"' \
    '-o GlobalKnownHostsFile=none' \
    '-o ControlMaster=no' \
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
  if grep -E 'GlobalKnownHostsFile[[:space:]]*=' "$workflow_path" | grep -vF 'GlobalKnownHostsFile=none' >/dev/null 2>&1; then
    fail "Hostinger workflow weakens global known_hosts isolation: $workflow_path"
  fi

  if grep -E 'ControlMaster=auto|ControlPersist=|ControlPath=|CONTROL_PATH=' "$workflow_path" >/dev/null 2>&1; then
    fail "Hostinger workflow permits SSH control-socket reuse: $workflow_path"
  fi

  if grep -F '~/.ssh' "$workflow_path" >/dev/null 2>&1; then
    fail "Hostinger workflow writes SSH material under a fixed ~/.ssh path: $workflow_path"
  fi
  for required_key_contract in \
    'mktemp -d "$RUNNER_TEMP_REAL/sync-erp-hostinger-ssh.XXXXXXXXXX"' \
    'SSH_KEY_FILE="$SSH_RUNTIME_DIR/id_ed25519"' \
    'SSH_KEY_STAGED_FILE=' \
    'SSH_ASKPASS_STAGED_FILE=' \
    '--write-atomic-file "$SSH_KEY_STAGED_FILE" "$SSH_KEY_FILE" 600' \
    '--write-atomic-file "$SSH_ASKPASS_STAGED_FILE" "$SSH_ASKPASS_FILE" 700' \
    'ssh-add "$SSH_KEY_FILE"'; do
    if ! grep -F -- "$required_key_contract" "$workflow_path" >/dev/null 2>&1; then
      fail "Hostinger workflow is missing atomic private-file contract '${required_key_contract}': $workflow_path"
    fi
  done
  writer_count="$(grep -Fc -- '--write-atomic-file' "$workflow_path" || true)"
  assert_equal 2 "$writer_count" 'workflow must atomically write both private SSH files'
  for forbidden_private_write in \
    '> "$SSH_KEY_FILE"' \
    '>> "$SSH_KEY_FILE"' \
    '> "$SSH_ASKPASS_FILE"' \
    '>> "$SSH_ASKPASS_FILE"'; do
    if grep -F -- "$forbidden_private_write" "$workflow_path" >/dev/null 2>&1; then
      fail "Hostinger workflow still redirects directly into a private SSH path '${forbidden_private_write}': $workflow_path"
    fi
  done

  key_writer_line="$(first_matching_line '--write-atomic-file "$SSH_KEY_STAGED_FILE" "$SSH_KEY_FILE" 600' "$workflow_path")"
  askpass_writer_line="$(first_matching_line '--write-atomic-file "$SSH_ASKPASS_STAGED_FILE" "$SSH_ASKPASS_FILE" 700' "$workflow_path")"
  ssh_add_line="$(first_matching_line 'ssh-add "$SSH_KEY_FILE"' "$workflow_path")"
  assert_line_before '--write-atomic-file "$SSH_KEY_STAGED_FILE" "$SSH_KEY_FILE" 600' 'ssh-add "$SSH_KEY_FILE"' "$workflow_path"
  assert_line_before '--write-atomic-file "$SSH_ASKPASS_STAGED_FILE" "$SSH_ASKPASS_FILE" 700' 'ssh-add "$SSH_KEY_FILE"' "$workflow_path"
  if [ -z "$key_writer_line" ] || [ -z "$askpass_writer_line" ] || [ -z "$ssh_add_line" ]; then
    fail "Hostinger workflow private-file write ordering could not be inspected: $workflow_path"
  fi

  for required_cleanup_contract in \
    'REMOTE_UPLOADS_PRESENT=0' \
    'REMOTE_UPLOAD_CLEANUP_COMMAND=' \
    'if [ "$REMOTE_UPLOADS_PRESENT" -eq 1 ]' \
    'ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$REMOTE_UPLOAD_CLEANUP_COMMAND"' \
    'local primary_status="$?"' \
    'trap - EXIT' \
    'exit "$primary_status"' \
    'trap cleanup_local EXIT'; do
    if ! grep -F -- "$required_cleanup_contract" "$workflow_path" >/dev/null 2>&1; then
      fail "Hostinger workflow is missing remote-upload cleanup contract '${required_cleanup_contract}': $workflow_path"
    fi
  done
  scp_count="$(grep -Fc 'scp "${SCP_OPTS[@]}' "$workflow_path" || true)"
  upload_flag_count="$(grep -Fc 'REMOTE_UPLOADS_PRESENT=1' "$workflow_path" || true)"
  assert_equal "$scp_count" "$upload_flag_count" 'workflow must mark every successful SCP for cleanup'
  assert_scp_cleanup_markers "$workflow_path"
  first_scp_line="$(first_matching_line 'scp "${SCP_OPTS[@]}' "$workflow_path")"
  cleanup_line="$(first_matching_line 'ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$REMOTE_UPLOAD_CLEANUP_COMMAND"' "$workflow_path")"
  assert_line_before 'trap cleanup_local EXIT' 'scp "${SCP_OPTS[@]}' "$workflow_path"
  if [ -z "$first_scp_line" ] || [ -z "$cleanup_line" ]; then
    fail "Hostinger workflow remote-upload cleanup ordering could not be inspected: $workflow_path"
  fi

  if grep -nE '^[[:space:]]+ssh[[:space:]]' "$workflow_path" | grep -vF 'ssh "${SSH_OPTS[@]}"' >/dev/null 2>&1; then
    fail "Hostinger workflow has an SSH operation that bypasses SSH_OPTS: $workflow_path"
  fi
  if grep -nE '^[[:space:]]+(timeout[[:space:]]+[0-9]+[[:space:]]+)?scp[[:space:]]' "$workflow_path" | grep -vF 'scp "${SCP_OPTS[@]}"' >/dev/null 2>&1; then
    fail "Hostinger workflow has an SCP operation that bypasses SCP_OPTS: $workflow_path"
  fi

  helper_line="$(workflow_helper_invocation_line "$workflow_path")"
  first_transfer_or_remote_side_effect_line="$(awk '
    /^[[:space:]]+(ssh|scp|ssh-add)([[:space:]]|$)/ ||
    /^[[:space:]]+timeout[[:space:]]+[0-9]+[[:space:]]+scp([[:space:]]|$)/ ||
    /^[[:space:]]+eval[[:space:]]+.*ssh-agent/ {
      print NR
      exit
    }
  ' "$workflow_path")"
  if [ -z "$helper_line" ] || [ -z "$first_transfer_or_remote_side_effect_line" ] ||
    [ "$helper_line" -ge "$first_transfer_or_remote_side_effect_line" ]; then
    fail "Hostinger workflow permits transfer or remote SSH side effects before helper preflight: $workflow_path"
  fi

  if [ "$workflow_path" = "$repo_root/.github/workflows/deploy-mcp-hostinger.yml" ]; then
    for required_env_contract in \
      'env_next="$target/.env.next"' \
      'trap cleanup_remote_generated_files EXIT' \
      'if ! (set -C; : > "$env_next")' \
      'chmod 600 "$env_next"' \
      '} >> "$env_next"' \
      'mv -f -- "$env_next" .env' \
      'rm -f -- "$generated_file"'; do
      if ! grep -F -- "$required_env_contract" "$workflow_path" >/dev/null 2>&1; then
        fail "MCP workflow is missing restrictive .env.next contract '${required_env_contract}'"
      fi
    done
    assert_line_before 'trap cleanup_remote_generated_files EXIT' 'if ! (set -C; : > "$env_next")' "$workflow_path"
    assert_line_before 'if ! (set -C; : > "$env_next")' 'chmod 600 "$env_next"' "$workflow_path"
    assert_line_before 'chmod 600 "$env_next"' '} >> "$env_next"' "$workflow_path"
    assert_line_before '} >> "$env_next"' 'mv -f -- "$env_next" .env' "$workflow_path"
  fi
}

assert_agent_failure_injection() {
  new_case agent-failure-injection
  local fake_bin="$case_root/bin"
  local agent_seen="$case_root/agent-seen"
  local inherited_socket="$case_root/inherited-agent.sock"
  local failure_status=0

  mkdir -p "$fake_bin"
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    'printf "%s\\n" "${SSH_AUTH_SOCK-UNSET}" >> "$AGENT_SEEN_FILE"' \
    'exit 42' > "$fake_bin/ssh-agent"
  chmod 700 "$fake_bin/ssh-agent"

  env -i \
    "PATH=$fake_bin:$PATH" \
    "AGENT_SEEN_FILE=$agent_seen" \
    "SSH_AUTH_SOCK=$inherited_socket" \
    SSH_AGENT_PID=999999 \
    bash -c '
      set -euo pipefail
      SSH_AGENT_CREATED=0
      SSH_AGENT_SOCKET="$1/agent.sock"
      SSH_AGENT_OUTPUT=""
      unset SSH_AUTH_SOCK SSH_AGENT_PID
      cleanup_local() {
        local primary_status="$?"
        trap - EXIT
        if [ "$SSH_AGENT_CREATED" -eq 1 ]; then
          ssh-agent -k >/dev/null 2>&1 || true
        fi
        exit "$primary_status"
      }
      trap cleanup_local EXIT
      if ! SSH_AGENT_OUTPUT="$(ssh-agent -a "$SSH_AGENT_SOCKET")"; then
        exit 17
      fi
      if [ -z "$SSH_AGENT_OUTPUT" ] || ! eval "$SSH_AGENT_OUTPUT"; then
        exit 18
      fi
      if [ "${SSH_AUTH_SOCK:-}" != "$SSH_AGENT_SOCKET" ] || [ ! -S "$SSH_AGENT_SOCKET" ]; then
        exit 19
      fi
      case "${SSH_AGENT_PID:-}" in
        ""|*[!0-9]*) exit 20 ;;
      esac
      if [ "$SSH_AGENT_PID" -le 0 ] || ! kill -0 "$SSH_AGENT_PID" 2>/dev/null; then
        exit 21
      fi
      SSH_AGENT_CREATED=1
      : > "$1/ssh-add-reached"
    ' _ "$case_root" || failure_status=$?

  assert_equal 17 "$failure_status" 'failed ssh-agent launch did not fail the setup'
  assert_equal 'UNSET' "$(cat "$agent_seen")" 'inherited SSH_AUTH_SOCK survived into ssh-agent setup'
  assert_equal 1 "$(wc -l < "$agent_seen" | tr -d '[:space:]')" 'cleanup retried ssh-agent for an agent that was not created'
  assert_file_absent "$case_root/ssh-add-reached" 'ssh-add path was reached after failed ssh-agent setup'
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

assert_atomic_writer_contract() {
  new_case atomic-writer
  atomic_root="$case_root/atomic"
  mkdir -p "$atomic_root"

  staging_path="$(mktemp "$atomic_root/.staging.XXXXXX")"
  destination_path="$atomic_root/private-file"
  if ! printf '%s\n' 'SYNTHETIC_ATOMIC_FILE_CONTENT' |
    bash "$helper_path" --write-atomic-file "$staging_path" "$destination_path" 600 \
    > "$case_stdout" 2> "$case_stderr"; then
    fail 'atomic writer rejected a regular staging file'
  fi
  assert_file_absent "$staging_path" 'atomic writer left the staging path after publish'
  assert_equal 600 "$(file_mode "$destination_path")" 'atomic writer did not apply mode 600 before publish'
  assert_equal 'SYNTHETIC_ATOMIC_FILE_CONTENT' "$(sed -n '1p' "$destination_path")" 'atomic writer did not preserve content'

  sentinel_path="$atomic_root/sentinel"
  printf '%s\n' 'SYNTHETIC_SYMLINK_SENTINEL' > "$sentinel_path"
  symlink_staging_path="$atomic_root/symlink-staging"
  symlink_destination_path="$atomic_root/symlink-destination"
  ln -s "$sentinel_path" "$symlink_staging_path"
  if printf '%s\n' 'SYNTHETIC_SHOULD_NOT_WRITE' |
    bash "$helper_path" --write-atomic-file "$symlink_staging_path" "$symlink_destination_path" 600 \
    > "$case_stdout" 2> "$case_stderr"; then
    fail 'atomic writer followed a symlink staging path'
  fi
  assert_equal 'SYNTHETIC_SYMLINK_SENTINEL' "$(sed -n '1p' "$sentinel_path")" 'atomic writer modified a symlink target'
  if [ -e "$symlink_destination_path" ] || [ -L "$symlink_destination_path" ]; then
    fail 'failed no-follow write unexpectedly published a destination'
  fi

  replacement_staging_path="$(mktemp "$atomic_root/.replacement.XXXXXX")"
  replacement_destination_path="$atomic_root/replacement-destination"
  ln -s "$sentinel_path" "$replacement_destination_path"
  if ! printf '%s\n' 'SYNTHETIC_REPLACEMENT_CONTENT' |
    bash "$helper_path" --write-atomic-file "$replacement_staging_path" "$replacement_destination_path" 700 \
    > "$case_stdout" 2> "$case_stderr"; then
    fail 'atomic writer could not replace a destination symlink atomically'
  fi
  if [ -L "$replacement_destination_path" ]; then
    fail 'atomic writer left the destination as a symlink'
  fi
  assert_equal 'SYNTHETIC_SYMLINK_SENTINEL' "$(sed -n '1p' "$sentinel_path")" 'atomic publish modified a destination symlink target'
  assert_equal 700 "$(file_mode "$replacement_destination_path")" 'atomic writer did not apply mode 700 before publish'
  assert_equal 'SYNTHETIC_REPLACEMENT_CONTENT' "$(sed -n '1p' "$replacement_destination_path")" 'atomic publish did not replace the destination'
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
for required_helper_contract in \
  'hostinger_ssh_pinning_write_atomic_file' \
  'constants.O_NOFOLLOW' \
  'fchmodSync' \
  'fsyncSync' \
  'writeSync' \
  'renameSync' \
  '--write-atomic-file'; do
  if ! grep -F -- "$required_helper_contract" "$helper_path" >/dev/null 2>&1; then
    fail "helper is missing atomic private-file contract '${required_helper_contract}'"
  fi
done

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
assert_atomic_writer_contract

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
assert_rejected_runner_temp unsafe-runner-space ' temp'
assert_rejected_runner_temp unsafe-runner-tab $'\t-temp'
assert_rejected_runner_temp unsafe-runner-control $'\a-temp'

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

assert_agent_failure_injection

printf 'Hostinger SSH pinning contract tests passed: validation, exact lookup, secure file export, cleanup, redaction, transfer gate, and workflow guards.\n'
