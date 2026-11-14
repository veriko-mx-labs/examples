#!/usr/bin/env bash
# Pone en cola la validación de un comprobante (`POST /validate-ocr?async=1`) y sondea hasta que sea final.
#
#   VERIKO_API_KEY=veriko_... bash curl/enqueue-ocr-and-poll.sh ruta/al/comprobante.png
#
# El argumento es un archivo local o una URL HTTPS. Con varias `candidate_accounts`, la validación
# sigue consumiendo una sola unidad de cuota. Cada validación aceptada consume cuota, y un
# comprobante que no se puede leer también se cobra.
#
# veriko:operation POST /validate-ocr?async=1 query=async body=image,image_url,candidate_accounts,client_ref
# veriko:operation GET /validations/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

source_arg="${1:?Uso: enqueue-ocr-and-poll.sh <archivo del comprobante o URL https>}"
# client_ref vuelve en la validación y en los webhooks. Cuando el comprobante no muestra la
# cuenta, agrega `candidate_accounts` (valores de ejemplo): '["012180004412345678", "002010077777777771"]'.
receipt_body "$source_arg" | jq '. + {client_ref: "comprobante-ejemplo-1"}' > "$WORK_DIR/request.json"

api POST "/validate-ocr?async=1" \
  --header "Content-Type: application/json" \
  --data-binary "@$WORK_DIR/request.json"

id="$(jq -r '.data.id' "$BODY_FILE")"
echo "En cola ${id}" >&2
poll_validation "$id" "$(jq -r '.data.attributes.expires_at // empty' "$BODY_FILE")"
jq -r '"\(.data.id) \(.data.attributes.status)"' "$BODY_FILE"
