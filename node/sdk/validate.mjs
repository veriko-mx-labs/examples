// Validate a SPEI transfer by its fields with the Node SDK.
//
//   cd node/sdk && npm install
//   VERIKO_API_KEY=veriko_... node validate.mjs
//
// The client reads VERIKO_API_KEY from the environment. Every accepted validation consumes
// quota. The transfer is example data that does not exist at Banxico: expect `not_found`.
//
// veriko:operation POST /validate

import { Veriko } from '@veriko-mx/sdk';

const client = new Veriko();

try {
  const validation = await client.validations.validate({
    sendDate: '2025-03-15',
    amount: 15000.5,
    trackingKey: 'MXBA20250315001234',
    senderBank: '40012',
    beneficiaryAccount: '012180004412345678',
    idempotencyKey: 'example-order-4812', // derive it from your own order identifier
  });
  console.log(validation.id, validation.attributes.status);
} catch (error) {
  console.error(error.code ?? error.name, error.message);
  process.exit(1);
}
