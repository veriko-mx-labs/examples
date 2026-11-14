// Pone en cola la validación de un comprobante (`POST /validate-ocr?async=1`) y sondea hasta que sea final.
//
//   VERIKO_API_KEY=veriko_... node node/raw/enqueue-ocr-and-poll.mjs ruta/al/comprobante.png
//
// El argumento es un archivo local o una URL HTTPS. Con varias `candidate_accounts`, la validación
// sigue consumiendo una sola unidad de cuota. Cada validación aceptada consume cuota, y un
// comprobante que no se puede leer también se cobra.
//
// veriko:operation POST /validate-ocr?async=1 query=async body=image,image_url,candidate_accounts,client_ref
// veriko:operation GET /validations/{id}

import { readFile } from 'node:fs/promises';

import { api, pollValidation, run } from './client.mjs';

run(async () => {
  const source = process.argv[2];
  if (!source) {
    console.error('Uso: node enqueue-ocr-and-poll.mjs <archivo del comprobante o URL https>');
    process.exit(2);
  }

  const body = /^https:\/\//u.test(source)
    ? { image_url: source }
    : { image: (await readFile(source)).toString('base64') };
  body.client_ref = 'comprobante-ejemplo-1';
  // Cuando el comprobante no muestra la cuenta, envía las candidatas (valores de ejemplo):
  // body.candidate_accounts = ['012180004412345678', '002010077777777771'];

  const queued = await api('POST', '/validate-ocr', { query: { async: 1 }, body });
  const { id, attributes } = queued.body.data;
  console.error(`En cola ${id}`);

  const validation = await pollValidation(id, { expiresAt: attributes.expires_at });
  console.log(`${id} ${validation.data.attributes.status}`);
});
