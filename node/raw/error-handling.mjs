// Handle API errors: check the HTTP status first, branch on `errors[].code`, show `detail` and `hint`.
//
//   VERIKO_API_KEY=veriko_... node node/raw/error-handling.mjs
//
// This script sends an invalid request on purpose (a `422`). The API rejects it before it
// reaches Banxico, so it consumes no quota.
// Branch on `code`: it is stable and never translated. `detail` changes with the
// `Accept-Language` header and may be reworded, so show it but do not compare it.
//
// veriko:operation POST /validate body=amount,beneficiary_account

import { ApiError, SYNC_TIMEOUT_MS, api, run } from './client.mjs';

run(async () => {
  try {
    // Neither `tracking_key` nor `numeric_reference`: the API cannot look the payment up.
    await api('POST', '/validate', { timeoutMs: SYNC_TIMEOUT_MS, body: { amount: 100, beneficiary_account: '012180004412345678' } });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error; // a timeout or a network failure
    // A 422 lists a summary entry and then one entry per invalid field: read the whole array.
    for (const entry of error.errors) {
      console.log(`${entry.code}${entry.source?.pointer ? ` at ${entry.source.pointer}` : ''}: ${entry.detail}`);
    }
    switch (error.code) {
      case 'quota_exceeded':
        console.log('The plan quota is spent. Do not retry; upgrade the plan or wait for the renewal.');
        break;
      case 'rate_limit_exceeded':
        console.log(`Rate limited. Retry after ${error.retryAfter ?? 60} s.`);
        break;
      default:
        console.log(`Request ${error.requestId ?? 'unknown'} failed with HTTP ${error.status}.`);
    }
    process.exitCode = 1;
  }
});
