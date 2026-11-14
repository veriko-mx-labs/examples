#!/usr/bin/env python3
"""Maneja los errores de la API: revisa primero el estado HTTP, decide con `errors[].code` y muestra `detail` y `hint`.

    VERIKO_API_KEY=veriko_... python3 python/raw/error_handling.py

Este script envía a propósito una petición inválida (un `422`). La API la rechaza antes de
llegar a Banxico, así que no consume cuota.
Decide con `code`: es estable y nunca se traduce. `detail` cambia con la cabecera
`Accept-Language` y puede reformularse, así que muéstralo pero no lo compares.
"""
# veriko:operation POST /validate body=amount,beneficiary_account
import sys

from client import SYNC_TIMEOUT, ApiError, api, run


def main() -> None:
    try:
        # No trae `tracking_key` ni `numeric_reference`: la API no puede buscar el pago.
        api("POST", "/validate", timeout=SYNC_TIMEOUT, body={"amount": 100, "beneficiary_account": "012180004412345678"})
    except ApiError as error:
        # Un 422 trae una entrada de resumen y luego una por cada campo inválido: lee toda la lista.
        for entry in error.errors:
            pointer = (entry.get("source") or {}).get("pointer")
            print(f"{entry['code']}{f' en {pointer}' if pointer else ''}: {entry['detail']}")
        if error.code == "quota_exceeded":
            print("Se agotó la cuota del plan. No reintentes; cambia de plan o espera a la renovación.")
        elif error.code == "rate_limit_exceeded":
            print(f"Límite de tasa alcanzado. Reintenta en {error.retry_after or 60:.0f} s.")
        else:
            print(f"La petición {error.request_id or 'desconocida'} falló con HTTP {error.status}.")
        sys.exit(1)


run(main)
