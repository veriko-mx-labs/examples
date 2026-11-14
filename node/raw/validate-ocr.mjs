// Valida una transferencia SPEI a partir de su comprobante: una imagen o un PDF de 1 a 3 páginas.
//
//   VERIKO_API_KEY=veriko_... node node/raw/validate-ocr.mjs ruta/al/comprobante.png
//   VERIKO_API_KEY=veriko_... node node/raw/validate-ocr.mjs https://example.com/comprobante.png
//
// El argumento es un archivo local (se envía en base64) o una URL HTTPS (se envía como `image_url`).
// Cada validación aceptada consume cuota. Un comprobante que no se puede leer o que no es de SPEI
// se rechaza con 422 (`image_not_readable_receipt`, `image_not_spei_receipt`) y
// la validación se cobra de todos modos.
//
// veriko:operation POST /validate-ocr body=image,image_url,beneficiary_account
// veriko:operation GET /validations/{id}

import { readFile } from 'node:fs/promises';

import { api, pollValidation, run, SYNC_TIMEOUT_MS } from './client.mjs';

run(async () => {
  const source = process.argv[2];
  if (!source) {
    console.error('Uso: node validate-ocr.mjs <archivo del comprobante o URL https>');
    process.exit(2);
  }

  const body = /^https:\/\//u.test(source)
    ? { image_url: source }
    : { image: (await readFile(source)).toString('base64') };
  // Envía la cuenta cuando el comprobante la oculta o la muestra incompleta (valor de ejemplo):
  // body.beneficiary_account = '012180004412345678';

  const response = await api('POST', '/validate-ocr', { timeoutMs: SYNC_TIMEOUT_MS, body });

  let validation = response.body;
  if (response.status === 202) {
    validation = await pollValidation(validation.data.id, { expiresAt: validation.data.attributes.expires_at });
  }
  console.log(`${validation.data.id} ${validation.data.attributes.status}`);
});
