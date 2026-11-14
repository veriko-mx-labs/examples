#!/usr/bin/env python3
"""Valida una transferencia SPEI a partir de la imagen o el PDF de un comprobante con el SDK de Python.

    pip install -r python/sdk/requirements.txt
    VERIKO_API_KEY=veriko_... python3 python/sdk/validate_ocr.py ruta/al/comprobante.png

El SDK lee el archivo y lo envía en base64. Cada validación aceptada consume cuota, y un
comprobante que no se puede leer también se cobra.
"""
# veriko:operation POST /validate-ocr
import sys

from veriko import Veriko

if len(sys.argv) < 2:
    sys.exit("Uso: validate_ocr.py <archivo del comprobante>")

client = Veriko()

try:
    validation = client.validations.validate_ocr(image=sys.argv[1])
except Exception as error:
    sys.exit(f"{type(error).__name__}: {error}")

print(validation.id, validation.status)
