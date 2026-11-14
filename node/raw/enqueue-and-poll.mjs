// Pone en cola una validación por sus campos y sondea hasta que el veredicto sea final.
//
//   VERIKO_API_KEY=veriko_... node node/raw/enqueue-and-poll.mjs
//
// `?async=1` responde 202 de inmediato. El sondeo espera `Retry-After` segundos entre peticiones,
// devuelve el ETag en `If-None-Match` y se detiene en el estado final o en `expires_at`.
// Cada validación aceptada consume cuota. La transferencia es de ejemplo: espera `not_found`.
//
// veriko:operation POST /validate?async=1 query=async body=send_date,amount,tracking_key,sender_bank,beneficiary_account,client_ref
// veriko:operation GET /validations/{id}

import { api, pollValidation, run } from './client.mjs';

run(async () => {
  const queued = await api('POST', '/validate', {
    query: { async: 1 },
    body: {
      send_date: '2025-03-15',
      amount: 15000.5,
      tracking_key: 'MXBA20250315001234',
      sender_bank: '40012',
      beneficiary_account: '012180004412345678',
      client_ref: 'pedido-ejemplo-1', // vuelve en la validación y en los webhooks
    },
  });
  const { id, attributes } = queued.body.data;
  console.error(`En cola ${id}; el primer sondeo toca en ${queued.body.meta?.next_poll_after_seconds ?? 2} s.`);

  const validation = await pollValidation(id, { expiresAt: attributes.expires_at });
  console.log(`${id} ${validation.data.attributes.status}`);
});
