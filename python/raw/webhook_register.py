#!/usr/bin/env python3
"""Register a webhook endpoint, send a test delivery and show its delivery history.

    VERIKO_API_KEY=veriko_... python3 python/raw/webhook_register.py https://example.com/hooks/veriko [--delete]

The URL must be a public HTTPS address that answers 2xx: run `webhook_receiver.py` behind a
tunnel while you try it. The response carries the signing `secret` once; store it
as VERIKO_WEBHOOK_SECRET for the receiver. The endpoint subscribes to all seven validation
events, so `validation.returned` reports a later return.
"""
# veriko:operation POST /webhooks body=url,events,description
# veriko:operation POST /webhooks/{id}/test
# veriko:operation GET /webhooks/{id}/deliveries query=per_page
# veriko:operation DELETE /webhooks/{id}
import sys

from client import api, run


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Usage: webhook_register.py <public https URL> [--delete]")

    created = api("POST", "/webhooks", body={
        "url": sys.argv[1],
        "description": "Example endpoint",
        "events": [
            "validation.completed",
            "validation.failed",
            "validation.error",
            "validation.returned",
            "validation.retry.scheduled",
            "validation.retry.resolved",
            "validation.retry.exhausted",
        ],
    }).body["data"]
    endpoint_id = created["id"]
    print("Endpoint", endpoint_id)
    print("Secret (shown once):", created["attributes"]["secret"])

    # The test returns 200 even when delivery failed: check `delivered`.
    result = api("POST", f"/webhooks/{endpoint_id}/test").body["data"]["attributes"]
    print(f"Test delivered={str(result['delivered']).lower()} http_status={result.get('http_status')} {result.get('error') or ''}")

    deliveries = api("GET", f"/webhooks/{endpoint_id}/deliveries", query={"per_page": 5}).body["data"]
    for delivery in deliveries:
        print(delivery["id"], delivery["attributes"]["status"])

    if "--delete" in sys.argv:
        api("DELETE", f"/webhooks/{endpoint_id}")
        print("Deleted", endpoint_id)


run(main)
