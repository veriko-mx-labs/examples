#!/usr/bin/env bash
# Handle API errors: check the HTTP status first, branch on `errors[].code`, show `detail` and `hint`.
#
#   VERIKO_API_KEY=veriko_... bash curl/error-handling.sh
#
# This script sends an invalid request on purpose (a `422`). The API rejects it before it
# reaches Banxico, so it consumes no quota.
# Branch on `code`: it is stable and never translated. `detail` changes with the
# `Accept-Language` header and may be reworded, so show it but do not compare it.
#
# veriko:operation POST /validate body=amount,beneficiary_account
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# Neither `tracking_key` nor `numeric_reference`: the API cannot look the payment up.
# `api` already prints every entry of `errors[]` with its pointer and hint.
if TIMEOUT=$SYNC_TIMEOUT api POST /validate \
  --header "Content-Type: application/json" \
  --data '{"amount": 100, "beneficiary_account": "012180004412345678"}'; then
  exit 0
fi

case "$ERROR_CODE" in
  quota_exceeded) echo "The plan quota is spent. Do not retry; upgrade the plan or wait for the renewal." ;;
  rate_limit_exceeded) echo "Rate limited. Retry after $(header retry-after) s." ;;
  network_error) echo "No response: check the connection and the timeout." ;;
  *) echo "Failed with HTTP ${STATUS} (${ERROR_CODE})." ;;
esac
exit 1
