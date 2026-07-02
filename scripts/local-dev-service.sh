#!/usr/bin/env bash
# Local Sync ERP service runner for launchd.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${SYNC_ERP_RUN_DIR:-$HOME/.hermes/run/sync-erp}"
NODE_BIN_DIR="/Users/wecik/.local/share/fnm/node-versions/v22.21.1/installation/bin"
export PATH="$NODE_BIN_DIR:/opt/homebrew/bin:/usr/local/bin:/Users/wecik/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

mkdir -p "$RUN_DIR"
cd "$PROJECT_ROOT"

api_health() {
  curl -fsS --max-time 2 http://127.0.0.1:3001/health >/dev/null 2>&1
}

web_health() {
  curl -fsS --max-time 2 http://127.0.0.1:5173/ >/dev/null 2>&1
}

run_api() {
  export PORT="${PORT:-3001}"
  export SYNC_ERP_STORAGE_DIR="${SYNC_ERP_STORAGE_DIR:-$PROJECT_ROOT/storage}"
  export SYNC_ERP_DISABLE_BILLING_LIMITS="${SYNC_ERP_DISABLE_BILLING_LIMITS:-true}"
  exec npm run dev --workspace=@sync-erp/api
}

run_api_stable() {
  export PORT="${PORT:-3001}"
  export SYNC_ERP_STORAGE_DIR="${SYNC_ERP_STORAGE_DIR:-$PROJECT_ROOT/storage}"
  export SYNC_ERP_DISABLE_BILLING_LIMITS="${SYNC_ERP_DISABLE_BILLING_LIMITS:-true}"
  cd "$PROJECT_ROOT/apps/api"
  exec "$PROJECT_ROOT/node_modules/.bin/tsx" src/index.ts
}

run_web() {
  export VITE_API_URL="${VITE_API_URL:-http://127.0.0.1:3001/api/trpc}"
  export VITE_SYNC_ERP_API_URL="${VITE_SYNC_ERP_API_URL:-$VITE_API_URL}"
  exec npm run dev --workspace=@sync-erp/web -- --host 127.0.0.1
}

status() {
  if api_health; then
    echo "api: healthy http://127.0.0.1:3001"
  else
    echo "api: down http://127.0.0.1:3001"
  fi

  if web_health; then
    echo "web: healthy http://127.0.0.1:5173"
  else
    echo "web: down http://127.0.0.1:5173"
  fi
}

case "${1:-status}" in
  run-api)
    run_api
    ;;
  run-api-stable)
    run_api_stable
    ;;
  run-web)
    run_web
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {run-api|run-web|status}" >&2
    exit 2
    ;;
esac
