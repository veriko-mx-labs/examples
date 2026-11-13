# Veriko API examples

Runnable examples for the Veriko API, which validates a SPEI transfer against the CEP (Comprobante Electrónico de Pago) that Banxico issues. Each flow has an example in cURL, Node.js, Python and PHP.

The reference is at [docs.veriko.mx/openapi.yaml](https://docs.veriko.mx/openapi.yaml) and the documentation at [docs.veriko.mx](https://docs.veriko.mx).

## Prerequisites

- An API key. It starts with `veriko_` and comes with a free account at [veriko.mx](https://veriko.mx). Put it in the `VERIKO_API_KEY` environment variable:

  ```bash
  export VERIKO_API_KEY=veriko_your_key_here
  ```

- cURL examples: bash, `curl` and `jq`.
- Node.js examples: Node.js 18 or later. The `raw/` examples have no dependencies.
- Python examples: Python 3.9 or later. The `raw/` examples use only the standard library.
- PHP examples: PHP 8.1 or later with the `curl` extension.
- Optional: set `VERIKO_BASE_URL` to send the requests to another host. The default is `https://api.veriko.mx/v1`.

## Quota

Every accepted `POST /v1/validate` and `POST /v1/validate-ocr` consumes quota from your plan, including a validation that ends in `not_found`. Idempotent replays and automatic retries consume nothing extra. The API has no test host or test mode.

The transfers in the examples are made up. They do not exist at Banxico, so they end in `not_found` and still consume quota. Replace them with a real transfer to get `valid`.

## How to run

Run an example from the root of this repository:

```bash
bash curl/validate.sh
node node/raw/validate.mjs
python3 python/raw/validate.py
php php/validate.php
```

Every example exits with a non-zero code when the API answers a non-2xx status, when a request times out, and when a validation ends without a final status. The synchronous validation waits up to 75 seconds, because Banxico can take about a minute to answer.

## Flows

| Flow | cURL | Node.js | Python | PHP |
|---|---|---|---|---|
| Validate by fields (200 verdict, 202 `sync_deadline`) | [`curl/validate.sh`](curl/validate.sh) | [`node/raw/validate.mjs`](node/raw/validate.mjs) | [`python/raw/validate.py`](python/raw/validate.py) | [`php/validate.php`](php/validate.php) |
| Validate by image | [`curl/validate-ocr.sh`](curl/validate-ocr.sh) | [`node/raw/validate-ocr.mjs`](node/raw/validate-ocr.mjs) | [`python/raw/validate_ocr.py`](python/raw/validate_ocr.py) | [`php/validate-ocr.php`](php/validate-ocr.php) |
| Enqueue by fields and poll | [`curl/enqueue-and-poll.sh`](curl/enqueue-and-poll.sh) | [`node/raw/enqueue-and-poll.mjs`](node/raw/enqueue-and-poll.mjs) | [`python/raw/enqueue_and_poll.py`](python/raw/enqueue_and_poll.py) | [`php/enqueue-and-poll.php`](php/enqueue-and-poll.php) |
| Enqueue by image and poll | [`curl/enqueue-ocr-and-poll.sh`](curl/enqueue-ocr-and-poll.sh) | [`node/raw/enqueue-ocr-and-poll.mjs`](node/raw/enqueue-ocr-and-poll.mjs) | [`python/raw/enqueue_ocr_and_poll.py`](python/raw/enqueue_ocr_and_poll.py) | [`php/enqueue-ocr-and-poll.php`](php/enqueue-ocr-and-poll.php) |
| Idempotency and safe retries | [`curl/idempotent-validate.sh`](curl/idempotent-validate.sh) | [`node/raw/idempotency-and-retry.mjs`](node/raw/idempotency-and-retry.mjs) | [`python/raw/idempotency_and_retry.py`](python/raw/idempotency_and_retry.py) | [`php/idempotency-and-retry.php`](php/idempotency-and-retry.php) |
| Error handling | [`curl/error-handling.sh`](curl/error-handling.sh) | [`node/raw/error-handling.mjs`](node/raw/error-handling.mjs) | [`python/raw/error_handling.py`](python/raw/error_handling.py) | [`php/error-handling.php`](php/error-handling.php) |
| Download the CEP (PDF or XML) | [`curl/download-cep.sh`](curl/download-cep.sh) | [`node/raw/download-cep.mjs`](node/raw/download-cep.mjs) | [`python/raw/download_cep.py`](python/raw/download_cep.py) | [`php/download-cep.php`](php/download-cep.php) |
| Paginate validations | [`curl/list-validations.sh`](curl/list-validations.sh) | [`node/raw/list-validations.mjs`](node/raw/list-validations.mjs) | [`python/raw/list_validations.py`](python/raw/list_validations.py) | [`php/list-validations.php`](php/list-validations.php) |
| Export validations (CSV) | [`curl/export-validations.sh`](curl/export-validations.sh) | [`node/raw/export-validations.mjs`](node/raw/export-validations.mjs) | [`python/raw/export_validations.py`](python/raw/export_validations.py) | [`php/export-validations.php`](php/export-validations.php) |
| Export CEP files as a ZIP | [`curl/finance-cep-export.sh`](curl/finance-cep-export.sh) | [`node/raw/finance-cep-export.mjs`](node/raw/finance-cep-export.mjs) | [`python/raw/finance_cep_export.py`](python/raw/finance_cep_export.py) | [`php/finance-cep-export.php`](php/finance-cep-export.php) |
| Retry policy | [`curl/retry-policy.sh`](curl/retry-policy.sh) | [`node/raw/retry-policy.mjs`](node/raw/retry-policy.mjs) | [`python/raw/retry_policy.py`](python/raw/retry_policy.py) | [`php/retry-policy.php`](php/retry-policy.php) |
| Beneficiaries (create, list, update, delete) | [`curl/beneficiaries.sh`](curl/beneficiaries.sh) | [`node/raw/beneficiaries.mjs`](node/raw/beneficiaries.mjs) | [`python/raw/beneficiaries.py`](python/raw/beneficiaries.py) | [`php/beneficiaries.php`](php/beneficiaries.php) |
| Register a webhook endpoint | [`curl/webhook-register.sh`](curl/webhook-register.sh) | [`node/raw/webhook-register.mjs`](node/raw/webhook-register.mjs) | [`python/raw/webhook_register.py`](python/raw/webhook_register.py) | [`php/webhook-register.php`](php/webhook-register.php) |
| Webhook receiver | | [`node/raw/webhook-receiver.mjs`](node/raw/webhook-receiver.mjs) | [`python/raw/webhook_receiver.py`](python/raw/webhook_receiver.py) | [`php/webhook-receiver.php`](php/webhook-receiver.php) |

The `client.mjs`, `client.py`, `client.php` and `lib.sh` files hold the shared request, retry and polling code of each language.

Examples that take an input document the arguments in their first lines. Image flows take a receipt file or an HTTPS URL. `download-cep` takes a validation id.

### Polling

The enqueue flows poll `GET /v1/validations/{id}` until `status` is one of `valid`, `not_found`, `cep_unavailable`, `invalid`, `returned`, `failed` or `error`. The pollers wait the `Retry-After` seconds between requests, send the `ETag` back in `If-None-Match`, and stop at `expires_at`.

### Retries and idempotency

`idempotency-and-retry` sends an `Idempotency-Key` derived from the order, retries on `408`, `429`, `500`, `502`, `503` and `504` with backoff, honors `Retry-After`, and never retries `quota_exceeded`. A request without an `Idempotency-Key` is not repeated.

### Webhooks

The receivers verify `X-Webhook-Signature-Timestamped`, reject a `t` more than 5 minutes from the local clock, and compare in constant time. During the 24 hours after `POST /v1/webhooks/{id}/regenerate-secret` they also accept `X-Webhook-Signature-Old`, signed with the previous secret. Set `VERIKO_WEBHOOK_SECRET` to the secret that `POST /v1/webhooks` returns, and `VERIKO_WEBHOOK_SECRET_PREVIOUS` during a rotation. Run the PHP receiver with `php -S 0.0.0.0:3000 php/webhook-receiver.php`.

## SDKs

The Node.js and Python examples also come in an `sdk/` variant that uses the official SDKs, [`@veriko-mx/sdk`](https://github.com/veriko-mx-labs/veriko-js) and [`veriko`](https://github.com/veriko-mx-labs/veriko-python).

| Flow | Node.js | Python |
|---|---|---|
| Validate by fields | [`node/sdk/validate.mjs`](node/sdk/validate.mjs) | [`python/sdk/validate.py`](python/sdk/validate.py) |
| Validate by image | [`node/sdk/validate-ocr.mjs`](node/sdk/validate-ocr.mjs) | [`python/sdk/validate_ocr.py`](python/sdk/validate_ocr.py) |
| Enqueue by fields and wait | [`node/sdk/enqueue-and-wait.mjs`](node/sdk/enqueue-and-wait.mjs) | [`python/sdk/enqueue_and_wait.py`](python/sdk/enqueue_and_wait.py) |
| Enqueue by image and wait | [`node/sdk/enqueue-ocr-and-wait.mjs`](node/sdk/enqueue-ocr-and-wait.mjs) | [`python/sdk/enqueue_ocr_and_wait.py`](python/sdk/enqueue_ocr_and_wait.py) |
| Webhook receiver | [`node/sdk/webhook-receiver.mjs`](node/sdk/webhook-receiver.mjs) | [`python/sdk/webhook_receiver.py`](python/sdk/webhook_receiver.py) |

Install the dependencies before you run one: `cd node/sdk && npm install`, or `pip install -r python/sdk/requirements.txt`.

## Checks

```bash
npm ci
npm test
```

`npm test` runs `scripts/validate-examples.mjs`. It reads the files in `curl/`, `node/`, `python/` and `php/` and checks each request against `spec/openapi.yaml`: the operation exists and accepts an API key, the query parameters, headers and body fields exist in the spec, and the terminal status lists match the spec. Each example declares the operations it calls in a line such as `veriko:operation POST /validate body=send_date,amount`. A new example is checked as soon as it has that line and a row in this README.

`npm run lint` checks the syntax of every example with the interpreters that are installed: `bash -n`, `node --check`, `python3 -m py_compile` and `php -l`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) to report a problem or propose a change. Report vulnerabilities as described in [`SECURITY.md`](SECURITY.md).

## License

MIT. See [`LICENSE`](LICENSE).
