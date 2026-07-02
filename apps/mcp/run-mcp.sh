#!/bin/bash
# Sync ERP MCP Runner
# Starts the local API on demand, then runs the MCP stdio server.

set -euo pipefail

# Add fnm node to path if needed
NODE_BIN_DIR="/Users/wecik/.local/share/fnm/node-versions/v22.21.1/installation/bin"
LAUNCHD_PATH="$NODE_BIN_DIR:/opt/homebrew/bin:/usr/local/bin:/Users/wecik/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PATH="$LAUNCHD_PATH:$PATH"

# Determine project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Load credentials from .env if it exists (for local runs)
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# Default API URL if not set
export SYNC_ERP_API_URL="${SYNC_ERP_API_URL:-http://127.0.0.1:3001/api/trpc}"
export SYNC_ERP_STORAGE_DIR="${SYNC_ERP_STORAGE_DIR:-$PROJECT_ROOT/storage}"

is_local_api_url() {
  case "$SYNC_ERP_API_URL" in
    http://localhost:3001/*|http://127.0.0.1:3001/*|http://host.docker.internal:3001/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Local MCP sessions are operational automation, not billing-flow tests.
# Keep production and remote API behavior untouched.
if is_local_api_url; then
  export SYNC_ERP_DISABLE_BILLING_LIMITS="${SYNC_ERP_DISABLE_BILLING_LIMITS:-true}"
fi

api_is_healthy() {
  curl -fsS --max-time 2 http://127.0.0.1:3001/health >/dev/null 2>&1
}

wait_for_api() {
  local attempts="${1:-45}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if api_is_healthy; then
      return 0
    fi
    sleep 1
  done

  return 1
}

launchctl_api_env_matches() {
  local service="com.wecik.sync-erp-api"
  local domain="gui/$(id -u)"
  local expected_billing="SYNC_ERP_DISABLE_BILLING_LIMITS => ${SYNC_ERP_DISABLE_BILLING_LIMITS:-}"
  local expected_storage="SYNC_ERP_STORAGE_DIR => ${SYNC_ERP_STORAGE_DIR:-}"

  if ! command -v launchctl >/dev/null 2>&1; then
    return 0
  fi

  if ! launchctl print "$domain/$service" >/dev/null 2>&1; then
    return 0
  fi

  launchctl print "$domain/$service" 2>/dev/null | grep -Fq "$expected_billing" &&
    launchctl print "$domain/$service" 2>/dev/null | grep -Fq "$expected_storage"
}

launchctl_bootstrap_with_retry() {
  local domain="$1"
  local plist_file="$2"
  local attempt

  for attempt in 1 2 3 4 5; do
    if launchctl bootstrap "$domain" "$plist_file" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

start_local_api() {
  local state_dir="$HOME/.hermes/run/sync-erp"
  local log_file="$state_dir/api.log"
  local err_file="$state_dir/api.err.log"
  local pid_file="$state_dir/api.pid"
  local lock_dir="$state_dir/api-start.lock"

  mkdir -p "$state_dir"

  if api_is_healthy; then
    if ! launchctl_api_env_matches; then
      echo "[sync-erp-mcp] restarting local Sync ERP API to apply MCP environment" >&2
      start_api_with_launchctl "$state_dir" "$log_file" "$err_file"
      wait_for_api 60 || return 1
    fi
    return 0
  fi

  if mkdir "$lock_dir" 2>/dev/null; then
    trap 'rmdir "$lock_dir" 2>/dev/null || true' RETURN

    if ! api_is_healthy; then
      echo "[sync-erp-mcp] starting local Sync ERP API on port 3001" >&2
      if ! start_api_with_launchctl "$state_dir" "$log_file" "$err_file"; then
        (
          cd "$PROJECT_ROOT"
          nohup env PORT=3001 npm run dev --workspace=@sync-erp/api \
            >>"$log_file" 2>>"$err_file" </dev/null &
          echo $! >"$pid_file"
        )
      fi
    fi
  else
    echo "[sync-erp-mcp] local API start already in progress" >&2
  fi

  if ! wait_for_api 60; then
    echo "[sync-erp-mcp] local API did not become healthy on port 3001" >&2
    echo "[sync-erp-mcp] recent API log:" >&2
    tail -n 40 "$log_file" >&2 2>/dev/null || true
    tail -n 40 "$err_file" >&2 2>/dev/null || true
    exit 1
  fi
}

start_api_with_launchctl() {
  local state_dir="$1"
  local log_file="$2"
  local err_file="$3"
  local service="com.wecik.sync-erp-api"
  local domain="gui/$(id -u)"
  local plist_file="$state_dir/$service.plist"
  local npm_bin

  if ! command -v launchctl >/dev/null 2>&1; then
    return 1
  fi

  npm_bin="$(command -v npm || true)"
  if [ -z "$npm_bin" ]; then
    return 1
  fi

  cat >"$plist_file" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$service</string>
  <key>WorkingDirectory</key>
  <string>$PROJECT_ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$LAUNCHD_PATH</string>
    <key>PORT</key>
    <string>3001</string>
    <key>SYNC_ERP_DISABLE_BILLING_LIMITS</key>
    <string>$SYNC_ERP_DISABLE_BILLING_LIMITS</string>
    <key>SYNC_ERP_STORAGE_DIR</key>
    <string>$SYNC_ERP_STORAGE_DIR</string>
  </dict>
  <key>ProgramArguments</key>
  <array>
    <string>$npm_bin</string>
    <string>run</string>
    <string>dev</string>
    <string>--workspace=@sync-erp/api</string>
  </array>
  <key>StandardOutPath</key>
  <string>$log_file</string>
  <key>StandardErrorPath</key>
  <string>$err_file</string>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
EOF

  if launchctl print "$domain/$service" >/dev/null 2>&1; then
    launchctl bootout "$domain/$service" >/dev/null 2>&1 || true
  fi

  launchctl_bootstrap_with_retry "$domain" "$plist_file" || return 1
  launchctl kickstart -k "$domain/$service" >/dev/null 2>&1 || return 1
  echo "launchctl:$domain/$service" >"$state_dir/api.pid"
}

if is_local_api_url; then
  export SYNC_ERP_API_URL="http://127.0.0.1:3001/api/trpc"
  start_local_api
fi

if [ "${SYNC_ERP_MCP_BOOTSTRAP_ONLY:-}" = "1" ]; then
  exit 0
fi

# Run the MCP server
node node_modules/.bin/tsx apps/mcp/src/stdio.ts
