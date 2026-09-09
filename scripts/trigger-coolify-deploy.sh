#!/usr/bin/env bash

# Trigger one Coolify deployment through a repository-secret webhook.
#
# Usage:
#   COOLIFY_DEPLOY_WEBHOOK='https://public-tunnel.example/hooks/...' \
#     GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/dev \
#     bash scripts/trigger-coolify-deploy.sh api staging
#
# The workflow maps one of the six service/environment-specific GitHub secrets
# to COOLIFY_DEPLOY_WEBHOOK. The URL is supplied to curl through its stdin
# config, never as an argv value, and is deliberately absent from log output.

# A caller that inherited xtrace could otherwise expose the webhook while the
# command is being assembled. Disable it before reading any secret-bearing env.
set +x
set -euo pipefail

coolify_trigger_fail() {
  printf 'Coolify deploy trigger: %s\n' "$1" >&2
  exit 1
}

coolify_trigger_usage() {
  printf 'usage: COOLIFY_DEPLOY_WEBHOOK=... %s SERVICE ENVIRONMENT\n' "$0" >&2
  printf 'SERVICE must be api, bot, or mcp; ENVIRONMENT must be staging or production.\n' >&2
}

if [ "$#" -ne 2 ]; then
  coolify_trigger_usage
  exit 2
fi

service="$1"
environment="$2"

case "$service" in
  api|bot|mcp) ;;
  *)
    coolify_trigger_fail "unsupported service '$service'; expected api, bot, or mcp"
    ;;
esac

case "$environment" in
  staging|production) ;;
  *)
    coolify_trigger_fail "unsupported environment '$environment'; expected staging or production"
    ;;
esac

# Called workflows run with workflow_call as their local event. Require the
# caller to pass through its original event so pull requests cannot deploy by
# accident through a reusable workflow.
event_name="${GITHUB_EVENT_NAME:-}"
if [ "$event_name" = 'workflow_call' ]; then
  event_name="${COOLIFY_CALLER_EVENT_NAME:-}"
  case "$event_name" in
    push|workflow_dispatch) ;;
    *)
      coolify_trigger_fail 'workflow_call requires COOLIFY_CALLER_EVENT_NAME=push or workflow_dispatch; pull_request deployments are disabled'
      ;;
  esac
else
  case "$event_name" in
    push|workflow_dispatch) ;;
    pull_request)
      coolify_trigger_fail 'pull_request deployments are disabled; use push or workflow_dispatch'
      ;;
    *)
      coolify_trigger_fail 'unsupported GitHub event; only push and workflow_dispatch may deploy'
      ;;
      esac
fi

github_ref="${GITHUB_REF:-}"
case "$github_ref" in
  refs/heads/dev)
    expected_environment='staging'
    ;;
  refs/heads/main)
    expected_environment='production'
    ;;
  *)
    coolify_trigger_fail 'deployment requires GITHUB_REF refs/heads/dev or refs/heads/main'
    ;;
esac

if [ "$environment" != "$expected_environment" ]; then
  coolify_trigger_fail "environment '$environment' does not match branch routing for $github_ref (expected $expected_environment)"
fi

case "$service/$environment" in
  api/staging) secret_name='COOLIFY_DEPLOY_WEBHOOK_API_STAGING' ;;
  api/production) secret_name='COOLIFY_DEPLOY_WEBHOOK_API_PRODUCTION' ;;
  bot/staging) secret_name='COOLIFY_DEPLOY_WEBHOOK_BOT_STAGING' ;;
  bot/production) secret_name='COOLIFY_DEPLOY_WEBHOOK_BOT_PRODUCTION' ;;
  mcp/staging) secret_name='COOLIFY_DEPLOY_WEBHOOK_MCP_STAGING' ;;
  mcp/production) secret_name='COOLIFY_DEPLOY_WEBHOOK_MCP_PRODUCTION' ;;
  *) coolify_trigger_fail 'could not resolve the Coolify webhook secret name' ;;
esac
webhook="${COOLIFY_DEPLOY_WEBHOOK:-}"
if [ -z "$webhook" ]; then
  coolify_trigger_fail "missing Coolify webhook secret; set $secret_name and map it to COOLIFY_DEPLOY_WEBHOOK"
fi

# Keep the value safe for a quoted curl config entry. In particular, reject
# control/whitespace characters, quotes, backslashes, fragments, userinfo, and
# malformed authorities before the value reaches curl.
if [[ "$webhook" =~ [[:cntrl:][:space:]] ]]; then
  coolify_trigger_fail 'Coolify webhook URL contains whitespace or control characters'
fi
coolify_url_pattern='^https://([A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(:[0-9]{1,5})?(/[A-Za-z0-9._~:/?%+@!$&()*;,=-]*)?$'
if [[ ! "$webhook" =~ $coolify_url_pattern ]]; then
  coolify_trigger_fail 'Coolify webhook URL must be an https URL with a valid host and path'
fi

if ! command -v curl >/dev/null 2>&1; then
  coolify_trigger_fail 'curl is required to trigger Coolify'
fi

# -q must be the first curl option so a runner-level .curlrc cannot add a
# redirect, retry, verbose, proxy, or alternate output behavior. The webhook
# itself is read from stdin config; stderr and response body are discarded so
# neither can echo URL or secret material. No --location means redirects are
# never followed; max-redirs=0 makes that invariant explicit in curl config.
if ! http_status="$({
  printf 'url = "%s"\n' "$webhook"
  printf 'request = POST\n'
  printf 'output = /dev/null\n'
  printf 'write-out = "%%{http_code}"\n'
  printf 'connect-timeout = 10\n'
  printf 'max-time = 30\n'
  printf 'max-redirs = 0\n'
  printf 'retry = 0\n';
} | curl -q --globoff --silent --config - 2>/dev/null)"; then
  coolify_trigger_fail "webhook request failed for $service/$environment (network or curl error)"
fi

if [[ ! "$http_status" =~ ^2[0-9]{2}$ ]]; then
  coolify_trigger_fail "Coolify rejected $service/$environment webhook with HTTP $http_status"
fi

printf 'Coolify deploy webhook accepted for %s/%s (HTTP %s).\n' "$service" "$environment" "$http_status"
