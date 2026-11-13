<?php
// Validate a SPEI transfer by its fields, waiting for the verdict in the same request.
//
//   VERIKO_API_KEY=veriko_... php php/validate.php
//
// Every accepted validation consumes quota, including one that ends in `not_found`.
// The transfer below is example data: it does not exist at Banxico, so expect `not_found`.
// Replace it with a real transfer to get `valid`.
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
            'sender_bank'         => '40012', // SPEI code or bank name
            'beneficiary_account' => '012180004412345678',
        ],
    ]);

    $validation = $response['body'];
    if ($response['status'] === 202) {
        // Banxico took longer than 45 s: the validation continues in the background.
        echo "Still {$validation['data']['attributes']['status']} ({$validation['meta']['async_reason']}); polling.\n";
        $validation = poll_validation($validation['data']['id'], $validation['data']['attributes']['expires_at'] ?? null);
    }

    echo $validation['data']['id'], ' ', $validation['data']['attributes']['status'], "\n";
    if (!empty($validation['data']['links']['cep_pdf'])) {
        echo 'CEP available: ', $validation['data']['links']['cep_pdf'], "\n";
    }
});
