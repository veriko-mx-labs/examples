#!/usr/bin/env bash
# Descarga el CEP de una validación como archivo PDF o XML.
#
#   VERIKO_API_KEY=veriko_... bash curl/download-cep.sh <id de la validación> [pdf|xml]
#
# El CEP existe sólo cuando la validación es `valid` o `returned`. En otro caso la API responde 404
# `cep_not_available`. Una validación purgada responde 410 y un formato desconocido, 400
# `invalid_export_format`.
#
# veriko:operation GET /validations/{id}/cep query=format
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

id="${1:?Uso: download-cep.sh <id de la validación> [pdf|xml]}"
format="${2:-pdf}"

api GET "/validations/${id}/cep?format=${format}"
cp "$BODY_FILE" "cep-${id}.${format}"
echo "Guardado cep-${id}.${format} ($(header content-type))"
