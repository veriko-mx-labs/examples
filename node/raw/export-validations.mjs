// Exporta el historial de validaciones como un archivo CSV.
//
//   VERIKO_API_KEY=veriko_... node node/raw/export-validations.mjs
//
// `format` acepta `csv` y `xlsx` (`csv` por defecto). La respuesta es un archivo adjunto; un
// error llega como JSON. Exportar no consume cuota.
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
  console.log(`Guardado validations.csv (${response.body.length} bytes)`);
});
