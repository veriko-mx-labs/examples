#!/usr/bin/env bash
# Read and update the account retry policy, which re-queries validations that ended without a verdict.
#
#   VERIKO_API_KEY=veriko_... bash curl/retry-policy.sh
#
# A retry belongs to the original validation and consumes no extra quota. The update replaces the
# whole policy; `max_retries` and `interval_seconds` have per-plan caps (`422 retry_policy_invalid`
# above them). The policy applies to validations created afterwards.
#
# veriko:operation GET /users/me/retry-policy
# veriko:operation PUT /users/me/retry-policy headers=Idempotency-Key body=retry_policy,enabled,max_retries,interval_seconds,outcomes
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

api GET /users/me/retry-policy
echo "Current: $(jq -c '.data.attributes' "$BODY_FILE")"
echo "Plan caps: $(jq -c '.meta.caps' "$BODY_FILE")"

api_retry PUT /users/me/retry-policy \
  --header "Idempotency-Key: example-retry-policy-v1" \
  --header "Content-Type: application/json" \
  --data '{
    "retry_policy": {
      "enabled": true,
      "max_retries": 3,
      "interval_seconds": 600,
      "outcomes": ["not_found", "cep_unavailable", "error"]
    }
  }'
echo "Updated: $(jq -c '.data.attributes' "$BODY_FILE")"
