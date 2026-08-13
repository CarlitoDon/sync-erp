#!/usr/bin/env bash

# Prepare a reviewed OpenSSH known_hosts file for Hostinger SSH operations.
# Source this file in a workflow step when the exported path must be used by
# later commands in the same step; GITHUB_ENV carries the path to later steps.

hostinger_ssh_pinning_usage() {
  cat <<'USAGE'
Usage:
  source scripts/hostinger-ssh-pinning.sh
  bash scripts/hostinger-ssh-pinning.sh

Required environment:
  HOSTINGER_HOST              Literal Hostinger hostname or IP address.
  HOSTINGER_SSH_KNOWN_HOSTS   Full reviewed OpenSSH known_hosts content.
  RUNNER_TEMP                 Existing absolute temporary directory.

Optional environment:
  HOSTINGER_SSH_PORT           SSH port; defaults to 65002 when unset.
  GITHUB_ENV                   Absolute GitHub Actions environment-file path.

On success, exports only HOSTINGER_KNOWN_HOSTS_FILE, which points to a
0600 file under RUNNER_TEMP containing the validated known_hosts content.
USAGE
}

hostinger_ssh_pinning_fail() {
  printf 'hostinger-ssh-pinning: %s\n' "$1" >&2
  return 1
}

hostinger_ssh_pinning_is_blank() {
  case "$1" in
    *[![:space:]]*) return 1 ;;
    *) return 0 ;;
  esac
}

hostinger_ssh_pinning_cleanup_path() {
  local candidate="${1-}"
  local runner_temp_real="${2-}"

  if [ -z "$candidate" ]; then
    return 0
  fi

  case "$candidate" in
    "$runner_temp_real"/hostinger-known-hosts.*)
      rm -f "$candidate"
      ;;
  esac
}

hostinger_ssh_pinning_prepare() {
  local host="$1"
  local known_hosts="$2"
  local port="$3"
  local runner_temp_real="$4"
  local lookup="[$host]:$port"
  local pin_file=""
  local matched_keys=""
  local key_type=""
  local key_blob=""
  local matched_count=0

  (
    cleanup_pin_file=""
    cleanup_runner_temp="$runner_temp_real"
    trap 'hostinger_ssh_pinning_cleanup_path "$cleanup_pin_file" "$cleanup_runner_temp"' EXIT
    trap 'hostinger_ssh_pinning_cleanup_path "$cleanup_pin_file" "$cleanup_runner_temp"; exit 1' HUP INT TERM

    if ! pin_file="$(umask 077 && mktemp "$runner_temp_real/hostinger-known-hosts.XXXXXXXXXX" 2>/dev/null)"; then
      hostinger_ssh_pinning_fail 'could not create the temporary known_hosts file'
      exit 1
    fi
    cleanup_pin_file="$pin_file"

    case "$pin_file" in
      "$runner_temp_real"/hostinger-known-hosts.*) ;;
      *)
        hostinger_ssh_pinning_fail 'temporary known_hosts path was outside RUNNER_TEMP'
        exit 1
        ;;
    esac

    if ! chmod 600 "$pin_file" 2>/dev/null; then
      hostinger_ssh_pinning_fail 'could not secure the temporary known_hosts file'
      exit 1
    fi

    if ! printf '%s\n' "$known_hosts" > "$pin_file" 2>/dev/null; then
      hostinger_ssh_pinning_fail 'could not write the temporary known_hosts file'
      exit 1
    fi

    # -F parses OpenSSH known_hosts content and performs the exact bracketed
    # host/port lookup. All output is suppressed because it contains the pin.
    if ! ssh-keygen -F "$lookup" -f "$pin_file" >/dev/null 2>&1; then
      hostinger_ssh_pinning_fail 'known_hosts content has no valid exact Hostinger host/port pin'
      exit 1
    fi

    # -F checks the host field but does not reject a fingerprint in the key
    # field. Extract only the matching key records and make ssh-keygen parse
    # each public key from stdin; all output remains suppressed.
    if ! matched_keys="$(
      ssh-keygen -F "$lookup" -f "$pin_file" 2>/dev/null |
        awk '
          /^[[:space:]]*#/ { next }
          {
            offset = ($1 ~ /^@/) ? 1 : 0
            print $(offset + 2), $(offset + 3)
          }
        '
    )"; then
      hostinger_ssh_pinning_fail 'known_hosts key records could not be inspected safely'
      exit 1
    fi
    if [ -z "$matched_keys" ]; then
      hostinger_ssh_pinning_fail 'known_hosts content has no parseable Hostinger host key'
      exit 1
    fi
    while IFS=' ' read -r key_type key_blob; do
      if [ -z "$key_type" ] || [ -z "$key_blob" ]; then
        hostinger_ssh_pinning_fail 'known_hosts content contains an incomplete host key'
        exit 1
      fi
      if ! printf '%s %s\n' "$key_type" "$key_blob" |
        ssh-keygen -lf /dev/stdin >/dev/null 2>&1; then
        hostinger_ssh_pinning_fail 'known_hosts content contains an invalid host key'
        exit 1
      fi
      matched_count=$((matched_count + 1))
    done <<EOF
$matched_keys
EOF
    if [ "$matched_count" -eq 0 ]; then
      hostinger_ssh_pinning_fail 'known_hosts content has no parseable Hostinger host key'
      exit 1
    fi

    trap - HUP INT TERM
    trap - EXIT
    printf '%s\n' "$pin_file"
  )
}

