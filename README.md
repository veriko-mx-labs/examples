# Ejemplos de la API de Veriko

Ejemplos que se ejecutan tal cual para la API de Veriko, que valida una transferencia SPEI contra el CEP (Comprobante Electrónico de Pago) que expide Banxico. Cada flujo tiene un ejemplo en cURL, Node.js, Python y PHP.

La referencia está en [docs.veriko.mx/openapi.yaml](https://docs.veriko.mx/openapi.yaml) y la documentación en [docs.veriko.mx](https://docs.veriko.mx/es).

## Requisitos

- Una clave de API. Empieza con `veriko_` y viene con una cuenta gratuita en [veriko.mx](https://veriko.mx). Ponla en la variable de entorno `VERIKO_API_KEY`:

  ```bash
  export VERIKO_API_KEY=veriko_tu_clave_aqui
  ```

- Ejemplos de cURL: bash, `curl` y `jq`.
- Ejemplos de Node.js: Node.js 18 o posterior. Los ejemplos de `raw/` no tienen dependencias.
- Ejemplos de Python: Python 3.9 o posterior. Los ejemplos de `raw/` usan sólo la biblioteca estándar.
- Ejemplos de PHP: PHP 8.1 o posterior con la extensión `curl`.
- Opcional: define `VERIKO_BASE_URL` para enviar las peticiones a otro servidor. El valor predeterminado es `https://api.veriko.mx/v1`.

## Cuota

Cada `POST /v1/validate` y `POST /v1/validate-ocr` aceptado consume cuota de tu plan, también una validación que termina en `not_found`. Las repeticiones idempotentes y los reintentos automáticos no consumen nada extra. La API no tiene un servidor ni un modo de pruebas.

Las transferencias de los ejemplos son inventadas. No existen en Banxico, así que terminan en `not_found` y aun así consumen cuota. Cámbialas por una transferencia real para obtener `valid`.

## Cómo correrlos

Corre un ejemplo desde la raíz de este repositorio:

```bash
bash curl/validate.sh
node node/raw/validate.mjs
python3 python/raw/validate.py
php php/validate.php
```

Cada ejemplo termina con un código distinto de cero cuando la API responde un estado que no es 2xx, cuando una petición agota su tiempo límite y cuando una validación termina sin un estado final. La validación síncrona espera hasta 75 segundos, porque Banxico puede tardar cerca de un minuto en responder.

## Flujos

| Flujo | cURL | Node.js | Python | PHP |
|---|---|---|---|---|
| Validar por campos (veredicto 200, 202 `sync_deadline`) | [`curl/validate.sh`](curl/validate.sh) | [`node/raw/validate.mjs`](node/raw/validate.mjs) | [`python/raw/validate.py`](python/raw/validate.py) | [`php/validate.php`](php/validate.php) |
| Validar por imagen | [`curl/validate-ocr.sh`](curl/validate-ocr.sh) | [`node/raw/validate-ocr.mjs`](node/raw/validate-ocr.mjs) | [`python/raw/validate_ocr.py`](python/raw/validate_ocr.py) | [`php/validate-ocr.php`](php/validate-ocr.php) |
| Poner en cola por campos y sondear | [`curl/enqueue-and-poll.sh`](curl/enqueue-and-poll.sh) | [`node/raw/enqueue-and-poll.mjs`](node/raw/enqueue-and-poll.mjs) | [`python/raw/enqueue_and_poll.py`](python/raw/enqueue_and_poll.py) | [`php/enqueue-and-poll.php`](php/enqueue-and-poll.php) |
| Poner en cola por imagen y sondear | [`curl/enqueue-ocr-and-poll.sh`](curl/enqueue-ocr-and-poll.sh) | [`node/raw/enqueue-ocr-and-poll.mjs`](node/raw/enqueue-ocr-and-poll.mjs) | [`python/raw/enqueue_ocr_and_poll.py`](python/raw/enqueue_ocr_and_poll.py) | [`php/enqueue-ocr-and-poll.php`](php/enqueue-ocr-and-poll.php) |
| Idempotencia y reintentos seguros | [`curl/idempotent-validate.sh`](curl/idempotent-validate.sh) | [`node/raw/idempotency-and-retry.mjs`](node/raw/idempotency-and-retry.mjs) | [`python/raw/idempotency_and_retry.py`](python/raw/idempotency_and_retry.py) | [`php/idempotency-and-retry.php`](php/idempotency-and-retry.php) |
| Manejo de errores | [`curl/error-handling.sh`](curl/error-handling.sh) | [`node/raw/error-handling.mjs`](node/raw/error-handling.mjs) | [`python/raw/error_handling.py`](python/raw/error_handling.py) | [`php/error-handling.php`](php/error-handling.php) |
| Descargar el CEP (PDF o XML) | [`curl/download-cep.sh`](curl/download-cep.sh) | [`node/raw/download-cep.mjs`](node/raw/download-cep.mjs) | [`python/raw/download_cep.py`](python/raw/download_cep.py) | [`php/download-cep.php`](php/download-cep.php) |
| Paginar las validaciones | [`curl/list-validations.sh`](curl/list-validations.sh) | [`node/raw/list-validations.mjs`](node/raw/list-validations.mjs) | [`python/raw/list_validations.py`](python/raw/list_validations.py) | [`php/list-validations.php`](php/list-validations.php) |
| Exportar validaciones (CSV) | [`curl/export-validations.sh`](curl/export-validations.sh) | [`node/raw/export-validations.mjs`](node/raw/export-validations.mjs) | [`python/raw/export_validations.py`](python/raw/export_validations.py) | [`php/export-validations.php`](php/export-validations.php) |
| Exportar los CEP en un ZIP | [`curl/finance-cep-export.sh`](curl/finance-cep-export.sh) | [`node/raw/finance-cep-export.mjs`](node/raw/finance-cep-export.mjs) | [`python/raw/finance_cep_export.py`](python/raw/finance_cep_export.py) | [`php/finance-cep-export.php`](php/finance-cep-export.php) |
| Política de reintentos | [`curl/retry-policy.sh`](curl/retry-policy.sh) | [`node/raw/retry-policy.mjs`](node/raw/retry-policy.mjs) | [`python/raw/retry_policy.py`](python/raw/retry_policy.py) | [`php/retry-policy.php`](php/retry-policy.php) |
| Beneficiarios (crear, listar, actualizar, eliminar) | [`curl/beneficiaries.sh`](curl/beneficiaries.sh) | [`node/raw/beneficiaries.mjs`](node/raw/beneficiaries.mjs) | [`python/raw/beneficiaries.py`](python/raw/beneficiaries.py) | [`php/beneficiaries.php`](php/beneficiaries.php) |
| Registrar un endpoint de webhook | [`curl/webhook-register.sh`](curl/webhook-register.sh) | [`node/raw/webhook-register.mjs`](node/raw/webhook-register.mjs) | [`python/raw/webhook_register.py`](python/raw/webhook_register.py) | [`php/webhook-register.php`](php/webhook-register.php) |
| Receptor de webhooks | | [`node/raw/webhook-receiver.mjs`](node/raw/webhook-receiver.mjs) | [`python/raw/webhook_receiver.py`](python/raw/webhook_receiver.py) | [`php/webhook-receiver.php`](php/webhook-receiver.php) |

Los archivos `client.mjs`, `client.py`, `client.php` y `lib.sh` contienen el código compartido de cada lenguaje para enviar peticiones, reintentar y sondear.

Los ejemplos que reciben un dato documentan sus argumentos en las primeras líneas. Los flujos con imagen reciben un archivo de comprobante o una URL HTTPS. `download-cep` recibe el id de una validación.

### Sondeo

Los flujos en cola sondean `GET /v1/validations/{id}` hasta que `status` sea `valid`, `not_found`, `cep_unavailable`, `invalid`, `returned`, `failed` o `error`. Los sondeos esperan los segundos de `Retry-After` entre peticiones, devuelven el `ETag` en `If-None-Match` y se detienen en `expires_at`.

### Reintentos e idempotencia

`idempotency-and-retry` envía un `Idempotency-Key` derivado del pedido, reintenta con `408`, `429`, `500`, `502`, `503` y `504` esperando cada vez más, respeta `Retry-After` y nunca reintenta `quota_exceeded`. Una petición sin `Idempotency-Key` no se repite.

### Webhooks

Los receptores verifican `X-Webhook-Signature-Timestamped`, rechazan una `t` a más de 5 minutos del reloj local y comparan en tiempo constante. Durante las 24 horas posteriores a `POST /v1/webhooks/{id}/regenerate-secret` también aceptan `X-Webhook-Signature-Old`, firmada con el secreto anterior. Define `VERIKO_WEBHOOK_SECRET` con el secreto que devuelve `POST /v1/webhooks` y `VERIKO_WEBHOOK_SECRET_PREVIOUS` durante una rotación. Corre el receptor de PHP con `php -S 0.0.0.0:3000 php/webhook-receiver.php`.

## SDK

Los ejemplos de Node.js y de Python también vienen en una variante `sdk/` que usa los SDK oficiales, [`@veriko-mx/sdk`](https://github.com/veriko-mx-labs/veriko-js) y [`veriko`](https://github.com/veriko-mx-labs/veriko-python).

| Flujo | Node.js | Python |
|---|---|---|
| Validar por campos | [`node/sdk/validate.mjs`](node/sdk/validate.mjs) | [`python/sdk/validate.py`](python/sdk/validate.py) |
| Validar por imagen | [`node/sdk/validate-ocr.mjs`](node/sdk/validate-ocr.mjs) | [`python/sdk/validate_ocr.py`](python/sdk/validate_ocr.py) |
| Poner en cola por campos y esperar | [`node/sdk/enqueue-and-wait.mjs`](node/sdk/enqueue-and-wait.mjs) | [`python/sdk/enqueue_and_wait.py`](python/sdk/enqueue_and_wait.py) |
| Poner en cola por imagen y esperar | [`node/sdk/enqueue-ocr-and-wait.mjs`](node/sdk/enqueue-ocr-and-wait.mjs) | [`python/sdk/enqueue_ocr_and_wait.py`](python/sdk/enqueue_ocr_and_wait.py) |
| Receptor de webhooks | [`node/sdk/webhook-receiver.mjs`](node/sdk/webhook-receiver.mjs) | [`python/sdk/webhook_receiver.py`](python/sdk/webhook_receiver.py) |

Instala las dependencias antes de correr uno: `cd node/sdk && npm install` o `pip install -r python/sdk/requirements.txt`.

## Comprobaciones

```bash
npm ci
npm test
```

`npm test` corre `scripts/validate-examples.mjs`. Lee los archivos de `curl/`, `node/`, `python/` y `php/` y revisa cada petición contra `spec/openapi.yaml`: la operación existe y acepta una clave de API, los parámetros de consulta, las cabeceras y los campos del cuerpo existen en el spec, y las listas de estados finales coinciden con el spec. Cada ejemplo declara las operaciones que llama en una línea como `veriko:operation POST /validate body=send_date,amount`. Un ejemplo nuevo se revisa en cuanto tiene esa línea y una fila en este README.

`npm run lint` revisa la sintaxis de cada ejemplo con los intérpretes que estén instalados: `bash -n`, `node --check`, `python3 -m py_compile` y `php -l`.

## Contribuir

Consulta [`CONTRIBUTING.md`](CONTRIBUTING.md) para reportar un problema o proponer un cambio. Reporta las vulnerabilidades como indica [`SECURITY.md`](SECURITY.md).

## Licencia

MIT. Consulta [`LICENSE`](LICENSE).
