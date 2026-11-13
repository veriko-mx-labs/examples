#!/usr/bin/env python3
"""Download the CEP of a validation as a PDF or an XML file.

    VERIKO_API_KEY=veriko_... python3 python/raw/download_cep.py <validation id> [pdf|xml]

The CEP exists only when the validation is `valid` or `returned`. Otherwise the API answers 404
`cep_not_available`. A validation that was purged answers 410 and an unknown format, 400
`invalid_export_format`.
"""
# veriko:operation GET /validations/{id}/cep query=format
import sys

from client import ApiError, api, run


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Usage: download_cep.py <validation id> [pdf|xml]")
    validation_id = sys.argv[1]
    cep_format = sys.argv[2] if len(sys.argv) > 2 else "pdf"

    try:
        response = api("GET", f"/validations/{validation_id}/cep", query={"format": cep_format}, binary=True)
    except ApiError as error:
        if error.code == "cep_not_available":
            sys.exit("Banxico has no CEP for this validation (yet).")
        raise
    path = f"cep-{validation_id}.{cep_format}"
    with open(path, "wb") as file:
        file.write(response.body)
    print(f"Saved {path} ({response.headers.get('Content-Type')}, {len(response.body)} bytes)")


run(main)
