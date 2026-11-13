<?php
// Read and update the account retry policy, which re-queries validations that ended without a verdict.
//
//   VERIKO_API_KEY=veriko_... php php/retry-policy.php
//
// A retry belongs to the original validation and consumes no extra quota. The update replaces the
// whole policy; `max_retries` and `interval_seconds` have per-plan caps (`422 retry_policy_invalid`
// above them). The policy applies to validations created afterwards.
//
// veriko:operation GET /users/me/retry-policy
// veriko:operation PUT /users/me/retry-policy headers=Idempotency-Key body=retry_policy,enabled,max_retries,interval_seconds,outcomes

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function (): void {
    $current = api('GET', '/users/me/retry-policy')['body'];
    echo 'Current: ', json_encode($current['data']['attributes']), "\n";
    echo 'Plan caps: ', json_encode($current['meta']['caps'] ?? null), "\n";

    $updated = with_retry(fn () => api('PUT', '/users/me/retry-policy', [
        'headers' => ['Idempotency-Key' => 'example-retry-policy-v1'],
        'body' => [
            'retry_policy' => [
                'enabled'          => true,
                'max_retries'      => 3,
                'interval_seconds' => 600, // 300 to 86400
                'outcomes'         => ['not_found', 'cep_unavailable', 'error'],
            ],
        ],
    ]))['body'];
    echo 'Updated: ', json_encode($updated['data']['attributes']), "\n";
});
