#!/usr/bin/env python3
"""Export the validation history as a CSV file.

    VERIKO_API_KEY=veriko_... python3 python/raw/export_validations.py

`format` accepts `csv` and `xlsx` (default `csv`). The response is a file attachment; an
error comes back as JSON. Exporting consumes no quota.
"""
# veriko:operation GET /validations/export query=format,from,to,limit
from client import api, run, with_retry


def main() -> None:
    response = with_retry(lambda: api("GET", "/validations/export", binary=True, timeout=120, query={
        "format": "csv", "from": "2025-01-01", "to": "2025-12-31", "limit": 1000}))
    with open("validations.csv", "wb") as file:
        file.write(response.body)
    print(f"Saved validations.csv ({len(response.body)} bytes)")


run(main)
