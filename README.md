# Ejemplos de la API de Veriko

Validar una transferencia SPEI contra el CEP (Comprobante Electrónico de Pago) de Banco de México, en cURL, Node.js, Python y PHP. Los mismos ejemplos que en [veriko.mx/developers](https://veriko.mx/developers), como archivos que se ejecutan tal cual.

Referencia completa: **[docs.veriko.mx/openapi.yaml](https://docs.veriko.mx/openapi.yaml)** · Documentación: **[docs.veriko.mx](https://docs.veriko.mx)**.

## Antes de correr un ejemplo

Necesitas una clave de API (empieza con `veriko_`) — se obtiene registrando una cuenta gratuita en [veriko.mx](https://veriko.mx). Ponla en la variable de entorno `VERIKO_API_KEY`.

```bash
export VERIKO_API_KEY=veriko_tu_clave_aqui
```

## Los ejemplos

| Lenguaje | Archivo | Cómo correrlo |
|---|---|---|
| cURL | [`curl/validate.sh`](curl/validate.sh) | `bash curl/validate.sh` |
| Node.js ≥ 18 | [`node/validate.mjs`](node/validate.mjs) | `node node/validate.mjs` |
| Python ≥ 3.9 | [`python/validate.py`](python/validate.py) | `pip install requests && python python/validate.py` |
| PHP ≥ 8.1 | [`php/validate.php`](php/validate.php) | `php php/validate.php` |

Los cuatro hacen lo mismo: validan una transferencia SPEI con la fecha, el monto, la clave de rastreo y la cuenta beneficiaria exactos (sin subir una imagen), y muestran el veredicto que devuelve la API.

## Más allá de estos ejemplos

- **SDK de Python y de JavaScript**: en construcción — mientras tanto, estos ejemplos y la [referencia completa](https://docs.veriko.mx/openapi.yaml) cubren cualquier lenguaje con un cliente HTTP.
- **Webhooks, reintentos, idempotencia**: [Verificar un pago SPEI por API](https://veriko.mx/resources/verificar-pago-api).
- **Comparativa con otras APIs de CEP**: [veriko.mx/resources/api-cep-comparativa](https://veriko.mx/resources/api-cep-comparativa).

## Licencia

MIT — ver [`LICENSE`](LICENSE).
