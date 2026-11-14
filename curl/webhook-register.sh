#!/usr/bin/env bash
# Registra un endpoint de webhook, envía una entrega de prueba y muestra su historial de entregas.
#
#   VERIKO_API_KEY=veriko_... bash curl/webhook-register.sh https://example.com/hooks/veriko [--delete]
#
# La URL debe ser una dirección HTTPS pública que responda 2xx: mientras pruebas, corre un receptor
# de node/, python/ o php/ detrás de un túnel. La respuesta trae el `secret` de firma una sola
# vez; guárdalo como VERIKO_WEBHOOK_SECRET para el receptor. El endpoint se suscribe a los siete
# eventos de validación, así que `validation.returned` avisa de una devolución posterior.
#
# veriko:operation POST /webhooks body=url,events,description
# veriko:operation POST /webhooks/{id}/test
# veriko:operation GET /webhooks/{id}/deliveries query=per_page
# veriko:operation DELETE /webhooks/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

url="${1:?Uso: webhook-register.sh <URL https pública> [--delete]}"

jq -n --arg url "$url" '{
  url: $url,
  description: "Endpoint de ejemplo",
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
echo "Secreto (se muestra una vez): $(jq -r '.data.attributes.secret' "$BODY_FILE")"

# La prueba responde 200 aunque la entrega falle: revisa `delivered`.
api POST "/webhooks/${id}/test"
jq -r '.data.attributes | "Prueba delivered=\(.delivered) http_status=\(.http_status) \(.error // "")"' "$BODY_FILE"

api GET "/webhooks/${id}/deliveries?per_page=5"
jq -r '.data[] | "\(.id) \(.attributes.status)"' "$BODY_FILE"

if [[ "${2:-}" == "--delete" ]]; then
  api DELETE "/webhooks/${id}"
  echo "Eliminado ${id}"
fi
