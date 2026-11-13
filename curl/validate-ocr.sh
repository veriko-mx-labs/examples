#!/usr/bin/env bash
# Validate a SPEI transfer from its receipt: an image or a PDF of 1 to 3 pages.
#
#   VERIKO_API_KEY=veriko_... bash curl/validate-ocr.sh path/to/receipt.png
#   VERIKO_API_KEY=veriko_... bash curl/validate-ocr.sh https://example.com/receipt.png
#
# The argument is a local file (sent as base64) or an HTTPS URL (sent as `image_url`).
# Every accepted validation consumes quota. A receipt that is unreadable or is not a SPEI
# receipt is rejected with 422 (`image_not_readable_receipt`, `image_not_spei_receipt`) and
# the validation is still charged.
#
# veriko:operation POST /validate-ocr body=image,image_url
# veriko:operation GET /validations/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

source_arg="${1:?Usage: validate-ocr.sh <receipt file or https URL>}"
receipt_body "$source_arg" > "$WORK_DIR/request.json"

TIMEOUT=$SYNC_TIMEOUT api POST /validate-ocr \
  --header "Content-Type: application/json" \
  --data-binary "@$WORK_DIR/request.json"

if [[ "$STATUS" == "202" ]]; then
  poll_validation "$(jq -r '.data.id' "$BODY_FILE")" "$(jq -r '.data.attributes.expires_at // empty' "$BODY_FILE")"
fi
jq -r '"\(.data.id) \(.data.attributes.status)"' "$BODY_FILE"
