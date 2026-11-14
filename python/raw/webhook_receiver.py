#!/usr/bin/env python3
"""Recibe los webhooks de Veriko: verifica la firma con marca de tiempo, rechaza las entregas vencidas y descarta las repetidas.

    VERIKO_WEBHOOK_SECRET=<secreto de POST /webhooks> python3 python/raw/webhook_receiver.py

Opcional: VERIKO_WEBHOOK_SECRET_PREVIOUS mantiene el receptor funcionando durante las 24 horas
posteriores a rotar el secreto, porque la API envía entonces también `X-Webhook-Signature-Old`,
firmada con el secreto anterior. PORT es 3000 por defecto.

La firma cubre el cuerpo tal como llegó, así que el receptor lee los bytes sin procesar y
analiza el JSON hasta después de la verificación. `t` debe estar a menos de 5 minutos del reloj
de esta máquina: la ventana aplica a `t`, la hora de ese intento, y no al `timestamp` del
cuerpo, porque un reintento llega hasta unas 8.6 horas después del evento con un `t` nuevo.
"""
# veriko:receiver
import hashlib
import hmac
import json
import os
import re
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = os.environ.get("VERIKO_WEBHOOK_SECRET")
PREVIOUS_SECRET = os.environ.get("VERIKO_WEBHOOK_SECRET_PREVIOUS")
TOLERANCE_SECONDS = 300
seen = set()  # en producción usa un almacén compartido con vencimiento de 24 horas

if not SECRET:
    sys.exit("Define VERIKO_WEBHOOK_SECRET con el secreto que recibiste al registrar el endpoint.")


def verify_timestamped(raw_body: bytes, header: str, secret: str) -> bool:
    """`header` es `t=<segundos>,v1=<hex>`. Devuelve True cuando `v1` coincide con el HMAC-SHA256 de `<t>.<cuerpo>`
    y `t` está dentro de la ventana de tolerancia."""
    if not header:
        return False
    fields = dict(part.strip().split("=", 1) for part in header.split(",") if "=" in part)
    if not re.fullmatch(r"\d{1,15}", fields.get("t", "")):
        return False
    timestamp = fields["t"]
    if abs(time.time() - int(timestamp)) > TOLERANCE_SECONDS:
        return False
    expected = hmac.new(secret.encode(), timestamp.encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(fields.get("v1", "").lower().encode(), expected.encode())


def is_authentic(raw_body: bytes, headers) -> bool:
    if verify_timestamped(raw_body, headers.get("X-Webhook-Signature-Timestamped", ""), SECRET):
        return True
    # Durante una rotación, una entrega que quedó en cola antes del cambio lleva la firma anterior.
    return PREVIOUS_SECRET is not None and verify_timestamped(
        raw_body, headers.get("X-Webhook-Signature-Old", ""), PREVIOUS_SECRET)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        raw_body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not is_authentic(raw_body, self.headers):
            self.send_response(401)  # un 4xx distinto de 408 y 429 no se reintenta
            self.end_headers()
            return

        # Responde 2xx primero y procesa después: quien envía espera 10 segundos como máximo.
        self.send_response(200)
        self.end_headers()

        delivery_id = self.headers.get("X-Veriko-Delivery-Id")
        if delivery_id and delivery_id in seen:
            return  # es un reintento de una entrega que ya se atendió
        if delivery_id:
            seen.add(delivery_id)

        event = json.loads(raw_body)
        attributes = event["data"]["attributes"]
        print(event["event"], event["data"]["id"], f"status={attributes['status']}",
              f"client_ref={attributes.get('client_ref', '-')}", flush=True)
        # Antes de entregar la mercancía con `valid`, compara `attributes["banxico_confirmed"]` (monto,
        # cuenta) con tu pedido.


if __name__ == "__main__":
    print("Escuchando webhooks", flush=True)
    HTTPServer(("", int(os.environ.get("PORT", 3000))), Handler).serve_forever()
