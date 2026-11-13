// Validate a SPEI transfer from a receipt image or PDF with the Node SDK.
//
//   cd node/sdk && npm install
//   VERIKO_API_KEY=veriko_... node validate-ocr.mjs path/to/receipt.png
//
// The SDK reads the file and sends it as base64. Every accepted validation consumes quota, and a
// receipt that cannot be read is charged too.
//
// veriko:operation POST /validate-ocr

import { Veriko } from '@veriko-mx/sdk';

const receipt = process.argv[2];
if (!receipt) {
  console.error('Usage: node validate-ocr.mjs <receipt file>');
  process.exit(2);
}

const client = new Veriko();

try {
  const validation = await client.validations.validateOcr({ image: receipt });
  console.log(validation.id, validation.attributes.status);
} catch (error) {
  console.error(error.code ?? error.name, error.message);
  process.exit(1);
}
