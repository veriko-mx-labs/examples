<?php
// Exporta en un ZIP los archivos de CEP de un rango de fechas, armado en segundo plano.
//
//   VERIKO_API_KEY=veriko_... php php/finance-cep-export.php 2025-03-01 2025-03-31
//
// La petición responde 202 con una exportación en `queued`. Sondéala hasta que el estado sea `ready`,
// `failed` o `expired` y luego descarga el ZIP. El archivo vence 24 horas después de quedar listo.
// El `Idempotency-Key` hace que una petición repetida reutilice la misma exportación.
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
        fwrite(STDERR, "Uso: php finance-cep-export.php <desde AAAA-MM-DD> <hasta AAAA-MM-DD>\n");
        exit(2);
    }

    $created = with_retry(fn () => api('POST', '/finance/ceps/exports', [
        'headers' => ['Idempotency-Key' => "ejemplo-exportacion-cep-{$from}-{$to}"],
        'body' => ['from' => $from, 'to' => $to],
    ]))['body'];
    $id = $created['data']['id'];

    for (;;) {
        $attributes = with_retry(fn () => api('GET', "/finance/ceps/exports/{$id}"))['body']['data']['attributes'];
        if (in_array($attributes['status'], CEP_EXPORT_TERMINAL_STATUSES, true)) {
            if ($attributes['status'] !== 'ready') {
                throw new RuntimeException("La exportación {$id} terminó como {$attributes['status']} " . ($attributes['error_code'] ?? ''));
            }
            break;
        }
        fwrite(STDERR, "Exportación {$id}: {$attributes['status']}\n");
        sleep(5);
    }

    $archive = api('GET', "/finance/ceps/exports/{$id}/download", ['binary' => true, 'timeout' => 120]);
    file_put_contents("ceps-{$from}-{$to}.zip", $archive['body']);
    echo "Guardado ceps-{$from}-{$to}.zip\n";
});
