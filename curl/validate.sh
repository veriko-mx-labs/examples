#!/usr/bin/env bash
# Validate a SPEI transfer by its fields, waiting for the verdict in the same request.
#
#   VERIKO_API_KEY=veriko_... bash curl/validate.sh
#
# Every accepted validation consumes quota, including one that ends in `not_found`.
# The transfer below is example data: it does not exist at Banxico, so expect `not_found`.
# Replace it with a real transfer to get `valid`.
#
# veriko:operation POST /validate body=send_date,amount,tracking_key,sender_bank,beneficiary_account
# veriko:operation GET /validations/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TIMEOUT=$SYNC_TIMEOUT api POST /validate \
  --header "Content-Type: application/json" \
  --data '{
    "send_date": "2025-03-15",
    "amount": 15000.50,
    "tracking_key": "MXBA20250315001234",
    "sender_bank": "40012",
    "beneficiary_account": "012180004412345678"
  }'

if [[ "$STATUS" == "202" ]]; then
  # Banxico took longer than 45 s: the validation continues in the background.
  echo "Still $(jq -r '.data.attributes.status' "$BODY_FILE") ($(jq -r '.meta.async_reason' "$BODY_FILE")); polling." >&2
  poll_validation "$(jq -r '.data.id' "$BODY_FILE")" "$(jq -r '.data.attributes.expires_at // empty' "$BODY_FILE")"
fi

jq -r '"\(.data.id) \(.data.attributes.status)"' "$BODY_FILE"
jq -r '.data.links.cep_pdf // empty | "CEP available: " + .' "$BODY_FILE"
