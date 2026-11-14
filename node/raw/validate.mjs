// Valida una transferencia SPEI por sus campos y espera el veredicto en la misma petición.
//
//   VERIKO_API_KEY=veriko_... node node/raw/validate.mjs
//
// Cada validación aceptada consume cuota, también la que termina en `not_found`.
// La transferencia de abajo es de ejemplo: no existe en Banxico, así que espera `not_found`.
// Cámbiala por una transferencia real para obtener `valid`.
//
// veriko:operation POST /validate body=send_date,amount,tracking_key,sender_bank,beneficiary_account
// veriko:operation GET /validations/{id}

import { api, pollValidation, run, SYNC_TIMEOUT_MS } from './client.mjs';

run(async () => {
  const response = await api('POST', '/validate', {
    timeoutMs: SYNC_TIMEOUT_MS,
    body: {
      send_date: '2025-03-15',
      amount: 15000.5,
      tracking_key: 'MXBA20250315001234',
      sender_bank: '40012', // clave SPEI o nombre del banco
      beneficiary_account: '012180004412345678',
    },
  });

  let validation = response.body;
  if (response.status === 202) {
    // Banxico tardó más de 45 s: la validación sigue en segundo plano.
    console.error(`Sigue en ${validation.data.attributes.status} (${validation.meta.async_reason}); sondeando.`);
    validation = await pollValidation(validation.data.id, { expiresAt: validation.data.attributes.expires_at });
  }

  const { id, attributes, links } = validation.data;
  console.log(`${id} ${attributes.status}`);
  if (links?.cep_pdf) console.log(`CEP disponible: ${links.cep_pdf}`);
});
