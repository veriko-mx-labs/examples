#!/usr/bin/env python3
"""Retry a validation safely: one `Idempotency-Key` per business attempt, backoff on transient failures.

    VERIKO_API_KEY=veriko_... python3 python/raw/idempotency_and_retry.py

The key identifies the attempt, so derive it from your own identifier (here an order number),
never from a random value per send. The API stores it for 24 hours:
  - same key, same body: the original response comes back with `Idempotent-Replayed: true`;
  - same key, different body: 422 `idempotency_key_reused`;
  - same key while the first request runs: 409 `idempotency_key_in_progress`.
`with_retry` repeats the request on 408, 429, 500, 502, 503, 504 and on network failures,
waiting `Retry-After` when present. It never retries `quota_exceeded`: that 429 lasts until
the plan renews.
The second call below replays the first: it consumes no additional quota. The transfer is
example data: expect `not_found`.
"""
# veriko:operation POST /validate headers=Idempotency-Key body=send_date,amount,tracking_key,sender_bank,beneficiary_account
# veriko:operation GET /validations/{id}
from client import SYNC_TIMEOUT, api, poll_validation, run, with_retry

IDEMPOTENCY_KEY = "example-order-4812-attempt-1"


def send():
    return api("POST", "/validate", timeout=SYNC_TIMEOUT, headers={"Idempotency-Key": IDEMPOTENCY_KEY}, body={
        "send_date": "2025-03-15",
        "amount": 15000.50,
        "tracking_key": "MXBA20250315001234",
        "sender_bank": "40012",
        "beneficiary_account": "012180004412345678",
    })


def main() -> None:
    for attempt in (1, 2):
        response = with_retry(send)
        replayed = response.headers.get("Idempotent-Replayed") == "true"
        validation = response.body
        if response.status == 202:
            validation = poll_validation(validation["data"]["id"], validation["data"]["attributes"].get("expires_at"))
        print(f"Call {attempt}: {validation['data']['id']} {validation['data']['attributes']['status']} replayed={str(replayed).lower()}")


run(main)
