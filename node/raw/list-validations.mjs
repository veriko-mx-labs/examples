// Recorre todas las páginas del historial de validaciones.
//
//   VERIKO_API_KEY=veriko_... node node/raw/list-validations.mjs
//
// `per_page` acepta de 1 a 50 en este listado; un valor mayor se ajusta al tope. Avanza con `page`
// hasta `meta.pagination.total_pages`. Los parámetros que la operación no declara se ignoran sin
// error, así que revisa los nombres.
// Listar no consume cuota.
//
// veriko:operation GET /validations query=page,per_page,from,to

import { api, run, withRetry } from './client.mjs';

run(async () => {
  let page = 1;
  let totalPages = 1;
  do {
    const response = await withRetry(() =>
      api('GET', '/validations', { query: { page, per_page: 50, from: '2025-01-01', to: '2025-12-31' } }),
    );
    for (const item of response.body.data) {
      console.log(`${item.id} ${item.attributes.status}`);
    }
    totalPages = response.body.meta.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);
});
