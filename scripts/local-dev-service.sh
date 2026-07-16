#!/usr/bin/env bash
# local-dev-service.sh
# Entry point for LaunchAgent-managed Sync ERP services.
# Expected to be called with: run-api-stable
set -euo pipefail

cd "$(dirname "$0")/.."

SCRIPT_NAME="$(basename "$0")"
SERVICE="${1:-help}"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3001}"
export SYNC_ERP_STORAGE_DIR="${SYNC_ERP_STORAGE_DIR:-./storage}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.local/bin:${HOME}/.local/share/fnm/node-versions/v22.21.1/installation/bin"

log() { echo "[${SERVICE} $(TZ=Asia/Jakarta date +'%H:%M:%S')] $*"; }

run_api_stable() {
  log "Starting API on port ${PORT}..."
  exec npx tsx apps/api/src/index.ts
}

run_api_dist() {
  log "Starting API (dist) on port ${PORT}..."
  exec node apps/api/dist/index.js
}

case "${SERVICE}" in
  run-api-stable)
    run_api_stable
    ;;
  run-api-dist)
    run_api_dist
    ;;
  help)
    echo "Usage: ${SCRIPT_NAME} <service>"
    echo "Services:"
    echo "  run-api-stable     Start the Sync ERP API via tsx (watch mode)"
    echo "  run-api-dist       Start the Sync ERP API from dist/"
    ;;
  *)
    log "ERROR: Unknown service '${SERVICE}'"
    echo "Usage: ${SCRIPT_NAME} <service>"
    exit 1
    ;;
esac
