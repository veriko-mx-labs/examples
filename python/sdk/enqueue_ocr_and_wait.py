#!/usr/bin/env python3
"""Pone en cola la validación de un comprobante y espera el veredicto con el SDK de Python.

    pip install -r python/sdk/requirements.txt
    VERIKO_API_KEY=veriko_... python3 python/sdk/enqueue_ocr_and_wait.py ruta/al/comprobante.png

`enqueue_ocr` envía `POST /validate-ocr?async=1`. Cada validación aceptada consume cuota.
"""
# veriko:operation POST /validate-ocr?async=1 query=async
# veriko:operation GET /validations/{id}
import sys

from veriko import Veriko

if len(sys.argv) < 2:
    sys.exit("Uso: enqueue_ocr_and_wait.py <archivo del comprobante>")

client = Veriko()

try:
    queued = client.validations.enqueue_ocr(image=sys.argv[1])
    validation = client.validations.wait_for(queued.id, timeout=120)
except Exception as error:
    sys.exit(f"{type(error).__name__}: {error}")

print(validation.id, validation.status)
