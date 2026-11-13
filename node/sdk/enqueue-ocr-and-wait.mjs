// Enqueue a validation from a receipt and wait for the verdict with the Node SDK.
//
//   cd node/sdk && npm install
//   VERIKO_API_KEY=veriko_... node enqueue-ocr-and-wait.mjs path/to/receipt.png
//
// `enqueueOcr` sends `POST /validate-ocr?async=1`. Every accepted validation consumes quota.
//
// veriko:operation POST /validate-ocr?async=1 query=async
// veriko:operation GET /validations/{id}

import { Veriko } from '@veriko-mx/sdk';

const receipt = process.argv[2];
if (!receipt) {
  console.error('Usage: node enqueue-ocr-and-wait.mjs <receipt file>');
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
