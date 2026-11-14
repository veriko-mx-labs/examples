// Exporta en un ZIP los archivos de CEP de un rango de fechas, armado en segundo plano.
//
//   VERIKO_API_KEY=veriko_... node node/raw/finance-cep-export.mjs 2025-03-01 2025-03-31
//
// La petición responde 202 con una exportación en `queued`. Sondéala hasta que el estado sea `ready`,
// `failed` o `expired` y luego descarga el ZIP. El archivo vence 24 horas después de quedar listo.
// El `Idempotency-Key` hace que una petición repetida reutilice la misma exportación.
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
    console.error('Uso: node finance-cep-export.mjs <desde AAAA-MM-DD> <hasta AAAA-MM-DD>');
    process.exit(2);
  }

  const created = await withRetry(() =>
    api('POST', '/finance/ceps/exports', {
      headers: { 'Idempotency-Key': `ejemplo-exportacion-cep-${from}-${to}` },
      body: { from, to },
    }),
  );
  const { id } = created.body.data;

  for (;;) {
    const { body } = await withRetry(() => api('GET', `/finance/ceps/exports/${id}`));
    const { status, error_code: errorCode } = body.data.attributes;
    if (CEP_EXPORT_TERMINAL_STATUSES.has(status)) {
      if (status !== 'ready') throw new Error(`La exportación ${id} terminó como ${status} ${errorCode ?? ''}`);
      break;
    }
    console.error(`Exportación ${id}: ${status}`);
    await sleep(5000);
  }

  const zip = await api('GET', `/finance/ceps/exports/${id}/download`, { binary: true, timeoutMs: 120_000 });
  await writeFile(`ceps-${from}-${to}.zip`, zip.body);
  console.log(`Guardado ceps-${from}-${to}.zip`);
});
