#!/usr/bin/env bash
# Export the CEP files of a date range as a ZIP, built in the background.
#
#   VERIKO_API_KEY=veriko_... bash curl/finance-cep-export.sh 2025-03-01 2025-03-31
#
# The request answers 202 with an export in `queued`. Poll it until the status is `ready`, `failed` or
# `expired`, then download the ZIP. The file expires 24 hours after it is ready. The
# `Idempotency-Key` makes a repeated request reuse the same export.
#
# veriko:operation POST /finance/ceps/exports headers=Idempotency-Key body=from,to
# veriko:operation GET /finance/ceps/exports/{id}
# veriko:operation GET /finance/ceps/exports/{id}/download
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

from="${1:?Usage: finance-cep-export.sh <from YYYY-MM-DD> <to YYYY-MM-DD>}"
to="${2:?Usage: finance-cep-export.sh <from YYYY-MM-DD> <to YYYY-MM-DD>}"
CEP_EXPORT_TERMINAL_STATUSES="ready failed expired"

api_retry POST /finance/ceps/exports \
  --header "Idempotency-Key: example-cep-export-${from}-${to}" \
  --header "Content-Type: application/json" \
  --data "{\"from\": \"${from}\", \"to\": \"${to}\"}"
id="$(jq -r '.data.id' "$BODY_FILE")"

while true; do
  api_retry GET "/finance/ceps/exports/${id}"
  status="$(jq -r '.data.attributes.status' "$BODY_FILE")"
  if [[ " $CEP_EXPORT_TERMINAL_STATUSES " == *" $status "* ]]; then
    [[ "$status" == "ready" ]] || { echo "Export ${id} ended as ${status}" >&2; exit 1; }
    break
  fi
  echo "Export ${id}: ${status}" >&2
  sleep 5
done

TIMEOUT=120 api GET "/finance/ceps/exports/${id}/download"
cp "$BODY_FILE" "ceps-${from}-${to}.zip"
echo "Saved ceps-${from}-${to}.zip"
