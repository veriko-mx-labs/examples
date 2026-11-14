#!/usr/bin/env python3
"""Valida una transferencia SPEI por sus campos y espera el veredicto en la misma petición.

    VERIKO_API_KEY=veriko_... python3 python/raw/validate.py

Cada validación aceptada consume cuota, también la que termina en `not_found`.
La transferencia de abajo es de ejemplo: no existe en Banxico, así que espera `not_found`.
Cámbiala por una transferencia real para obtener `valid`.
"""
# veriko:operation POST /validate body=send_date,amount,tracking_key,sender_bank,beneficiary_account
# veriko:operation GET /validations/{id}
from client import SYNC_TIMEOUT, api, poll_validation, run


def main() -> None:
    response = api("POST", "/validate", timeout=SYNC_TIMEOUT, body={
        "send_date": "2025-03-15",
        "amount": 15000.50,
        "tracking_key": "MXBA20250315001234",
        "sender_bank": "40012",  # clave SPEI o nombre del banco
        "beneficiary_account": "012180004412345678",
    })

    validation = response.body
    if response.status == 202:
        # Banxico tardó más de 45 s: la validación sigue en segundo plano.
        print(f"Sigue en {validation['data']['attributes']['status']} ({validation['meta']['async_reason']}); sondeando.")
        validation = poll_validation(validation["data"]["id"], validation["data"]["attributes"].get("expires_at"))

    data = validation["data"]
    print(data["id"], data["attributes"]["status"])
    if (data.get("links") or {}).get("cep_pdf"):
        print("CEP disponible:", data["links"]["cep_pdf"])


run(main)