hostinger_ssh_pinning_main() {
  local host="${HOSTINGER_HOST-}"
  local known_hosts="${HOSTINGER_SSH_KNOWN_HOSTS-}"
  local port="65002"
  local runner_temp="${RUNNER_TEMP-}"
  local github_env="${GITHUB_ENV-}"
  local runner_temp_real=""
  local github_env_parent=""
  local pin_file=""

  if [ "${1-}" = '--help' ] || [ "${1-}" = '-h' ]; then
    if [ "$#" -ne 1 ]; then
      hostinger_ssh_pinning_usage >&2
      return 1
    fi
    hostinger_ssh_pinning_usage
    return 0
  fi

  if [ "$#" -ne 0 ]; then
    hostinger_ssh_pinning_fail 'unexpected argument; use --help for usage'
    return 1
  fi

  if [ -n "${HOSTINGER_SSH_PORT+x}" ]; then
    port="$HOSTINGER_SSH_PORT"
  fi

  if hostinger_ssh_pinning_is_blank "$host"; then
    hostinger_ssh_pinning_fail 'HOSTINGER_HOST is required'
    return 1
  fi
  case "$host" in
    *$'\n'*|*$'\r'*|*[!A-Za-z0-9._:-]*|.*|*.|-*|*-)
      hostinger_ssh_pinning_fail 'HOSTINGER_HOST has an unsafe shape'
      return 1
      ;;
  esac
  case "$host" in
    *[A-Za-z0-9]*) ;;
    *)
      hostinger_ssh_pinning_fail 'HOSTINGER_HOST has an unsafe shape'
      return 1
      ;;
  esac

  if hostinger_ssh_pinning_is_blank "$known_hosts"; then
    hostinger_ssh_pinning_fail 'HOSTINGER_SSH_KNOWN_HOSTS is required'
    return 1
  fi
  case "$known_hosts" in
    *$'\r'*)
      hostinger_ssh_pinning_fail 'HOSTINGER_SSH_KNOWN_HOSTS contains an invalid carriage return'
      return 1
      ;;
  esac

  case "$port" in
    ''|*[!0-9]*|0*|??????*)
      hostinger_ssh_pinning_fail 'HOSTINGER_SSH_PORT has an unsafe shape'
      return 1
      ;;
  esac
  if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    hostinger_ssh_pinning_fail 'HOSTINGER_SSH_PORT is outside the valid range'
    return 1
  fi

  if hostinger_ssh_pinning_is_blank "$runner_temp"; then
    hostinger_ssh_pinning_fail 'RUNNER_TEMP is required'
    return 1
  fi
  case "$runner_temp" in
    /*) ;;
    *)
      hostinger_ssh_pinning_fail 'RUNNER_TEMP must be an absolute directory'
      return 1
      ;;
  esac
  case "$runner_temp" in
    *$'\n'*|*$'\r'*)
      hostinger_ssh_pinning_fail 'RUNNER_TEMP contains an invalid line break'
      return 1
      ;;
  esac
  if [ ! -d "$runner_temp" ]; then
    hostinger_ssh_pinning_fail 'RUNNER_TEMP must be an existing directory'
    return 1
  fi
  if ! runner_temp_real="$(cd "$runner_temp" 2>/dev/null && pwd -P)"; then
    hostinger_ssh_pinning_fail 'RUNNER_TEMP could not be resolved safely'
    return 1
  fi

  if [ -n "$github_env" ]; then
    case "$github_env" in
      /*) ;;
      *)
        hostinger_ssh_pinning_fail 'GITHUB_ENV must be an absolute path when provided'
        return 1
        ;;
    esac
    case "$github_env" in
      *$'\n'*|*$'\r'*)
        hostinger_ssh_pinning_fail 'GITHUB_ENV contains an invalid line break'
        return 1
        ;;
    esac
    if [ -d "$github_env" ]; then
      hostinger_ssh_pinning_fail 'GITHUB_ENV must be a file path'
      return 1
    fi
    github_env_parent="${github_env%/*}"
    if [ -z "$github_env_parent" ]; then
      github_env_parent='/'
    fi
    if [ ! -d "$github_env_parent" ]; then
      hostinger_ssh_pinning_fail 'GITHUB_ENV parent directory does not exist'
      return 1
    fi
    if [ -e "$github_env" ] && [ ! -f "$github_env" ]; then
      hostinger_ssh_pinning_fail 'GITHUB_ENV must refer to a regular file'
      return 1
    fi
  fi

  if ! command -v ssh-keygen >/dev/null 2>&1; then
    hostinger_ssh_pinning_fail 'ssh-keygen is required to validate known_hosts content'
    return 1
  fi

  if ! pin_file="$(hostinger_ssh_pinning_prepare "$host" "$known_hosts" "$port" "$runner_temp_real")"; then
    return 1
  fi

  if [ -n "$github_env" ]; then
    if ! (umask 077 && printf 'HOSTINGER_KNOWN_HOSTS_FILE=%s\n' "$pin_file" >> "$github_env") 2>/dev/null; then
      hostinger_ssh_pinning_cleanup_path "$pin_file" "$runner_temp_real"
      hostinger_ssh_pinning_fail 'could not export HOSTINGER_KNOWN_HOSTS_FILE to GITHUB_ENV'
      return 1
    fi
  fi

  export HOSTINGER_KNOWN_HOSTS_FILE="$pin_file"
  return 0
}

if [ "${BASH_SOURCE[0]}" = "$0" ] && [ -z "${BASH_SOURCE[1]-}" ]; then
  hostinger_ssh_pinning_main "$@"
  exit $?
fi

hostinger_ssh_pinning_main "$@"
return $?
