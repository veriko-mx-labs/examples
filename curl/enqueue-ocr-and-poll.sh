#!/usr/bin/env bash
# Enqueue a validation from a receipt (`POST /validate-ocr?async=1`) and poll until it is final.
#
#   VERIKO_API_KEY=veriko_... bash curl/enqueue-ocr-and-poll.sh path/to/receipt.png
#
# The argument is a local file or an HTTPS URL. With several `candidate_accounts` the validation
# still consumes a single unit of quota. Every accepted validation consumes quota, and a receipt
# that cannot be read is charged too.
#
# veriko:operation POST /validate-ocr?async=1 query=async body=image,image_url,candidate_accounts,client_ref
# veriko:operation GET /validations/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

source_arg="${1:?Usage: enqueue-ocr-and-poll.sh <receipt file or https URL>}"
# client_ref comes back on the validation and in webhooks. When the receipt does not show the
# account, add `candidate_accounts` (example values): '["012180004412345678", "002010077777777771"]'.
receipt_body "$source_arg" | jq '. + {client_ref: "example-receipt-1"}' > "$WORK_DIR/request.json"

api POST "/validate-ocr?async=1" \
  --header "Content-Type: application/json" \
  --data-binary "@$WORK_DIR/request.json"

id="$(jq -r '.data.id' "$BODY_FILE")"
echo "Queued ${id}" >&2
poll_validation "$id" "$(jq -r '.data.attributes.expires_at // empty' "$BODY_FILE")"
jq -r '"\(.data.id) \(.data.attributes.status)"' "$BODY_FILE"
