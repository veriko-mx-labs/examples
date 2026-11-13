#!/usr/bin/env bash
# Create, list, update and delete a saved beneficiary account.
#
#   VERIKO_API_KEY=veriko_... bash curl/beneficiaries.sh
#
# A beneficiary helps the receipt validation complete an account the image shows masked. The
# account below is example data; deleting archives the beneficiary. Beneficiary calls consume no
# quota.
#
# veriko:operation POST /beneficiaries body=account_number,bank_code,label
# veriko:operation GET /beneficiaries
# veriko:operation PUT /beneficiaries/{id} body=label
# veriko:operation DELETE /beneficiaries/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

api POST /beneficiaries \
  --header "Content-Type: application/json" \
  --data '{"account_number": "012180004412345678", "bank_code": "40012", "label": "Example supplier"}'
id="$(jq -r '.data.id' "$BODY_FILE")"
echo "Created ${id}"

api GET /beneficiaries
echo "$(jq -r '.data | length' "$BODY_FILE") beneficiaries"

api PUT "/beneficiaries/${id}" \
  --header "Content-Type: application/json" \
  --data '{"label": "Example supplier (renamed)"}'
echo "Updated ${id}"

api DELETE "/beneficiaries/${id}"
echo "Deleted ${id}"
