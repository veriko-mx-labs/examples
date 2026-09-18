#!/usr/bin/env python3
"""Valida una transferencia SPEI con los datos exactos (sin OCR de imagen).

Requiere: VERIKO_API_KEY en el entorno, y el paquete `requests` (pip install requests).
Referencia completa: https://docs.veriko.mx/openapi.yaml
Uso: VERIKO_API_KEY=veriko_... python validate.py
"""
import os
import sys

import requests

api_key = os.environ.get("VERIKO_API_KEY")
if not api_key:
    print("Falta la variable de entorno VERIKO_API_KEY (empieza con veriko_).", file=sys.stderr)
    sys.exit(1)

res = requests.post(
    "https://api.veriko.mx/v1/validate",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "fecha": "2025-03-15",
        "monto": 15000.50,
        "clave_rastreo": "MXBA20250315001234",
        "cuenta_beneficiaria": "012180004412345678",
    },
    timeout=30,
)

body = res.json()
if not res.ok:
    print(f"HTTP {res.status_code}: {body.get('errors', body)}", file=sys.stderr)
    sys.exit(1)

print(body["data"]["attributes"]["status"])  # "valid"
