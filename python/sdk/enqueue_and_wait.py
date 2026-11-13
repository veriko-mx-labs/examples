#!/usr/bin/env python3
"""Enqueue a validation by its fields and wait for the verdict with the Python SDK.

    pip install -r python/sdk/requirements.txt
    VERIKO_API_KEY=veriko_... python3 python/sdk/enqueue_and_wait.py

`enqueue` sends `?async=1`. `wait_for` polls with the ETag until the verdict is final and raises
`TimeoutError` when `timeout` runs out. Every accepted validation consumes quota. The transfer
is example data: expect `not_found`.
"""
# veriko:operation POST /validate?async=1 query=async
# veriko:operation GET /validations/{id}
import sys

from veriko import Veriko

client = Veriko()

try:
    queued = client.validations.enqueue(
        send_date="2025-03-15",
        amount=15000.50,
        tracking_key="MXBA20250315001234",
        sender_bank="40012",
        beneficiary_account="012180004412345678",
        idempotency_key="example-order-4813",
    )
    validation = client.validations.wait_for(queued.id, timeout=120)
except Exception as error:
    sys.exit(f"{type(error).__name__}: {error}")

print(validation.id, validation.status)
