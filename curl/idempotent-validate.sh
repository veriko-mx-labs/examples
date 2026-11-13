#!/usr/bin/env bash
# Retry a validation safely: one `Idempotency-Key` per business attempt, backoff on transient failures.
#
#   VERIKO_API_KEY=veriko_... bash curl/idempotent-validate.sh
#
# The key identifies the attempt, so derive it from your own identifier (here an order number),
# never from a random value per send. The API stores it for 24 hours:
#   - same key, same body: the original response comes back with `Idempotent-Replayed: true`;
#   - same key, different body: 422 `idempotency_key_reused`;
#   - same key while the first request runs: 409 `idempotency_key_in_progress`.
# `api_retry` repeats the request on 408, 429, 500, 502, 503, 504 and on network failures,
# waiting `Retry-After` when present. It never retries `quota_exceeded`: that 429 lasts until
# the plan renews.
# The second call below replays the first: it consumes no additional quota. The transfer is
# example data: expect `not_found`.
#
# veriko:operation POST /validate headers=Idempotency-Key body=send_date,amount,tracking_key,sender_bank,beneficiary_account
# veriko:operation GET /validations/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

for attempt in 1 2; do
  TIMEOUT=$SYNC_TIMEOUT api_retry POST /validate \
    --header "Idempotency-Key: example-order-4812-attempt-1" \
    --header "Content-Type: application/json" \
    --data '{
      "send_date": "2025-03-15",
      "amount": 15000.50,
      "tracking_key": "MXBA20250315001234",
      "sender_bank": "40012",
      "beneficiary_account": "012180004412345678"
    }'
  replayed="$(header idempotent-replayed)"
  if [[ "$STATUS" == "202" ]]; then
    poll_validation "$(jq -r '.data.id' "$BODY_FILE")" "$(jq -r '.data.attributes.expires_at // empty' "$BODY_FILE")"
  fi
  echo "Call ${attempt}: $(jq -r '"\(.data.id) \(.data.attributes.status)"' "$BODY_FILE") replayed=${replayed:-false}"
done
