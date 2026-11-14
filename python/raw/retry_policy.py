#!/usr/bin/env python3
"""Consulta y actualiza la política de reintentos de la cuenta, que vuelve a consultar las validaciones que terminaron sin veredicto.

    VERIKO_API_KEY=veriko_... python3 python/raw/retry_policy.py

Un reintento pertenece a la validación original y no consume cuota extra. La actualización
reemplaza toda la política; `max_retries` e `interval_seconds` tienen topes por plan
(`422 retry_policy_invalid` si los rebasas). La política aplica a las validaciones que se
creen después.
"""
# veriko:operation GET /users/me/retry-policy
# veriko:operation PUT /users/me/retry-policy headers=Idempotency-Key body=retry_policy,enabled,max_retries,interval_seconds,outcomes
import json

from client import api, run, with_retry


def main() -> None:
    current = api("GET", "/users/me/retry-policy").body
    print("Actual:", json.dumps(current["data"]["attributes"]))
    print("Topes del plan:", json.dumps((current.get("meta") or {}).get("caps")))

    updated = with_retry(lambda: api("PUT", "/users/me/retry-policy",
                                     headers={"Idempotency-Key": "ejemplo-politica-reintentos-v1"}, body={
        "retry_policy": {
            "enabled": True,
            "max_retries": 3,
            "interval_seconds": 600,  # de 300 a 86400
            "outcomes": ["not_found", "cep_unavailable", "error"],
        },
    })).body
    print("Actualizada:", json.dumps(updated["data"]["attributes"]))


run(main)
