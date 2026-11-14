#!/usr/bin/env bash
# Valida una transferencia SPEI a partir de su comprobante: una imagen o un PDF de 1 a 3 páginas.
#
#   VERIKO_API_KEY=veriko_... bash curl/validate-ocr.sh ruta/al/comprobante.png
#   VERIKO_API_KEY=veriko_... bash curl/validate-ocr.sh https://example.com/comprobante.png
#
# El argumento es un archivo local (se envía en base64) o una URL HTTPS (se envía como `image_url`).
# Cada validación aceptada consume cuota. Un comprobante que no se puede leer o que no es de
# SPEI se rechaza con 422 (`image_not_readable_receipt`, `image_not_spei_receipt`) y la
# validación se cobra de todos modos.
#
# veriko:operation POST /validate-ocr body=image,image_url
# veriko:operation GET /validations/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

source_arg="${1:?Uso: validate-ocr.sh <archivo del comprobante o URL https>}"
receipt_body "$source_arg" > "$WORK_DIR/request.json"

TIMEOUT=$SYNC_TIMEOUT api POST /validate-ocr \
  --header "Content-Type: application/json" \
  --data-binary "@$WORK_DIR/request.json"

if [[ "$STATUS" == "202" ]]; then
  poll_validation "$(jq -r '.data.id' "$BODY_FILE")" "$(jq -r '.data.attributes.expires_at // empty' "$BODY_FILE")"
fi
jq -r '"\(.data.id) \(.data.attributes.status)"' "$BODY_FILE"
