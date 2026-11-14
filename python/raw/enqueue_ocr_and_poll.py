#!/usr/bin/env python3
"""Pone en cola la validación de un comprobante (`POST /validate-ocr?async=1`) y sondea hasta que sea final.

    VERIKO_API_KEY=veriko_... python3 python/raw/enqueue_ocr_and_poll.py ruta/al/comprobante.png

El argumento es un archivo local o una URL HTTPS. Con varias `candidate_accounts`, la validación
sigue consumiendo una sola unidad de cuota. Cada validación aceptada consume cuota, y un
comprobante que no se puede leer también se cobra.
"""
# veriko:operation POST /validate-ocr?async=1 query=async body=image,image_url,candidate_accounts,client_ref
# veriko:operation GET /validations/{id}
import base64
import sys

from client import api, poll_validation, run


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Uso: enqueue_ocr_and_poll.py <archivo del comprobante o URL https>")
    source = sys.argv[1]

    if source.startswith("https://"):
        body = {"image_url": source}
    else:
        with open(source, "rb") as file:
            body = {"image": base64.b64encode(file.read()).decode("ascii")}
    body["client_ref"] = "comprobante-ejemplo-1"
    # Cuando el comprobante no muestra la cuenta, envía las candidatas (valores de ejemplo):
    # body["candidate_accounts"] = ["012180004412345678", "002010077777777771"]

    queued = api("POST", "/validate-ocr", query={"async": 1}, body=body).body
    data = queued["data"]
    print("En cola", data["id"])

    validation = poll_validation(data["id"], data["attributes"].get("expires_at"))
    print(data["id"], validation["data"]["attributes"]["status"])


run(main)
