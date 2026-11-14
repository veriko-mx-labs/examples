#!/usr/bin/env bash
# Exporta el historial de validaciones como un archivo CSV.
#
#   VERIKO_API_KEY=veriko_... bash curl/export-validations.sh
#
# `format` acepta `csv` y `xlsx` (`csv` por defecto). La respuesta es un archivo adjunto; un
# error llega como JSON. Exportar no consume cuota.
#
# veriko:operation GET /validations/export query=format,from,to,limit
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TIMEOUT=120 api_retry GET "/validations/export?format=csv&from=2025-01-01&to=2025-12-31&limit=1000"
cp "$BODY_FILE" validations.csv
echo "Guardado validations.csv ($(wc -c < validations.csv | tr -d ' ') bytes)"
