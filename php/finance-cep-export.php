<?php
// Export the CEP files of a date range as a ZIP, built in the background.
//
//   VERIKO_API_KEY=veriko_... php php/finance-cep-export.php 2025-03-01 2025-03-31
//
// The request answers 202 with an export in `queued`. Poll it until the status is `ready`, `failed` or
// `expired`, then download the ZIP. The file expires 24 hours after it is ready. The
// `Idempotency-Key` makes a repeated request reuse the same export.
//
// veriko:operation POST /finance/ceps/exports headers=Idempotency-Key body=from,to
// veriko:operation GET /finance/ceps/exports/{id}
// veriko:operation GET /finance/ceps/exports/{id}/download

declare(strict_types=1);

require __DIR__ . '/client.php';

const CEP_EXPORT_TERMINAL_STATUSES = ['ready', 'failed', 'expired'];

run(function () use ($argv): void {
    [, $from, $to] = $argv + [null, null, null];
    if ($from === null || $to === null) {
        fwrite(STDERR, "Usage: php finance-cep-export.php <from YYYY-MM-DD> <to YYYY-MM-DD>\n");
        exit(2);
    }

    $created = with_retry(fn () => api('POST', '/finance/ceps/exports', [
        'headers' => ['Idempotency-Key' => "example-cep-export-{$from}-{$to}"],
        'body' => ['from' => $from, 'to' => $to],
    ]))['body'];
    $id = $created['data']['id'];

    for (;;) {
        $attributes = with_retry(fn () => api('GET', "/finance/ceps/exports/{$id}"))['body']['data']['attributes'];
        if (in_array($attributes['status'], CEP_EXPORT_TERMINAL_STATUSES, true)) {
            if ($attributes['status'] !== 'ready') {
                throw new RuntimeException("Export {$id} ended as {$attributes['status']} " . ($attributes['error_code'] ?? ''));
            }
            break;
        }
        fwrite(STDERR, "Export {$id}: {$attributes['status']}\n");
        sleep(5);
    }

    $archive = api('GET', "/finance/ceps/exports/{$id}/download", ['binary' => true, 'timeout' => 120]);
    file_put_contents("ceps-{$from}-{$to}.zip", $archive['body']);
    echo "Saved ceps-{$from}-{$to}.zip\n";
});
