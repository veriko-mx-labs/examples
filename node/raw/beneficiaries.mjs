// Create, list, update and delete a saved beneficiary account.
//
//   VERIKO_API_KEY=veriko_... node node/raw/beneficiaries.mjs
//
// A beneficiary helps the receipt validation complete an account the image shows masked. The
// account below is example data; deleting archives the beneficiary. Beneficiary calls consume no
// quota.
//
// veriko:operation POST /beneficiaries body=account_number,bank_code,label
// veriko:operation GET /beneficiaries
// veriko:operation PUT /beneficiaries/{id} body=label
// veriko:operation DELETE /beneficiaries/{id}

import { api, run } from './client.mjs';

run(async () => {
  const created = await api('POST', '/beneficiaries', {
    body: { account_number: '012180004412345678', bank_code: '40012', label: 'Example supplier' },
  });
  const { id } = created.body.data;
  console.log(`Created ${id}`);

  const list = await api('GET', '/beneficiaries');
  console.log(`${list.body.data.length} beneficiaries`);

  await api('PUT', `/beneficiaries/${id}`, { body: { label: 'Example supplier (renamed)' } });
  console.log(`Updated ${id}`);

  await api('DELETE', `/beneficiaries/${id}`);
  console.log(`Deleted ${id}`);
});
