#!/usr/bin/env python3
"""Handle API errors: check the HTTP status first, branch on `errors[].code`, show `detail` and `hint`.

    VERIKO_API_KEY=veriko_... python3 python/raw/error_handling.py

This script sends an invalid request on purpose (a `422`). The API rejects it before it
reaches Banxico, so it consumes no quota.
Branch on `code`: it is stable and never translated. `detail` changes with the
`Accept-Language` header and may be reworded, so show it but do not compare it.
"""
# veriko:operation POST /validate body=amount,beneficiary_account
import sys

from client import SYNC_TIMEOUT, ApiError, api, run


def main() -> None:
    try:
        # Neither `tracking_key` nor `numeric_reference`: the API cannot look the payment up.
        api("POST", "/validate", timeout=SYNC_TIMEOUT, body={"amount": 100, "beneficiary_account": "012180004412345678"})
    except ApiError as error:
        # A 422 lists a summary entry and then one entry per invalid field: read the whole list.
        for entry in error.errors:
            pointer = (entry.get("source") or {}).get("pointer")
            print(f"{entry['code']}{f' at {pointer}' if pointer else ''}: {entry['detail']}")
        if error.code == "quota_exceeded":
            print("The plan quota is spent. Do not retry; upgrade the plan or wait for the renewal.")
        elif error.code == "rate_limit_exceeded":
            print(f"Rate limited. Retry after {error.retry_after or 60:.0f} s.")
        else:
            print(f"Request {error.request_id or 'unknown'} failed with HTTP {error.status}.")
        sys.exit(1)


run(main)
