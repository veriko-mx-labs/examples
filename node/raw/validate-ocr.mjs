// Validate a SPEI transfer from its receipt: an image or a PDF of 1 to 3 pages.
//
//   VERIKO_API_KEY=veriko_... node node/raw/validate-ocr.mjs path/to/receipt.png
//   VERIKO_API_KEY=veriko_... node node/raw/validate-ocr.mjs https://example.com/receipt.png
//
// The argument is a local file (sent as base64) or an HTTPS URL (sent as `image_url`).
// Every accepted validation consumes quota. A receipt that is unreadable or is not a SPEI
// receipt is rejected with 422 (`image_not_readable_receipt`, `image_not_spei_receipt`) and
// the validation is still charged.
//
// veriko:operation POST /validate-ocr body=image,image_url,beneficiary_account
// veriko:operation GET /validations/{id}

import { readFile } from 'node:fs/promises';

import { api, pollValidation, run, SYNC_TIMEOUT_MS } from './client.mjs';

run(async () => {
  const source = process.argv[2];
  if (!source) {
    console.error('Usage: node validate-ocr.mjs <receipt file or https URL>');
    process.exit(2);
  }

  const body = /^https:\/\//u.test(source)
    ? { image_url: source }
    : { image: (await readFile(source)).toString('base64') };
  // Send the account when the receipt hides it or shows it incomplete (example value):
  // body.beneficiary_account = '012180004412345678';

  const response = await api('POST', '/validate-ocr', { timeoutMs: SYNC_TIMEOUT_MS, body });

  let validation = response.body;
  if (response.status === 202) {
    validation = await pollValidation(validation.data.id, { expiresAt: validation.data.attributes.expires_at });
  }
  console.log(`${validation.data.id} ${validation.data.attributes.status}`);
});
