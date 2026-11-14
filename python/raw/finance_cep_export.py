#!/usr/bin/env python3
"""Exporta en un ZIP los archivos de CEP de un rango de fechas, armado en segundo plano.

    VERIKO_API_KEY=veriko_... python3 python/raw/finance_cep_export.py 2025-03-01 2025-03-31

La petición responde 202 con una exportación en `queued`. Sondéala hasta que el estado sea `ready`,
`failed` o `expired` y luego descarga el ZIP. El archivo vence 24 horas después de quedar listo.
El `Idempotency-Key` hace que una petición repetida reutilice la misma exportación.
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
        sys.exit("Uso: finance_cep_export.py <desde AAAA-MM-DD> <hasta AAAA-MM-DD>")
    date_from, date_to = sys.argv[1], sys.argv[2]

    created = with_retry(lambda: api("POST", "/finance/ceps/exports",
                                     headers={"Idempotency-Key": f"ejemplo-exportacion-cep-{date_from}-{date_to}"},
                                     body={"from": date_from, "to": date_to})).body
    export_id = created["data"]["id"]

    while True:
        attributes = with_retry(lambda: api("GET", f"/finance/ceps/exports/{export_id}")).body["data"]["attributes"]
        if attributes["status"] in CEP_EXPORT_TERMINAL_STATUSES:
            if attributes["status"] != "ready":
                sys.exit(f"La exportación {export_id} terminó como {attributes['status']} {attributes.get('error_code') or ''}")
            break
        print(f"Exportación {export_id}: {attributes['status']}", file=sys.stderr)
        time.sleep(5)

    archive = api("GET", f"/finance/ceps/exports/{export_id}/download", binary=True, timeout=120)
    path = f"ceps-{date_from}-{date_to}.zip"
    with open(path, "wb") as file:
        file.write(archive.body)
    print("Guardado", path)


run(main)
