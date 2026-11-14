<?php
// Valida una transferencia SPEI por sus campos y espera el veredicto en la misma petición.
//
//   VERIKO_API_KEY=veriko_... php php/validate.php
//
// Cada validación aceptada consume cuota, también la que termina en `not_found`.
// La transferencia de abajo es de ejemplo: no existe en Banxico, así que espera `not_found`.
// Cámbiala por una transferencia real para obtener `valid`.
//
// veriko:operation POST /validate body=send_date,amount,tracking_key,sender_bank,beneficiary_account
// veriko:operation GET /validations/{id}

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function (): void {
    $response = api('POST', '/validate', [
        'timeout' => SYNC_TIMEOUT,
        'body' => [
            'send_date'           => '2025-03-15',
            'amount'              => 15000.50,
            'tracking_key'        => 'MXBA20250315001234',
            'sender_bank'         => '40012', // clave SPEI o nombre del banco
            'beneficiary_account' => '012180004412345678',
        ],
    ]);

    $validation = $response['body'];
    if ($response['status'] === 202) {
        // Banxico tardó más de 45 s: la validación sigue en segundo plano.
        echo "Sigue en {$validation['data']['attributes']['status']} ({$validation['meta']['async_reason']}); sondeando.\n";
        $validation = poll_validation($validation['data']['id'], $validation['data']['attributes']['expires_at'] ?? null);
    }

    echo $validation['data']['id'], ' ', $validation['data']['attributes']['status'], "\n";
    if (!empty($validation['data']['links']['cep_pdf'])) {
        echo 'CEP disponible: ', $validation['data']['links']['cep_pdf'], "\n";
    }
});
