// Enqueue a validation by its fields and wait for the verdict with the Node SDK.
//
//   cd node/sdk && npm install
//   VERIKO_API_KEY=veriko_... node enqueue-and-wait.mjs
//
// `enqueue` sends `?async=1`. `waitFor` polls with the ETag until the verdict is final and throws
// `TimeoutError` when `timeoutMs` runs out. Every accepted validation consumes quota. The transfer
// is example data: expect `not_found`.
//
// veriko:operation POST /validate?async=1 query=async
// veriko:operation GET /validations/{id}

import { Veriko } from '@veriko-mx/sdk';

const client = new Veriko();

try {
  const queued = await client.validations.enqueue({
    sendDate: '2025-03-15',
    amount: 15000.5,
    trackingKey: 'MXBA20250315001234',
    senderBank: '40012',
    beneficiaryAccount: '012180004412345678',
    idempotencyKey: 'example-order-4813',
  });
  const validation = await client.validations.waitFor(queued.id, { timeoutMs: 120_000 });
  console.log(validation.id, validation.attributes.status);
} catch (error) {
  console.error(error.code ?? error.name, error.message);
  process.exit(1);
}
