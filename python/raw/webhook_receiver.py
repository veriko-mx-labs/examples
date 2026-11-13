#!/usr/bin/env python3
"""Receive Veriko webhooks: verify the timestamped signature, reject stale deliveries, deduplicate.

    VERIKO_WEBHOOK_SECRET=<secret from POST /webhooks> python3 python/raw/webhook_receiver.py

Optional: VERIKO_WEBHOOK_SECRET_PREVIOUS keeps the receiver working for the 24 hours after you
rotate the secret, because the API then also sends `X-Webhook-Signature-Old`, signed with the
previous secret. PORT defaults to 3000.

The signature covers the body exactly as received, so the receiver reads the raw bytes and
parses the JSON only after the check. `t` must be within 5 minutes of this machine's clock:
the window applies to `t`, the time of that attempt, not to the `timestamp` in the body,
because a retry arrives up to about 8.6 hours after the event with a new `t`.
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
seen = set()  # use a shared store with a 24-hour expiry in production

if not SECRET:
    sys.exit("Set VERIKO_WEBHOOK_SECRET to the secret returned when you registered the endpoint.")


def verify_timestamped(raw_body: bytes, header: str, secret: str) -> bool:
    """`header` is `t=<seconds>,v1=<hex>`. True when `v1` matches HMAC-SHA256 of `<t>.<body>`
    and `t` is inside the tolerance window."""
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
    # During a rotation, a delivery queued before the change carries the old signature.
    return PREVIOUS_SECRET is not None and verify_timestamped(
        raw_body, headers.get("X-Webhook-Signature-Old", ""), PREVIOUS_SECRET)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        raw_body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not is_authentic(raw_body, self.headers):
            self.send_response(401)  # a 4xx other than 408 and 429 is not retried
            self.end_headers()
            return

        # Answer 2xx first, process afterwards: the sender waits 10 seconds at most.
        self.send_response(200)
        self.end_headers()

        delivery_id = self.headers.get("X-Veriko-Delivery-Id")
        if delivery_id and delivery_id in seen:
            return  # a retry of a delivery already handled
        if delivery_id:
            seen.add(delivery_id)

        event = json.loads(raw_body)
        attributes = event["data"]["attributes"]
        print(event["event"], event["data"]["id"], f"status={attributes['status']}",
              f"client_ref={attributes.get('client_ref', '-')}", flush=True)
        # Before releasing goods on `valid`, compare `attributes["banxico_confirmed"]` (amount,
        # account) with your order.


if __name__ == "__main__":
    print("Listening for webhooks", flush=True)
    HTTPServer(("", int(os.environ.get("PORT", 3000))), Handler).serve_forever()
