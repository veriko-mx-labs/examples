#!/usr/bin/env bash
# Pone en cola una validación por sus campos y sondea hasta que el veredicto sea final.
#
#   VERIKO_API_KEY=veriko_... bash curl/enqueue-and-poll.sh
#
# `?async=1` responde 202 de inmediato. El sondeo espera `Retry-After` segundos entre peticiones,
# devuelve el ETag en `If-None-Match` y se detiene en el estado final o en `expires_at`.
# Cada validación aceptada consume cuota. La transferencia es de ejemplo: espera `not_found`.
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
    "client_ref": "pedido-ejemplo-1"
  }'

id="$(jq -r '.data.id' "$BODY_FILE")"
echo "En cola ${id}; el primer sondeo toca en $(jq -r '.meta.next_poll_after_seconds // 2' "$BODY_FILE") s." >&2

poll_validation "$id" "$(jq -r '.data.attributes.expires_at // empty' "$BODY_FILE")"
jq -r '"\(.data.id) \(.data.attributes.status)"' "$BODY_FILE"
