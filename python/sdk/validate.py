#!/usr/bin/env python3
"""Valida una transferencia SPEI por sus campos con el SDK de Python.

    pip install -r python/sdk/requirements.txt
    VERIKO_API_KEY=veriko_... python3 python/sdk/validate.py

El cliente lee VERIKO_API_KEY del entorno. Cada validación aceptada consume cuota. La
transferencia es de ejemplo y no existe en Banxico: espera `not_found`.
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
        idempotency_key="pedido-ejemplo-4812",  # derívala de tu propio identificador de pedido
    )
except Exception as error:  # el SDK lanza sus propios tipos de error; se imprime y se termina con un código distinto de cero
    sys.exit(f"{type(error).__name__}: {error}")

print(validation.id, validation.status)
