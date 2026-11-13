// Download the CEP of a validation as a PDF or an XML file.
//
//   VERIKO_API_KEY=veriko_... node node/raw/download-cep.mjs <validation id> [pdf|xml]
//
// The CEP exists only when the validation is `valid` or `returned`. Otherwise the API answers 404
// `cep_not_available`. A validation that was purged answers 410 and an unknown format, 400
// `invalid_export_format`.
//
// veriko:operation GET /validations/{id}/cep query=format

import { writeFile } from 'node:fs/promises';

import { ApiError, api, run } from './client.mjs';

run(async () => {
  const [id, format = 'pdf'] = process.argv.slice(2);
  if (!id) {
    console.error('Usage: node download-cep.mjs <validation id> [pdf|xml]');
    process.exit(2);
  }

  try {
    const response = await api('GET', `/validations/${id}/cep`, { query: { format }, binary: true });
    const file = `cep-${id}.${format}`;
    await writeFile(file, response.body);
    console.log(`Saved ${file} (${response.headers.get('content-type')}, ${response.body.length} bytes)`);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'cep_not_available') {
      console.error('Banxico has no CEP for this validation (yet).');
      process.exit(1);
    }
    throw error;
  }
});
