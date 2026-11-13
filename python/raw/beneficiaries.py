#!/usr/bin/env python3
"""Create, list, update and delete a saved beneficiary account.

    VERIKO_API_KEY=veriko_... python3 python/raw/beneficiaries.py

A beneficiary helps the receipt validation complete an account the image shows masked. The
account below is example data; deleting archives the beneficiary. Beneficiary calls consume no
quota.
"""
# veriko:operation POST /beneficiaries body=account_number,bank_code,label
# veriko:operation GET /beneficiaries
# veriko:operation PUT /beneficiaries/{id} body=label
# veriko:operation DELETE /beneficiaries/{id}
from client import api, run


def main() -> None:
    created = api("POST", "/beneficiaries", body={
        "account_number": "012180004412345678", "bank_code": "40012", "label": "Example supplier"}).body
    beneficiary_id = created["data"]["id"]
    print("Created", beneficiary_id)

    listing = api("GET", "/beneficiaries").body
    print(len(listing["data"]), "beneficiaries")

    api("PUT", f"/beneficiaries/{beneficiary_id}", body={"label": "Example supplier (renamed)"})
    print("Updated", beneficiary_id)

    api("DELETE", f"/beneficiaries/{beneficiary_id}")
    print("Deleted", beneficiary_id)


run(main)
