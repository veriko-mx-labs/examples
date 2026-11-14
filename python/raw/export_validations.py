#!/usr/bin/env python3
"""Exporta el historial de validaciones como un archivo CSV.

    VERIKO_API_KEY=veriko_... python3 python/raw/export_validations.py

`format` acepta `csv` y `xlsx` (`csv` por defecto). La respuesta es un archivo adjunto; un
error llega como JSON. Exportar no consume cuota.
"""
# veriko:operation GET /validations/export query=format,from,to,limit
from client import api, run, with_retry


def main() -> None:
    response = with_retry(lambda: api("GET", "/validations/export", binary=True, timeout=120, query={
        "format": "csv", "from": "2025-01-01", "to": "2025-12-31", "limit": 1000}))
    with open("validations.csv", "wb") as file:
        file.write(response.body)
    print(f"Guardado validations.csv ({len(response.body)} bytes)")


run(main)
