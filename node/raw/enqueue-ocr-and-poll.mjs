// Enqueue a validation from a receipt (`POST /validate-ocr?async=1`) and poll until it is final.
//
//   VERIKO_API_KEY=veriko_... node node/raw/enqueue-ocr-and-poll.mjs path/to/receipt.png
//
// The argument is a local file or an HTTPS URL. With several `candidate_accounts` the validation
// still consumes a single unit of quota. Every accepted validation consumes quota, and a receipt
// that cannot be read is charged too.
//
// veriko:operation POST /validate-ocr?async=1 query=async body=image,image_url,candidate_accounts,client_ref
// veriko:operation GET /validations/{id}

import { readFile } from 'node:fs/promises';

import { api, pollValidation, run } from './client.mjs';

run(async () => {
  const source = process.argv[2];
  if (!source) {
    console.error('Usage: node enqueue-ocr-and-poll.mjs <receipt file or https URL>');
    process.exit(2);
  }

  const body = /^https:\/\//u.test(source)
    ? { image_url: source }
    : { image: (await readFile(source)).toString('base64') };
  body.client_ref = 'example-receipt-1';
  // When the receipt does not show the account, send the candidates instead (example values):
  // body.candidate_accounts = ['012180004412345678', '002010077777777771'];

  const queued = await api('POST', '/validate-ocr', { query: { async: 1 }, body });
  const { id, attributes } = queued.body.data;
  console.error(`Queued ${id}`);

  const validation = await pollValidation(id, { expiresAt: attributes.expires_at });
  console.log(`${id} ${validation.data.attributes.status}`);
});
