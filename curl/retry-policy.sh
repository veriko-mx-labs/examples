#!/usr/bin/env bash
# Consulta y actualiza la política de reintentos de la cuenta, que vuelve a consultar las validaciones que terminaron sin veredicto.
#
#   VERIKO_API_KEY=veriko_... bash curl/retry-policy.sh
#
# Un reintento pertenece a la validación original y no consume cuota extra. La actualización
# reemplaza toda la política; `max_retries` e `interval_seconds` tienen topes por plan
# (`422 retry_policy_invalid` si los rebasas). La política aplica a las validaciones que se
# creen después.
#
# veriko:operation GET /users/me/retry-policy
# veriko:operation PUT /users/me/retry-policy headers=Idempotency-Key body=retry_policy,enabled,max_retries,interval_seconds,outcomes
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

api GET /users/me/retry-policy
echo "Actual: $(jq -c '.data.attributes' "$BODY_FILE")"
echo "Topes del plan: $(jq -c '.meta.caps' "$BODY_FILE")"

api_retry PUT /users/me/retry-policy \
  --header "Idempotency-Key: ejemplo-politica-reintentos-v1" \
  --header "Content-Type: application/json" \
  --data '{
    "retry_policy": {
      "enabled": true,
      "max_retries": 3,
      "interval_seconds": 600,
      "outcomes": ["not_found", "cep_unavailable", "error"]
    }
  }'
echo "Actualizada: $(jq -c '.data.attributes' "$BODY_FILE")"
