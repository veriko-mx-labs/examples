#!/usr/bin/env bash
# Exporta en un ZIP los archivos de CEP de un rango de fechas, armado en segundo plano.
#
#   VERIKO_API_KEY=veriko_... bash curl/finance-cep-export.sh 2025-03-01 2025-03-31
#
# La petición responde 202 con una exportación en `queued`. Sondéala hasta que el estado sea `ready`,
# `failed` o `expired` y luego descarga el ZIP. El archivo vence 24 horas después de quedar listo.
# El `Idempotency-Key` hace que una petición repetida reutilice la misma exportación.
#
# veriko:operation POST /finance/ceps/exports headers=Idempotency-Key body=from,to
# veriko:operation GET /finance/ceps/exports/{id}
# veriko:operation GET /finance/ceps/exports/{id}/download
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

from="${1:?Uso: finance-cep-export.sh <desde AAAA-MM-DD> <hasta AAAA-MM-DD>}"
to="${2:?Uso: finance-cep-export.sh <desde AAAA-MM-DD> <hasta AAAA-MM-DD>}"
CEP_EXPORT_TERMINAL_STATUSES="ready failed expired"

api_retry POST /finance/ceps/exports \
  --header "Idempotency-Key: ejemplo-exportacion-cep-${from}-${to}" \
  --header "Content-Type: application/json" \
  --data "{\"from\": \"${from}\", \"to\": \"${to}\"}"
id="$(jq -r '.data.id' "$BODY_FILE")"

while true; do
  api_retry GET "/finance/ceps/exports/${id}"
  status="$(jq -r '.data.attributes.status' "$BODY_FILE")"
  if [[ " $CEP_EXPORT_TERMINAL_STATUSES " == *" $status "* ]]; then
    [[ "$status" == "ready" ]] || { echo "La exportación ${id} terminó como ${status}" >&2; exit 1; }
    break
  fi
  echo "Exportación ${id}: ${status}" >&2
  sleep 5
done

TIMEOUT=120 api GET "/finance/ceps/exports/${id}/download"
cp "$BODY_FILE" "ceps-${from}-${to}.zip"
echo "Guardado ceps-${from}-${to}.zip"
