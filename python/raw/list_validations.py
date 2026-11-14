#!/usr/bin/env python3
"""Recorre todas las páginas del historial de validaciones.

    VERIKO_API_KEY=veriko_... python3 python/raw/list_validations.py

`per_page` acepta de 1 a 50 en este listado; un valor mayor se ajusta al tope. Avanza con `page`
hasta `meta.pagination.total_pages`. Los parámetros que la operación no declara se ignoran sin
error, así que revisa los nombres.
Listar no consume cuota.
"""
# veriko:operation GET /validations query=page,per_page,from,to
from client import api, run, with_retry


def main() -> None:
    page, total_pages = 1, 1
    while page <= total_pages:
        response = with_retry(lambda: api("GET", "/validations", query={
            "page": page, "per_page": 50, "from": "2025-01-01", "to": "2025-12-31"}))
        for item in response.body["data"]:
            print(item["id"], item["attributes"]["status"])
        total_pages = response.body["meta"]["pagination"]["total_pages"]
        page += 1


run(main)
