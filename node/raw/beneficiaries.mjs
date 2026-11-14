// Crea, lista, actualiza y elimina la cuenta de un beneficiario guardado.
//
//   VERIKO_API_KEY=veriko_... node node/raw/beneficiaries.mjs
//
// Un beneficiario ayuda a que la validación por comprobante complete una cuenta que la imagen
// muestra enmascarada. La cuenta de abajo es de ejemplo; eliminar archiva al beneficiario. Las
// llamadas de beneficiarios no consumen cuota.
//
// veriko:operation POST /beneficiaries body=account_number,bank_code,label
// veriko:operation GET /beneficiaries
// veriko:operation PUT /beneficiaries/{id} body=label
// veriko:operation DELETE /beneficiaries/{id}

import { api, run } from './client.mjs';

run(async () => {
  const created = await api('POST', '/beneficiaries', {
    body: { account_number: '012180004412345678', bank_code: '40012', label: 'Proveedor de ejemplo' },
  });
  const { id } = created.body.data;
  console.log(`Creado ${id}`);

  const list = await api('GET', '/beneficiaries');
  console.log(`${list.body.data.length} beneficiarios`);

  await api('PUT', `/beneficiaries/${id}`, { body: { label: 'Proveedor de ejemplo (con otro nombre)' } });
  console.log(`Actualizado ${id}`);

  await api('DELETE', `/beneficiaries/${id}`);
  console.log(`Eliminado ${id}`);
});
