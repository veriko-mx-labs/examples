#!/usr/bin/env python3
"""Enqueue a validation from a receipt and wait for the verdict with the Python SDK.

    pip install -r python/sdk/requirements.txt
    VERIKO_API_KEY=veriko_... python3 python/sdk/enqueue_ocr_and_wait.py path/to/receipt.png

`enqueue_ocr` sends `POST /validate-ocr?async=1`. Every accepted validation consumes quota.
"""
# veriko:operation POST /validate-ocr?async=1 query=async
# veriko:operation GET /validations/{id}
import sys

from veriko import Veriko

if len(sys.argv) < 2:
    sys.exit("Usage: enqueue_ocr_and_wait.py <receipt file>")

client = Veriko()

try:
    queued = client.validations.enqueue_ocr(image=sys.argv[1])
    validation = client.validations.wait_for(queued.id, timeout=120)
except Exception as error:
    sys.exit(f"{type(error).__name__}: {error}")

print(validation.id, validation.status)
