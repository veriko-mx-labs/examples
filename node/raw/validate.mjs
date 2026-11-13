// Validate a SPEI transfer by its fields, waiting for the verdict in the same request.
//
//   VERIKO_API_KEY=veriko_... node node/raw/validate.mjs
//
// Every accepted validation consumes quota, including one that ends in `not_found`.
// The transfer below is example data: it does not exist at Banxico, so expect `not_found`.
// Replace it with a real transfer to get `valid`.
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
      sender_bank: '40012', // SPEI code or bank name
      beneficiary_account: '012180004412345678',
    },
  });

  let validation = response.body;
  if (response.status === 202) {
    // Banxico took longer than 45 s: the validation continues in the background.
    console.error(`Still ${validation.data.attributes.status} (${validation.meta.async_reason}); polling.`);
    validation = await pollValidation(validation.data.id, { expiresAt: validation.data.attributes.expires_at });
  }

  const { id, attributes, links } = validation.data;
  console.log(`${id} ${attributes.status}`);
  if (links?.cep_pdf) console.log(`CEP available: ${links.cep_pdf}`);
});
