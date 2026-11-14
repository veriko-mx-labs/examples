<?php
// Pone en cola la validación de un comprobante (`POST /validate-ocr?async=1`) y sondea hasta que sea final.
//
//   VERIKO_API_KEY=veriko_... php php/enqueue-ocr-and-poll.php ruta/al/comprobante.png
//
// El argumento es un archivo local o una URL HTTPS. Con varias `candidate_accounts`, la validación
// sigue consumiendo una sola unidad de cuota. Cada validación aceptada consume cuota, y un
// comprobante que no se puede leer también se cobra.
//
// veriko:operation POST /validate-ocr?async=1 query=async body=image,image_url,candidate_accounts,client_ref
// veriko:operation GET /validations/{id}

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function () use ($argv): void {
    $source = $argv[1] ?? null;
    if ($source === null) {
        fwrite(STDERR, "Uso: php enqueue-ocr-and-poll.php <archivo del comprobante o URL https>\n");
        exit(2);
    }

    $body = str_starts_with($source, 'https://')
        ? ['image_url' => $source]
        : ['image' => base64_encode((string) file_get_contents($source))];
    $body['client_ref'] = 'comprobante-ejemplo-1';
    // Cuando el comprobante no muestra la cuenta, envía las candidatas (valores de ejemplo):
    // $body['candidate_accounts'] = ['012180004412345678', '002010077777777771'];

    $queued = api('POST', '/validate-ocr', ['query' => ['async' => 1], 'body' => $body])['body'];
    $id = $queued['data']['id'];
    fwrite(STDERR, "En cola {$id}\n");

    $validation = poll_validation($id, $queued['data']['attributes']['expires_at'] ?? null);
    echo $id, ' ', $validation['data']['attributes']['status'], "\n";
});
