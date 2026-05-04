#!/bin/bash
# Sync ERP MCP Runner
# Sets up path and environment for the MCP stdio server.

# Add fnm node to path if needed
export PATH="/Users/wecik/.local/share/fnm/node-versions/v22.21.1/installation/bin:$PATH"

# Determine project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR/../.."

# Load credentials from .env if it exists (for local runs)
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# Default API URL if not set
export SYNC_ERP_API_URL="${SYNC_ERP_API_URL:-http://localhost:3001/api/trpc}"

# Run the MCP server
node node_modules/.bin/tsx apps/mcp/src/stdio.ts
