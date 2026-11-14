// Valida una transferencia SPEI por sus campos con el SDK de Node.
//
//   cd node/sdk && npm install
//   VERIKO_API_KEY=veriko_... node validate.mjs
//
// El cliente lee VERIKO_API_KEY del entorno. Cada validación aceptada consume cuota. La
// transferencia es de ejemplo y no existe en Banxico: espera `not_found`.
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
    idempotencyKey: 'pedido-ejemplo-4812', // derívala de tu propio identificador de pedido
  });
  console.log(validation.id, validation.attributes.status);
} catch (error) {
  console.error(error.code ?? error.name, error.message);
  process.exit(1);
}
