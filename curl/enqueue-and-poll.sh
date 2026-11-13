#!/usr/bin/env bash
# Enqueue a validation by its fields and poll until the verdict is final.
#
#   VERIKO_API_KEY=veriko_... bash curl/enqueue-and-poll.sh
#
# `?async=1` answers 202 at once. The poll waits `Retry-After` seconds between requests, sends the
# ETag back in `If-None-Match`, and stops at the final status or at `expires_at`.
# Every accepted validation consumes quota. The transfer is example data: expect `not_found`.
#
# veriko:operation POST /validate?async=1 query=async body=send_date,amount,tracking_key,sender_bank,beneficiary_account,client_ref
# veriko:operation GET /validations/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

api POST "/validate?async=1" \
  --header "Content-Type: application/json" \
  --data '{
    "send_date": "2025-03-15",
    "amount": 15000.50,
    "tracking_key": "MXBA20250315001234",
    "sender_bank": "40012",
    "beneficiary_account": "012180004412345678",
    "client_ref": "example-order-1"
  }'

id="$(jq -r '.data.id' "$BODY_FILE")"
echo "Queued ${id}; the first poll is due in $(jq -r '.meta.next_poll_after_seconds // 2' "$BODY_FILE") s." >&2

poll_validation "$id" "$(jq -r '.data.attributes.expires_at // empty' "$BODY_FILE")"
jq -r '"\(.data.id) \(.data.attributes.status)"' "$BODY_FILE"
