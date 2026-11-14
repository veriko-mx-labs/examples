// Pone en cola una validación por sus campos y espera el veredicto con el SDK de Node.
//
//   cd node/sdk && npm install
//   VERIKO_API_KEY=veriko_... node enqueue-and-wait.mjs
//
// `enqueue` envía `?async=1`. `waitFor` sondea con el ETag hasta que el veredicto sea final y lanza
// `TimeoutError` cuando se agota `timeoutMs`. Cada validación aceptada consume cuota. La
// transferencia es de ejemplo: espera `not_found`.
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
    idempotencyKey: 'pedido-ejemplo-4813',
  });
  const validation = await client.validations.waitFor(queued.id, { timeoutMs: 120_000 });
  console.log(validation.id, validation.attributes.status);
} catch (error) {
  console.error(error.code ?? error.name, error.message);
  process.exit(1);
}
