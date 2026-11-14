<?php
// Pone en cola una validación por sus campos y sondea hasta que el veredicto sea final.
//
//   VERIKO_API_KEY=veriko_... php php/enqueue-and-poll.php
//
// `?async=1` responde 202 de inmediato. El sondeo espera `Retry-After` segundos entre peticiones,
// devuelve el ETag en `If-None-Match` y se detiene en el estado final o en `expires_at`.
// Cada validación aceptada consume cuota. La transferencia es de ejemplo: espera `not_found`.
//
// veriko:operation POST /validate?async=1 query=async body=send_date,amount,tracking_key,sender_bank,beneficiary_account,client_ref
// veriko:operation GET /validations/{id}

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function (): void {
    $queued = api('POST', '/validate', [
        'query' => ['async' => 1],
        'body' => [
            'send_date'           => '2025-03-15',
            'amount'              => 15000.50,
            'tracking_key'        => 'MXBA20250315001234',
            'sender_bank'         => '40012',
            'beneficiary_account' => '012180004412345678',
            'client_ref'          => 'pedido-ejemplo-1', // vuelve en la validación y en los webhooks
        ],
    ])['body'];
    $id = $queued['data']['id'];
    fwrite(STDERR, "En cola {$id}; el primer sondeo toca en " . ($queued['meta']['next_poll_after_seconds'] ?? 2) . " s.\n");

    $validation = poll_validation($id, $queued['data']['attributes']['expires_at'] ?? null);
    echo $id, ' ', $validation['data']['attributes']['status'], "\n";
});
