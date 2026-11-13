#!/usr/bin/env python3
"""Validate a SPEI transfer by its fields, waiting for the verdict in the same request.

    VERIKO_API_KEY=veriko_... python3 python/raw/validate.py

Every accepted validation consumes quota, including one that ends in `not_found`.
The transfer below is example data: it does not exist at Banxico, so expect `not_found`.
Replace it with a real transfer to get `valid`.
"""
# veriko:operation POST /validate body=send_date,amount,tracking_key,sender_bank,beneficiary_account
# veriko:operation GET /validations/{id}
from client import SYNC_TIMEOUT, api, poll_validation, run


def main() -> None:
    response = api("POST", "/validate", timeout=SYNC_TIMEOUT, body={
        "send_date": "2025-03-15",
        "amount": 15000.50,
        "tracking_key": "MXBA20250315001234",
        "sender_bank": "40012",  # SPEI code or bank name
        "beneficiary_account": "012180004412345678",
    })

    validation = response.body
    if response.status == 202:
        # Banxico took longer than 45 s: the validation continues in the background.
        print(f"Still {validation['data']['attributes']['status']} ({validation['meta']['async_reason']}); polling.")
        validation = poll_validation(validation["data"]["id"], validation["data"]["attributes"].get("expires_at"))

    data = validation["data"]
    print(data["id"], data["attributes"]["status"])
    if (data.get("links") or {}).get("cep_pdf"):
        print("CEP available:", data["links"]["cep_pdf"])


run(main)
