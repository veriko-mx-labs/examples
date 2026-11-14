// Pone en cola la validación de un comprobante y espera el veredicto con el SDK de Node.
//
//   cd node/sdk && npm install
//   VERIKO_API_KEY=veriko_... node enqueue-ocr-and-wait.mjs ruta/al/comprobante.png
//
// `enqueueOcr` envía `POST /validate-ocr?async=1`. Cada validación aceptada consume cuota.
//
// veriko:operation POST /validate-ocr?async=1 query=async
// veriko:operation GET /validations/{id}

import { Veriko } from '@veriko-mx/sdk';

const receipt = process.argv[2];
if (!receipt) {
  console.error('Uso: node enqueue-ocr-and-wait.mjs <archivo del comprobante>');
  process.exit(2);
}

const client = new Veriko();

try {
  const queued = await client.validations.enqueueOcr({ image: receipt });
  const validation = await client.validations.waitFor(queued.id, { timeoutMs: 120_000 });
  console.log(validation.id, validation.attributes.status);
} catch (error) {
  console.error(error.code ?? error.name, error.message);
  process.exit(1);
}
