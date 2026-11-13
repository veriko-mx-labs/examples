// Export the validation history as a CSV file.
//
//   VERIKO_API_KEY=veriko_... node node/raw/export-validations.mjs
//
// `format` accepts `csv` and `xlsx` (default `csv`). The response is a file attachment; an
// error comes back as JSON. Exporting consumes no quota.
//
// veriko:operation GET /validations/export query=format,from,to,limit

import { writeFile } from 'node:fs/promises';

import { api, run, withRetry } from './client.mjs';

run(async () => {
  const response = await withRetry(() =>
    api('GET', '/validations/export', {
      query: { format: 'csv', from: '2025-01-01', to: '2025-12-31', limit: 1000 },
      binary: true,
      timeoutMs: 120_000,
    }),
  );
  await writeFile('validations.csv', response.body);
  console.log(`Saved validations.csv (${response.body.length} bytes)`);
});
