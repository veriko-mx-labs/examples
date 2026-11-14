// Valida una transferencia SPEI a partir de la imagen o el PDF de un comprobante con el SDK de Node.
//
//   cd node/sdk && npm install
//   VERIKO_API_KEY=veriko_... node validate-ocr.mjs ruta/al/comprobante.png
//
// El SDK lee el archivo y lo envía en base64. Cada validación aceptada consume cuota, y un
// comprobante que no se puede leer también se cobra.
//
// veriko:operation POST /validate-ocr

import { Veriko } from '@veriko-mx/sdk';

const receipt = process.argv[2];
if (!receipt) {
  console.error('Uso: node validate-ocr.mjs <archivo del comprobante>');
  process.exit(2);
}

const client = new Veriko();

try {
  const validation = await client.validations.validateOcr({ image: receipt });
  console.log(validation.id, validation.attributes.status);
} catch (error) {
  console.error(error.code ?? error.name, error.message);
  process.exit(1);
}
