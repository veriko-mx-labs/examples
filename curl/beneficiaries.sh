#!/usr/bin/env bash
# Crea, lista, actualiza y elimina la cuenta de un beneficiario guardado.
#
#   VERIKO_API_KEY=veriko_... bash curl/beneficiaries.sh
#
# Un beneficiario ayuda a que la validación por comprobante complete una cuenta que la imagen
# muestra enmascarada. La cuenta de abajo es de ejemplo; eliminar archiva al beneficiario. Las
# llamadas de beneficiarios no consumen cuota.
#
# veriko:operation POST /beneficiaries body=account_number,bank_code,label
# veriko:operation GET /beneficiaries
# veriko:operation PUT /beneficiaries/{id} body=label
# veriko:operation DELETE /beneficiaries/{id}
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

api POST /beneficiaries \
  --header "Content-Type: application/json" \
  --data '{"account_number": "012180004412345678", "bank_code": "40012", "label": "Proveedor de ejemplo"}'
id="$(jq -r '.data.id' "$BODY_FILE")"
echo "Creado ${id}"

api GET /beneficiaries
echo "$(jq -r '.data | length' "$BODY_FILE") beneficiarios"

api PUT "/beneficiaries/${id}" \
  --header "Content-Type: application/json" \
  --data '{"label": "Proveedor de ejemplo (con otro nombre)"}'
echo "Actualizado ${id}"

api DELETE "/beneficiaries/${id}"
echo "Eliminado ${id}"
