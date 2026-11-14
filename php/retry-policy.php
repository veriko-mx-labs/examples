<?php
// Consulta y actualiza la política de reintentos de la cuenta, que vuelve a consultar las validaciones que terminaron sin veredicto.
//
//   VERIKO_API_KEY=veriko_... php php/retry-policy.php
//
// Un reintento pertenece a la validación original y no consume cuota extra. La actualización
// reemplaza toda la política; `max_retries` e `interval_seconds` tienen topes por plan
// (`422 retry_policy_invalid` si los rebasas). La política aplica a las validaciones que se
// creen después.
//
// veriko:operation GET /users/me/retry-policy
// veriko:operation PUT /users/me/retry-policy headers=Idempotency-Key body=retry_policy,enabled,max_retries,interval_seconds,outcomes

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function (): void {
    $current = api('GET', '/users/me/retry-policy')['body'];
    echo 'Actual: ', json_encode($current['data']['attributes']), "\n";
    echo 'Topes del plan: ', json_encode($current['meta']['caps'] ?? null), "\n";

    $updated = with_retry(fn () => api('PUT', '/users/me/retry-policy', [
        'headers' => ['Idempotency-Key' => 'ejemplo-politica-reintentos-v1'],
        'body' => [
            'retry_policy' => [
                'enabled'          => true,
                'max_retries'      => 3,
                'interval_seconds' => 600, // de 300 a 86400
                'outcomes'         => ['not_found', 'cep_unavailable', 'error'],
            ],
        ],
    ]))['body'];
    echo 'Actualizada: ', json_encode($updated['data']['attributes']), "\n";
});
