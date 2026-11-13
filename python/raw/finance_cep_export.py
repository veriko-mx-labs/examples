#!/usr/bin/env python3
"""Export the CEP files of a date range as a ZIP, built in the background.

    VERIKO_API_KEY=veriko_... python3 python/raw/finance_cep_export.py 2025-03-01 2025-03-31

The request answers 202 with an export in `queued`. Poll it until the status is `ready`, `failed` or
`expired`, then download the ZIP. The file expires 24 hours after it is ready. The
`Idempotency-Key` makes a repeated request reuse the same export.
"""
# veriko:operation POST /finance/ceps/exports headers=Idempotency-Key body=from,to
# veriko:operation GET /finance/ceps/exports/{id}
# veriko:operation GET /finance/ceps/exports/{id}/download
import sys
import time

from client import api, run, with_retry

CEP_EXPORT_TERMINAL_STATUSES = frozenset({"ready", "failed", "expired"})


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("Usage: finance_cep_export.py <from YYYY-MM-DD> <to YYYY-MM-DD>")
    date_from, date_to = sys.argv[1], sys.argv[2]

    created = with_retry(lambda: api("POST", "/finance/ceps/exports",
                                     headers={"Idempotency-Key": f"example-cep-export-{date_from}-{date_to}"},
                                     body={"from": date_from, "to": date_to})).body
    export_id = created["data"]["id"]

    while True:
        attributes = with_retry(lambda: api("GET", f"/finance/ceps/exports/{export_id}")).body["data"]["attributes"]
        if attributes["status"] in CEP_EXPORT_TERMINAL_STATUSES:
            if attributes["status"] != "ready":
                sys.exit(f"Export {export_id} ended as {attributes['status']} {attributes.get('error_code') or ''}")
            break
        print(f"Export {export_id}: {attributes['status']}", file=sys.stderr)
        time.sleep(5)

    archive = api("GET", f"/finance/ceps/exports/{export_id}/download", binary=True, timeout=120)
    path = f"ceps-{date_from}-{date_to}.zip"
    with open(path, "wb") as file:
        file.write(archive.body)
    print("Saved", path)


run(main)
