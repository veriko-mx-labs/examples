#!/usr/bin/env python3
"""Validate a SPEI transfer from its receipt: an image or a PDF of 1 to 3 pages.

    VERIKO_API_KEY=veriko_... python3 python/raw/validate_ocr.py path/to/receipt.png
    VERIKO_API_KEY=veriko_... python3 python/raw/validate_ocr.py https://example.com/receipt.png

The argument is a local file (sent as base64) or an HTTPS URL (sent as `image_url`).
Every accepted validation consumes quota. A receipt that is unreadable or is not a SPEI
receipt is rejected with 422 (`image_not_readable_receipt`, `image_not_spei_receipt`) and
the validation is still charged.
"""
# veriko:operation POST /validate-ocr body=image,image_url,beneficiary_account
# veriko:operation GET /validations/{id}
import base64
import sys

from client import SYNC_TIMEOUT, api, poll_validation, run


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Usage: validate_ocr.py <receipt file or https URL>")
    source = sys.argv[1]

    if source.startswith("https://"):
        body = {"image_url": source}
    else:
        with open(source, "rb") as file:
            body = {"image": base64.b64encode(file.read()).decode("ascii")}
    # Send the account when the receipt hides it or shows it incomplete (example value):
    # body["beneficiary_account"] = "012180004412345678"

    response = api("POST", "/validate-ocr", timeout=SYNC_TIMEOUT, body=body)

    validation = response.body
    if response.status == 202:
        validation = poll_validation(validation["data"]["id"], validation["data"]["attributes"].get("expires_at"))
    print(validation["data"]["id"], validation["data"]["attributes"]["status"])


run(main)
