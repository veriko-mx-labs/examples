#!/usr/bin/env bash
# Valida una transferencia SPEI con los datos exactos (sin OCR de imagen).
# Requiere: VERIKO_API_KEY en el entorno. Referencia completa: https://docs.veriko.mx/openapi.yaml
set -euo pipefail

if [[ -z "${VERIKO_API_KEY:-}" ]]; then
  echo "Falta la variable de entorno VERIKO_API_KEY (empieza con veriko_)." >&2
  exit 1
fi

curl -sS -X POST "https://api.veriko.mx/v1/validate" \
  -H "Authorization: Bearer ${VERIKO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2025-03-15",
    "monto": 15000.50,
    "clave_rastreo": "MXBA20250315001234",
    "cuenta_beneficiaria": "012180004412345678"
  }'
