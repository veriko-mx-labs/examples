#!/usr/bin/env python3
"""Descarga el CEP de una validación como archivo PDF o XML.

    VERIKO_API_KEY=veriko_... python3 python/raw/download_cep.py <id de la validación> [pdf|xml]

El CEP existe sólo cuando la validación es `valid` o `returned`. En otro caso la API responde 404
`cep_not_available`. Una validación purgada responde 410 y un formato desconocido, 400
`invalid_export_format`.
"""
# veriko:operation GET /validations/{id}/cep query=format
import sys

from client import ApiError, api, run


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Uso: download_cep.py <id de la validación> [pdf|xml]")
    validation_id = sys.argv[1]
    cep_format = sys.argv[2] if len(sys.argv) > 2 else "pdf"

    try:
        response = api("GET", f"/validations/{validation_id}/cep", query={"format": cep_format}, binary=True)
    except ApiError as error:
        if error.code == "cep_not_available":
            sys.exit("Banxico todavía no tiene CEP para esta validación.")
        raise
    path = f"cep-{validation_id}.{cep_format}"
    with open(path, "wb") as file:
        file.write(response.body)
    print(f"Guardado {path} ({response.headers.get('Content-Type')}, {len(response.body)} bytes)")


run(main)
