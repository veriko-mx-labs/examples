#!/usr/bin/env python3
"""Recibe los webhooks de Veriko con el SDK de Python: verifica la firma con marca de tiempo y acepta
el secreto anterior durante una rotación.

    pip install -r python/sdk/requirements.txt
    VERIKO_WEBHOOK_SECRET=<secreto de POST /webhooks> python3 python/sdk/webhook_receiver.py

VERIKO_WEBHOOK_SECRET_PREVIOUS es opcional: defínela durante las 24 horas posteriores a regenerar
el secreto. `verify_webhook_timestamped` rechaza un `t` a más de 5 minutos (300 s) del reloj de esta
máquina y compara en tiempo constante. Pásale el cuerpo sin procesar, no un JSON serializado de nuevo.
"""
# veriko:receiver
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

from veriko.webhooks import verify_webhook_timestamped

SECRET = os.environ.get("VERIKO_WEBHOOK_SECRET")
PREVIOUS_SECRET = os.environ.get("VERIKO_WEBHOOK_SECRET_PREVIOUS")
if not SECRET:
    sys.exit("Define VERIKO_WEBHOOK_SECRET con el secreto que recibiste al registrar el endpoint.")


def is_authentic(raw_body: bytes, headers) -> bool:
    if verify_webhook_timestamped(raw_body, headers.get("X-Webhook-Signature-Timestamped"), SECRET, tolerance=300):
        return True
    return PREVIOUS_SECRET is not None and verify_webhook_timestamped(
        raw_body, headers.get("X-Webhook-Signature-Old"), PREVIOUS_SECRET, tolerance=300)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        raw_body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not is_authentic(raw_body, self.headers):
            self.send_response(401)
            self.end_headers()
            return
        self.send_response(200)  # responde primero y procesa después
        self.end_headers()
        event = json.loads(raw_body)
        print(event["event"], event["data"]["id"], event["data"]["attributes"]["status"], flush=True)


if __name__ == "__main__":
    print("Escuchando webhooks", flush=True)
    HTTPServer(("", int(os.environ.get("PORT", 3000))), Handler).serve_forever()
