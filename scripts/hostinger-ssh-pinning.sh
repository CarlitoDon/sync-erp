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
  HOSTINGER_SSH_KNOWN_HOSTS   Full reviewed OpenSSH known_hosts content using
                              the verified ssh-ed25519 Hostinger host key.
  RUNNER_TEMP                 Existing absolute temporary directory without
                              whitespace or control characters.

Optional environment:
  HOSTINGER_SSH_PORT           SSH port; defaults to 65002 when unset.
  GITHUB_ENV                   Absolute GitHub Actions environment-file path.

Internal file writer:
  printf '%s\n' content |
    bash scripts/hostinger-ssh-pinning.sh --write-atomic-file STAGING DESTINATION MODE

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

hostinger_ssh_pinning_has_unsafe_path_chars() {
  local value="${1-}"

  case "$value" in
    *[[:space:][:cntrl:]]*) return 0 ;;
    *) return 1 ;;
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

hostinger_ssh_pinning_write_atomic_file() {
  local staging_path="${1-}"
  local destination_path="${2-}"
  local mode="${3-}"

  if [ "$#" -ne 3 ]; then
    hostinger_ssh_pinning_fail 'atomic file writer requires staging path, destination path, and mode'
    return 1
  fi
  case "$mode" in
    600|700) ;;
    *)
      hostinger_ssh_pinning_fail 'atomic file writer accepts only mode 600 or 700'
      return 1
      ;;
  esac
  if [ -z "$staging_path" ] || [ -z "$destination_path" ]; then
    hostinger_ssh_pinning_fail 'atomic file writer paths are required'
    return 1
  fi

  if ! node --input-type=module -e '
    import {
      constants,
      closeSync,
      fchmodSync,
      fstatSync,
      fsyncSync,
      openSync,
      readFileSync,
      writeSync,
    } from "node:fs";

    const [stagingPath, mode] = process.argv.slice(1);
    if (!constants.O_NOFOLLOW) {
      throw new Error("O_NOFOLLOW is unavailable");
    }
    const content = readFileSync(0);
    const fd = openSync(
      stagingPath,
      constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_TRUNC,
    );
    try {
      if (!fstatSync(fd).isFile()) {
        throw new Error("staging path is not a regular file");
      }
      fchmodSync(fd, Number.parseInt(mode, 8));
      let offset = 0;
      while (offset < content.length) {
        offset += writeSync(fd, content, offset, content.length - offset);
      }
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  ' "$staging_path" "$mode" 2>/dev/null; then
    hostinger_ssh_pinning_fail 'could not write the private temporary file safely'
    return 1
  fi

  if ! node --input-type=module -e '
    import { lstatSync, renameSync } from "node:fs";

    const [stagingPath, destinationPath] = process.argv.slice(1);
    if (!lstatSync(stagingPath).isFile()) {
      throw new Error("staging path is not a regular file");
    }
    renameSync(stagingPath, destinationPath);
  ' "$staging_path" "$destination_path" 2>/dev/null; then
    hostinger_ssh_pinning_fail 'could not publish the private file atomically'
    return 1
  fi
}

hostinger_ssh_pinning_prepare() {
  local host="$1"
  local known_hosts="$2"
  local port="$3"
  local runner_temp_real="$4"
  local lookup="[$host]:$port"
  local pin_file=""
  local line=""
  local host_field=""
  local key_type=""
  local key_blob=""
  local key_material=""
  local matched_key_material=""
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

    # Do not use ssh-keygen -F here: it intentionally matches OpenSSH
    # wildcard, negated, and multi-host patterns. The pin must be a literal
    # host field, and every non-comment record must be that exact field.
    while IFS= read -r line || [ -n "$line" ]; do
      if hostinger_ssh_pinning_is_blank "$line" || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
      fi

      host_field=""
      key_type=""
      key_blob=""
      read -r host_field key_type key_blob _ <<< "$line" || true
      if [ "$host_field" != "$lookup" ]; then
        hostinger_ssh_pinning_fail 'known_hosts content contains a non-literal or unrelated host record'
        exit 1
      fi
      if [ -z "$key_type" ] || [ -z "$key_blob" ]; then
        hostinger_ssh_pinning_fail 'known_hosts content contains an incomplete host key'
        exit 1
      fi
      if [ "$key_type" != 'ssh-ed25519' ]; then
        hostinger_ssh_pinning_fail 'known_hosts content must use the verified ssh-ed25519 Hostinger host key'
        exit 1
      fi
      if ! printf '%s %s\n' "$key_type" "$key_blob" |
        ssh-keygen -lf /dev/stdin >/dev/null 2>&1; then
        hostinger_ssh_pinning_fail 'known_hosts content contains an invalid host key'
        exit 1
      fi
      key_material="$key_type $key_blob"
      if [ "$matched_count" -gt 0 ] && [ "$key_material" != "$matched_key_material" ]; then
        hostinger_ssh_pinning_fail 'known_hosts content contains conflicting exact Hostinger host keys'
        exit 1
      fi
      matched_key_material="$key_material"
      matched_count=$((matched_count + 1))
    done < "$pin_file"

    if [ "$matched_count" -eq 0 ]; then
      hostinger_ssh_pinning_fail 'known_hosts content has no literal exact Hostinger host/port pin'
      exit 1
    fi

    trap - HUP INT TERM
    trap - EXIT
    printf '%s\n' "$pin_file"
  )
}

hostinger_ssh_pinning_main_impl() {
  if [ "${1-}" = '--write-atomic-file' ]; then
    if [ "$#" -ne 4 ]; then
      hostinger_ssh_pinning_fail 'usage: --write-atomic-file STAGING DESTINATION MODE'
      return 1
    fi
    hostinger_ssh_pinning_write_atomic_file "$2" "$3" "$4"
    return $?
  fi

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
  if hostinger_ssh_pinning_has_unsafe_path_chars "$runner_temp"; then
    hostinger_ssh_pinning_fail 'RUNNER_TEMP contains whitespace or control characters'
    return 1
  fi
  if [ ! -d "$runner_temp" ]; then
    hostinger_ssh_pinning_fail 'RUNNER_TEMP must be an existing directory'
    return 1
  fi
  if ! runner_temp_real="$(cd "$runner_temp" 2>/dev/null && pwd -P)"; then
    hostinger_ssh_pinning_fail 'RUNNER_TEMP could not be resolved safely'
    return 1
  fi
  if hostinger_ssh_pinning_has_unsafe_path_chars "$runner_temp_real"; then
    hostinger_ssh_pinning_fail 'resolved RUNNER_TEMP contains whitespace or control characters'
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

hostinger_ssh_pinning_main() {
  local xtrace_was_enabled=0
  case "$-" in
    *x*)
      xtrace_was_enabled=1
      set +x
      ;;
  esac

  local status=0
  hostinger_ssh_pinning_main_impl "$@" || status=$?

  if [ "$xtrace_was_enabled" -eq 1 ]; then
    set -x
  fi
  return "$status"
}

if [ "${BASH_SOURCE[0]}" = "$0" ] && [ -z "${BASH_SOURCE[1]-}" ]; then
  hostinger_ssh_pinning_main "$@"
  exit $?
fi

hostinger_ssh_pinning_main "$@"
return $?
