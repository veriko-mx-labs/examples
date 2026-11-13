#!/usr/bin/env bash
# Download the CEP of a validation as a PDF or an XML file.
#
#   VERIKO_API_KEY=veriko_... bash curl/download-cep.sh <validation id> [pdf|xml]
#
# The CEP exists only when the validation is `valid` or `returned`. Otherwise the API answers 404
# `cep_not_available`. A validation that was purged answers 410 and an unknown format, 400
# `invalid_export_format`.
#
# veriko:operation GET /validations/{id}/cep query=format
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

id="${1:?Usage: download-cep.sh <validation id> [pdf|xml]}"
format="${2:-pdf}"

api GET "/validations/${id}/cep?format=${format}"
cp "$BODY_FILE" "cep-${id}.${format}"
echo "Saved cep-${id}.${format} ($(header content-type))"
