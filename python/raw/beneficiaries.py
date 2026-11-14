#!/usr/bin/env python3
"""Crea, lista, actualiza y elimina la cuenta de un beneficiario guardado.

    VERIKO_API_KEY=veriko_... python3 python/raw/beneficiaries.py

Un beneficiario ayuda a que la validación por comprobante complete una cuenta que la imagen
muestra enmascarada. La cuenta de abajo es de ejemplo; eliminar archiva al beneficiario. Las
llamadas de beneficiarios no consumen cuota.
"""
# veriko:operation POST /beneficiaries body=account_number,bank_code,label
# veriko:operation GET /beneficiaries
# veriko:operation PUT /beneficiaries/{id} body=label
# veriko:operation DELETE /beneficiaries/{id}
from client import api, run


def main() -> None:
    created = api("POST", "/beneficiaries", body={
        "account_number": "012180004412345678", "bank_code": "40012", "label": "Proveedor de ejemplo"}).body
    beneficiary_id = created["data"]["id"]
    print("Creado", beneficiary_id)

    listing = api("GET", "/beneficiaries").body
    print(len(listing["data"]), "beneficiarios")

    api("PUT", f"/beneficiaries/{beneficiary_id}", body={"label": "Proveedor de ejemplo (con otro nombre)"})
    print("Actualizado", beneficiary_id)

    api("DELETE", f"/beneficiaries/{beneficiary_id}")
    print("Eliminado", beneficiary_id)


run(main)
