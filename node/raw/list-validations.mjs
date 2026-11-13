// Walk every page of the validation history.
//
//   VERIKO_API_KEY=veriko_... node node/raw/list-validations.mjs
//
// `per_page` accepts 1 to 50 on this listing; a larger value is clamped. Move forward with `page`
// until `meta.pagination.total_pages`. Parameters the operation does not declare are ignored without
// an error, so check the names.
// Listing consumes no quota.
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
