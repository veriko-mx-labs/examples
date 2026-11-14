#!/usr/bin/env python3
"""Registra un endpoint de webhook, envía una entrega de prueba y muestra su historial de entregas.

    VERIKO_API_KEY=veriko_... python3 python/raw/webhook_register.py https://example.com/hooks/veriko [--delete]

La URL debe ser una dirección HTTPS pública que responda 2xx: mientras pruebas, corre
`webhook_receiver.py` detrás de un túnel. La respuesta trae el `secret` de firma una sola vez;
guárdalo como VERIKO_WEBHOOK_SECRET para el receptor. El endpoint se suscribe a los siete
eventos de validación, así que `validation.returned` avisa de una devolución posterior.
"""
# veriko:operation POST /webhooks body=url,events,description
# veriko:operation POST /webhooks/{id}/test
# veriko:operation GET /webhooks/{id}/deliveries query=per_page
# veriko:operation DELETE /webhooks/{id}
import sys

from client import api, run


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Uso: webhook_register.py <URL https pública> [--delete]")

    created = api("POST", "/webhooks", body={
        "url": sys.argv[1],
        "description": "Endpoint de ejemplo",
        "events": [
            "validation.completed",
            "validation.failed",
            "validation.error",
            "validation.returned",
            "validation.retry.scheduled",
            "validation.retry.resolved",
            "validation.retry.exhausted",
        ],
    }).body["data"]
    endpoint_id = created["id"]
    print("Endpoint", endpoint_id)
    print("Secreto (se muestra una vez):", created["attributes"]["secret"])

    # La prueba responde 200 aunque la entrega falle: revisa `delivered`.
    result = api("POST", f"/webhooks/{endpoint_id}/test").body["data"]["attributes"]
    print(f"Prueba delivered={str(result['delivered']).lower()} http_status={result.get('http_status')} {result.get('error') or ''}")

    deliveries = api("GET", f"/webhooks/{endpoint_id}/deliveries", query={"per_page": 5}).body["data"]
    for delivery in deliveries:
        print(delivery["id"], delivery["attributes"]["status"])

    if "--delete" in sys.argv:
        api("DELETE", f"/webhooks/{endpoint_id}")
        print("Eliminado", endpoint_id)


run(main)
