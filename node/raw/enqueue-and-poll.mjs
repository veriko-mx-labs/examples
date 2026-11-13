// Enqueue a validation by its fields and poll until the verdict is final.
//
//   VERIKO_API_KEY=veriko_... node node/raw/enqueue-and-poll.mjs
//
// `?async=1` answers 202 at once. The poll waits `Retry-After` seconds between requests, sends the
// ETag back in `If-None-Match`, and stops at the final status or at `expires_at`.
// Every accepted validation consumes quota. The transfer is example data: expect `not_found`.
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
      client_ref: 'example-order-1', // comes back on the validation and in webhooks
    },
  });
  const { id, attributes } = queued.body.data;
  console.error(`Queued ${id}; the first poll is due in ${queued.body.meta?.next_poll_after_seconds ?? 2} s.`);

  const validation = await pollValidation(id, { expiresAt: attributes.expires_at });
  console.log(`${id} ${validation.data.attributes.status}`);
});
