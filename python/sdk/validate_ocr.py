#!/usr/bin/env python3
"""Validate a SPEI transfer from a receipt image or PDF with the Python SDK.

    pip install -r python/sdk/requirements.txt
    VERIKO_API_KEY=veriko_... python3 python/sdk/validate_ocr.py path/to/receipt.png

The SDK reads the file and sends it as base64. Every accepted validation consumes quota, and a
receipt that cannot be read is charged too.
"""
# veriko:operation POST /validate-ocr
import sys

from veriko import Veriko

if len(sys.argv) < 2:
    sys.exit("Usage: validate_ocr.py <receipt file>")

client = Veriko()

try:
    validation = client.validations.validate_ocr(image=sys.argv[1])
except Exception as error:
    sys.exit(f"{type(error).__name__}: {error}")

print(validation.id, validation.status)
