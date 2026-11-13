// Read and update the account retry policy, which re-queries validations that ended without a verdict.
//
//   VERIKO_API_KEY=veriko_... node node/raw/retry-policy.mjs
//
// A retry belongs to the original validation and consumes no extra quota. The update replaces the
// whole policy; `max_retries` and `interval_seconds` have per-plan caps (`422 retry_policy_invalid`
// above them). The policy applies to validations created afterwards.
//
// veriko:operation GET /users/me/retry-policy
// veriko:operation PUT /users/me/retry-policy headers=Idempotency-Key body=retry_policy,enabled,max_retries,interval_seconds,outcomes

import { api, run, withRetry } from './client.mjs';

run(async () => {
  const current = await api('GET', '/users/me/retry-policy');
  console.log('Current:', JSON.stringify(current.body.data.attributes));
  console.log('Plan caps:', JSON.stringify(current.body.meta?.caps));

  const updated = await withRetry(() =>
    api('PUT', '/users/me/retry-policy', {
      headers: { 'Idempotency-Key': 'example-retry-policy-v1' },
      body: {
        retry_policy: {
          enabled: true,
          max_retries: 3,
          interval_seconds: 600, // 300 to 86400
          outcomes: ['not_found', 'cep_unavailable', 'error'],
        },
      },
    }),
  );
  console.log('Updated:', JSON.stringify(updated.body.data.attributes));
});
