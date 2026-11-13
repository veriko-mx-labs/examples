#!/usr/bin/env python3
"""Receive Veriko webhooks with the Python SDK: verify the timestamped signature and accept the old
secret during a rotation.

    pip install -r python/sdk/requirements.txt
    VERIKO_WEBHOOK_SECRET=<secret from POST /webhooks> python3 python/sdk/webhook_receiver.py

VERIKO_WEBHOOK_SECRET_PREVIOUS is optional: set it for the 24 hours after you regenerate the
secret. `verify_webhook_timestamped` rejects a `t` more than 5 minutes (300 s) from this machine's
clock and compares in constant time. Pass the raw body, not re-serialized JSON.
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
    sys.exit("Set VERIKO_WEBHOOK_SECRET to the secret returned when you registered the endpoint.")


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
        self.send_response(200)  # answer first, process afterwards
        self.end_headers()
        event = json.loads(raw_body)
        print(event["event"], event["data"]["id"], event["data"]["attributes"]["status"], flush=True)


if __name__ == "__main__":
    print("Listening for webhooks", flush=True)
    HTTPServer(("", int(os.environ.get("PORT", 3000))), Handler).serve_forever()
