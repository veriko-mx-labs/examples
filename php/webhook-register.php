<?php
// Registra un endpoint de webhook, envía una entrega de prueba y muestra su historial de entregas.
//
//   VERIKO_API_KEY=veriko_... php php/webhook-register.php https://example.com/hooks/veriko [--delete]
//
// La URL debe ser una dirección HTTPS pública que responda 2xx: mientras pruebas, corre
// `webhook-receiver.php` detrás de un túnel. La respuesta trae el `secret` de firma una sola vez;
// guárdalo como VERIKO_WEBHOOK_SECRET para el receptor. El endpoint se suscribe a los siete
// eventos de validación, así que `validation.returned` avisa de una devolución posterior.
//
// veriko:operation POST /webhooks body=url,events,description
// veriko:operation POST /webhooks/{id}/test
// veriko:operation GET /webhooks/{id}/deliveries query=per_page
// veriko:operation DELETE /webhooks/{id}

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function () use ($argv): void {
    $url = $argv[1] ?? null;
    if ($url === null) {
        fwrite(STDERR, "Uso: php webhook-register.php <URL https pública> [--delete]\n");
        exit(2);
    }

    $created = api('POST', '/webhooks', ['body' => [
        'url' => $url,
        'description' => 'Endpoint de ejemplo',
        'events' => [
            'validation.completed',
            'validation.failed',
            'validation.error',
            'validation.returned',
            'validation.retry.scheduled',
            'validation.retry.resolved',
            'validation.retry.exhausted',
        ],
    ]])['body']['data'];
    $id = $created['id'];
    echo "Endpoint {$id}\n";
    echo "Secreto (se muestra una vez): {$created['attributes']['secret']}\n";

    // La prueba responde 200 aunque la entrega falle: revisa `delivered`.
    $result = api('POST', "/webhooks/{$id}/test")['body']['data']['attributes'];
    echo 'Prueba delivered=', $result['delivered'] ? 'true' : 'false', ' http_status=', $result['http_status'] ?? '-', ' ', $result['error'] ?? '', "\n";

    $deliveries = api('GET', "/webhooks/{$id}/deliveries", ['query' => ['per_page' => 5]])['body']['data'];
    foreach ($deliveries as $delivery) {
        echo $delivery['id'], ' ', $delivery['attributes']['status'], "\n";
    }

    if (in_array('--delete', $argv, true)) {
        api('DELETE', "/webhooks/{$id}");
        echo "Eliminado {$id}\n";
    }
});
