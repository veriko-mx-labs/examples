#!/usr/bin/env python3
"""Pone en cola una validación por sus campos y espera el veredicto con el SDK de Python.

    pip install -r python/sdk/requirements.txt
    VERIKO_API_KEY=veriko_... python3 python/sdk/enqueue_and_wait.py

`enqueue` envía `?async=1`. `wait_for` sondea con el ETag hasta que el veredicto sea final y lanza
`TimeoutError` cuando se agota `timeout`. Cada validación aceptada consume cuota. La
transferencia es de ejemplo: espera `not_found`.
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
        idempotency_key="pedido-ejemplo-4813",
    )
    validation = client.validations.wait_for(queued.id, timeout=120)
except Exception as error:
    sys.exit(f"{type(error).__name__}: {error}")

print(validation.id, validation.status)
