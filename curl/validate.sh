#!/usr/bin/env bash
# Valida una transferencia SPEI por sus campos y espera el veredicto en la misma petición.
#
#   VERIKO_API_KEY=veriko_... bash curl/validate.sh
#
# Cada validación aceptada consume cuota, también la que termina en `not_found`.
# La transferencia de abajo es de ejemplo: no existe en Banxico, así que espera `not_found`.
# Cámbiala por una transferencia real para obtener `valid`.
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
  # Banxico tardó más de 45 s: la validación sigue en segundo plano.
  echo "Sigue en $(jq -r '.data.attributes.status' "$BODY_FILE") ($(jq -r '.meta.async_reason' "$BODY_FILE"))); sondeando." >&2
  poll_validation "$(jq -r '.data.id' "$BODY_FILE")" "$(jq -r '.data.attributes.expires_at // empty' "$BODY_FILE")"
fi

jq -r '"\(.data.id) \(.data.attributes.status)"' "$BODY_FILE"
jq -r '.data.links.cep_pdf // empty | "CEP disponible: " + .' "$BODY_FILE"
