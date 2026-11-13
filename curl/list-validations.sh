#!/usr/bin/env bash
# Walk every page of the validation history.
#
#   VERIKO_API_KEY=veriko_... bash curl/list-validations.sh
#
# `per_page` accepts 1 to 50 on this listing; a larger value is clamped. Move forward with `page`
# until `meta.pagination.total_pages`. Parameters the operation does not declare are ignored without
# an error, so check the names.
# Listing consumes no quota.
#
# veriko:operation GET /validations query=page,per_page,from,to
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

page=1
total_pages=1
while [[ $page -le $total_pages ]]; do
  api_retry GET "/validations?page=${page}&per_page=50&from=2025-01-01&to=2025-12-31"
  jq -r '.data[] | "\(.id) \(.attributes.status)"' "$BODY_FILE"
  total_pages="$(jq -r '.meta.pagination.total_pages' "$BODY_FILE")"
  page=$((page + 1))
done
