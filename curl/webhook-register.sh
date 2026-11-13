#!/usr/bin/env bash
# Register a webhook endpoint, send a test delivery and show its delivery history.
#
#   VERIKO_API_KEY=veriko_... bash curl/webhook-register.sh https://example.com/hooks/veriko [--delete]
#
# The URL must be a public HTTPS address that answers 2xx: run a receiver from node/, python/ or
# php/ behind a tunnel while you try it. The response carries the signing `secret` once; store it
# as VERIKO_WEBHOOK_SECRET for the receiver. The endpoint subscribes to all seven validation
# events, so `validation.returned` reports a later return.
#
# veriko:operation POST /webhooks body=url,events,description
# veriko:operation POST /webhooks/{id}/test
# veriko:operation GET /webhooks/{id}/deliveries query=per_page
# veriko:operation DELETE /webhooks/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

url="${1:?Usage: webhook-register.sh <public https URL> [--delete]}"

jq -n --arg url "$url" '{
  url: $url,
  description: "Example endpoint",
  events: [
    "validation.completed", "validation.failed", "validation.error", "validation.returned",
    "validation.retry.scheduled", "validation.retry.resolved", "validation.retry.exhausted"
  ]
}' > "$WORK_DIR/request.json"

api POST /webhooks \
  --header "Content-Type: application/json" \
  --data-binary "@$WORK_DIR/request.json"
id="$(jq -r '.data.id' "$BODY_FILE")"
echo "Endpoint ${id}"
echo "Secret (shown once): $(jq -r '.data.attributes.secret' "$BODY_FILE")"

# The test returns 200 even when delivery failed: check `delivered`.
api POST "/webhooks/${id}/test"
jq -r '.data.attributes | "Test delivered=\(.delivered) http_status=\(.http_status) \(.error // "")"' "$BODY_FILE"

api GET "/webhooks/${id}/deliveries?per_page=5"
jq -r '.data[] | "\(.id) \(.attributes.status)"' "$BODY_FILE"

if [[ "${2:-}" == "--delete" ]]; then
  api DELETE "/webhooks/${id}"
  echo "Deleted ${id}"
fi
