// Descarga el CEP de una validación como archivo PDF o XML.
//
//   VERIKO_API_KEY=veriko_... node node/raw/download-cep.mjs <id de la validación> [pdf|xml]
//
// El CEP existe sólo cuando la validación es `valid` o `returned`. En otro caso la API responde 404
// `cep_not_available`. Una validación purgada responde 410 y un formato desconocido, 400
// `invalid_export_format`.
//
// veriko:operation GET /validations/{id}/cep query=format

import { writeFile } from 'node:fs/promises';

import { ApiError, api, run } from './client.mjs';

run(async () => {
  const [id, format = 'pdf'] = process.argv.slice(2);
  if (!id) {
    console.error('Uso: node download-cep.mjs <id de la validación> [pdf|xml]');
    process.exit(2);
  }

  try {
    const response = await api('GET', `/validations/${id}/cep`, { query: { format }, binary: true });
    const file = `cep-${id}.${format}`;
    await writeFile(file, response.body);
    console.log(`Guardado ${file} (${response.headers.get('content-type')}, ${response.body.length} bytes)`);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'cep_not_available') {
      console.error('Banxico todavía no tiene CEP para esta validación.');
      process.exit(1);
    }
    throw error;
  }
});
