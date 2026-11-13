// Export the CEP files of a date range as a ZIP, built in the background.
//
//   VERIKO_API_KEY=veriko_... node node/raw/finance-cep-export.mjs 2025-03-01 2025-03-31
//
// The request answers 202 with an export in `queued`. Poll it until the status is `ready`, `failed` or
// `expired`, then download the ZIP. The file expires 24 hours after it is ready. The
// `Idempotency-Key` makes a repeated request reuse the same export.
//
// veriko:operation POST /finance/ceps/exports headers=Idempotency-Key body=from,to
// veriko:operation GET /finance/ceps/exports/{id}
// veriko:operation GET /finance/ceps/exports/{id}/download

import { writeFile } from 'node:fs/promises';

import { api, run, sleep, withRetry } from './client.mjs';

const CEP_EXPORT_TERMINAL_STATUSES = new Set(['ready', 'failed', 'expired']);

run(async () => {
  const [from, to] = process.argv.slice(2);
  if (!from || !to) {
    console.error('Usage: node finance-cep-export.mjs <from YYYY-MM-DD> <to YYYY-MM-DD>');
    process.exit(2);
  }

  const created = await withRetry(() =>
    api('POST', '/finance/ceps/exports', {
      headers: { 'Idempotency-Key': `example-cep-export-${from}-${to}` },
      body: { from, to },
    }),
  );
  const { id } = created.body.data;

  for (;;) {
    const { body } = await withRetry(() => api('GET', `/finance/ceps/exports/${id}`));
    const { status, error_code: errorCode } = body.data.attributes;
    if (CEP_EXPORT_TERMINAL_STATUSES.has(status)) {
      if (status !== 'ready') throw new Error(`Export ${id} ended as ${status} ${errorCode ?? ''}`);
      break;
    }
    console.error(`Export ${id}: ${status}`);
    await sleep(5000);
  }

  const zip = await api('GET', `/finance/ceps/exports/${id}/download`, { binary: true, timeoutMs: 120_000 });
  await writeFile(`ceps-${from}-${to}.zip`, zip.body);
  console.log(`Saved ceps-${from}-${to}.zip`);
});
