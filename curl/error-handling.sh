#!/usr/bin/env bash
# Maneja los errores de la API: revisa primero el estado HTTP, decide con `errors[].code` y muestra `detail` y `hint`.
#
#   VERIKO_API_KEY=veriko_... bash curl/error-handling.sh
#
# Este script envía a propósito una petición inválida (un `422`). La API la rechaza antes de
# llegar a Banxico, así que no consume cuota.
# Decide con `code`: es estable y nunca se traduce. `detail` cambia con la cabecera
# `Accept-Language` y puede reformularse, así que muéstralo pero no lo compares.
#
# veriko:operation POST /validate body=amount,beneficiary_account
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# No trae `tracking_key` ni `numeric_reference`: la API no puede buscar el pago.
# `api` ya imprime cada entrada de `errors[]` con su puntero y su sugerencia.
if TIMEOUT=$SYNC_TIMEOUT api POST /validate \
  --header "Content-Type: application/json" \
  --data '{"amount": 100, "beneficiary_account": "012180004412345678"}'; then
  exit 0
fi

case "$ERROR_CODE" in
  quota_exceeded) echo "Se agotó la cuota del plan. No reintentes; cambia de plan o espera a la renovación." ;;
  rate_limit_exceeded) echo "Límite de tasa alcanzado. Reintenta en $(header retry-after) s." ;;
  network_error) echo "Sin respuesta: revisa la conexión y el tiempo límite." ;;
  *) echo "Falló con HTTP ${STATUS} (${ERROR_CODE})." ;;
esac
exit 1
