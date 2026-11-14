#!/usr/bin/env python3
"""Valida una transferencia SPEI a partir de su comprobante: una imagen o un PDF de 1 a 3 páginas.

    VERIKO_API_KEY=veriko_... python3 python/raw/validate_ocr.py ruta/al/comprobante.png
    VERIKO_API_KEY=veriko_... python3 python/raw/validate_ocr.py https://example.com/comprobante.png

El argumento es un archivo local (se envía en base64) o una URL HTTPS (se envía como `image_url`).
Cada validación aceptada consume cuota. Un comprobante que no se puede leer o que no es de SPEI
se rechaza con 422 (`image_not_readable_receipt`, `image_not_spei_receipt`) y
la validación se cobra de todos modos.
"""
# veriko:operation POST /validate-ocr body=image,image_url,beneficiary_account
# veriko:operation GET /validations/{id}
import base64
import sys

from client import SYNC_TIMEOUT, api, poll_validation, run


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Uso: validate_ocr.py <archivo del comprobante o URL https>")
    source = sys.argv[1]

    if source.startswith("https://"):
        body = {"image_url": source}
    else:
        with open(source, "rb") as file:
            body = {"image": base64.b64encode(file.read()).decode("ascii")}
    # Envía la cuenta cuando el comprobante la oculta o la muestra incompleta (valor de ejemplo):
    # body["beneficiary_account"] = "012180004412345678"

    response = api("POST", "/validate-ocr", timeout=SYNC_TIMEOUT, body=body)

    validation = response.body
    if response.status == 202:
        validation = poll_validation(validation["data"]["id"], validation["data"]["attributes"].get("expires_at"))
    print(validation["data"]["id"], validation["data"]["attributes"]["status"])


run(main)
