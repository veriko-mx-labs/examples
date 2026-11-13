#!/usr/bin/env bash
# Export the validation history as a CSV file.
#
#   VERIKO_API_KEY=veriko_... bash curl/export-validations.sh
#
# `format` accepts `csv` and `xlsx` (default `csv`). The response is a file attachment; an
# error comes back as JSON. Exporting consumes no quota.
#
# veriko:operation GET /validations/export query=format,from,to,limit
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TIMEOUT=120 api_retry GET "/validations/export?format=csv&from=2025-01-01&to=2025-12-31&limit=1000"
cp "$BODY_FILE" validations.csv
echo "Saved validations.csv ($(wc -c < validations.csv | tr -d ' ') bytes)"
