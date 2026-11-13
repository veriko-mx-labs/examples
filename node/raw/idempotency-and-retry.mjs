// Retry a validation safely: one `Idempotency-Key` per business attempt, backoff on transient failures.
//
//   VERIKO_API_KEY=veriko_... node node/raw/idempotency-and-retry.mjs
//
// The key identifies the attempt, so derive it from your own identifier (here an order number),
// never from a random value per send. The API stores it for 24 hours:
//   - same key, same body: the original response comes back with `Idempotent-Replayed: true`;
//   - same key, different body: 422 `idempotency_key_reused`;
//   - same key while the first request runs: 409 `idempotency_key_in_progress`.
// `withRetry` repeats the request on 408, 429, 500, 502, 503, 504 and on network failures,
// waiting `Retry-After` when present. It never retries `quota_exceeded`: that 429 lasts until
// the plan renews.
// The second call below replays the first: it consumes no additional quota. The transfer is
// example data: expect `not_found`.
//
// veriko:operation POST /validate headers=Idempotency-Key body=send_date,amount,tracking_key,sender_bank,beneficiary_account
// veriko:operation GET /validations/{id}

import { api, pollValidation, run, SYNC_TIMEOUT_MS, withRetry } from './client.mjs';

const idempotencyKey = 'example-order-4812-attempt-1';

const send = () =>
  api('POST', '/validate', {
    timeoutMs: SYNC_TIMEOUT_MS,
    headers: { 'Idempotency-Key': idempotencyKey },
    body: {
      send_date: '2025-03-15',
      amount: 15000.5,
      tracking_key: 'MXBA20250315001234',
      sender_bank: '40012',
      beneficiary_account: '012180004412345678',
    },
  });

run(async () => {
  for (const attempt of [1, 2]) {
    const response = await withRetry(send);
    const replayed = response.headers.get('idempotent-replayed') === 'true';
    let validation = response.body;
    if (response.status === 202) {
      validation = await pollValidation(validation.data.id, { expiresAt: validation.data.attributes.expires_at });
    }
    console.log(`Call ${attempt}: ${validation.data.id} ${validation.data.attributes.status} replayed=${replayed}`);
  }
});
