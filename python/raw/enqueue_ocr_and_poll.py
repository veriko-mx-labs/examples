#!/usr/bin/env python3
"""Enqueue a validation from a receipt (`POST /validate-ocr?async=1`) and poll until it is final.

    VERIKO_API_KEY=veriko_... python3 python/raw/enqueue_ocr_and_poll.py path/to/receipt.png

The argument is a local file or an HTTPS URL. With several `candidate_accounts` the validation
still consumes a single unit of quota. Every accepted validation consumes quota, and a receipt
that cannot be read is charged too.
"""
# veriko:operation POST /validate-ocr?async=1 query=async body=image,image_url,candidate_accounts,client_ref
# veriko:operation GET /validations/{id}
import base64
import sys

from client import api, poll_validation, run


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Usage: enqueue_ocr_and_poll.py <receipt file or https URL>")
    source = sys.argv[1]

    if source.startswith("https://"):
        body = {"image_url": source}
    else:
        with open(source, "rb") as file:
            body = {"image": base64.b64encode(file.read()).decode("ascii")}
    body["client_ref"] = "example-receipt-1"
    # When the receipt does not show the account, send the candidates instead (example values):
    # body["candidate_accounts"] = ["012180004412345678", "002010077777777771"]

    queued = api("POST", "/validate-ocr", query={"async": 1}, body=body).body
    data = queued["data"]
    print("Queued", data["id"])

    validation = poll_validation(data["id"], data["attributes"].get("expires_at"))
    print(data["id"], validation["data"]["attributes"]["status"])


run(main)
