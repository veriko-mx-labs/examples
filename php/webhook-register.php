<?php
// Register a webhook endpoint, send a test delivery and show its delivery history.
//
//   VERIKO_API_KEY=veriko_... php php/webhook-register.php https://example.com/hooks/veriko [--delete]
//
// The URL must be a public HTTPS address that answers 2xx: run `webhook-receiver.php` behind a
// tunnel while you try it. The response carries the signing `secret` once; store it
// as VERIKO_WEBHOOK_SECRET for the receiver. The endpoint subscribes to all seven validation
// events, so `validation.returned` reports a later return.
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
        fwrite(STDERR, "Usage: php webhook-register.php <public https URL> [--delete]\n");
        exit(2);
    }

    $created = api('POST', '/webhooks', ['body' => [
        'url' => $url,
        'description' => 'Example endpoint',
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
    echo "Secret (shown once): {$created['attributes']['secret']}\n";

    // The test returns 200 even when delivery failed: check `delivered`.
    $result = api('POST', "/webhooks/{$id}/test")['body']['data']['attributes'];
    echo 'Test delivered=', $result['delivered'] ? 'true' : 'false', ' http_status=', $result['http_status'] ?? '-', ' ', $result['error'] ?? '', "\n";

    $deliveries = api('GET', "/webhooks/{$id}/deliveries", ['query' => ['per_page' => 5]])['body']['data'];
    foreach ($deliveries as $delivery) {
        echo $delivery['id'], ' ', $delivery['attributes']['status'], "\n";
    }

    if (in_array('--delete', $argv, true)) {
        api('DELETE', "/webhooks/{$id}");
        echo "Deleted {$id}\n";
    }
});
