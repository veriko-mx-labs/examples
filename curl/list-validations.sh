#!/usr/bin/env bash
# Recorre todas las páginas del historial de validaciones.
#
#   VERIKO_API_KEY=veriko_... bash curl/list-validations.sh
#
# `per_page` acepta de 1 a 50 en este listado; un valor mayor se ajusta al tope. Avanza con `page`
# hasta `meta.pagination.total_pages`. Los parámetros que la operación no declara se ignoran sin
# error, así que revisa los nombres.
# Listar no consume cuota.
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
