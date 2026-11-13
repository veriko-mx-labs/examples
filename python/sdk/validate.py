#!/usr/bin/env python3
"""Validate a SPEI transfer by its fields with the Python SDK.

    pip install -r python/sdk/requirements.txt
    VERIKO_API_KEY=veriko_... python3 python/sdk/validate.py

The client reads VERIKO_API_KEY from the environment. Every accepted validation consumes
quota. The transfer is example data that does not exist at Banxico: expect `not_found`.
"""
# veriko:operation POST /validate
import sys

from veriko import Veriko

client = Veriko()

try:
    validation = client.validations.validate(
        send_date="2025-03-15",
        amount=15000.50,
        tracking_key="MXBA20250315001234",
        sender_bank="40012",
        beneficiary_account="012180004412345678",
        idempotency_key="example-order-4812",  # derive it from your own order identifier
    )
except Exception as error:  # the SDK raises its own error types; print and exit non-zero
    sys.exit(f"{type(error).__name__}: {error}")

print(validation.id, validation.status)
