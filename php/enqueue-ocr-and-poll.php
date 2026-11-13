<?php
// Enqueue a validation from a receipt (`POST /validate-ocr?async=1`) and poll until it is final.
//
//   VERIKO_API_KEY=veriko_... php php/enqueue-ocr-and-poll.php path/to/receipt.png
//
// The argument is a local file or an HTTPS URL. With several `candidate_accounts` the validation
// still consumes a single unit of quota. Every accepted validation consumes quota, and a receipt
// that cannot be read is charged too.
//
// veriko:operation POST /validate-ocr?async=1 query=async body=image,image_url,candidate_accounts,client_ref
// veriko:operation GET /validations/{id}

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function () use ($argv): void {
    $source = $argv[1] ?? null;
    if ($source === null) {
        fwrite(STDERR, "Usage: php enqueue-ocr-and-poll.php <receipt file or https URL>\n");
        exit(2);
    }

    $body = str_starts_with($source, 'https://')
        ? ['image_url' => $source]
        : ['image' => base64_encode((string) file_get_contents($source))];
    $body['client_ref'] = 'example-receipt-1';
    // When the receipt does not show the account, send the candidates instead (example values):
    // $body['candidate_accounts'] = ['012180004412345678', '002010077777777771'];

    $queued = api('POST', '/validate-ocr', ['query' => ['async' => 1], 'body' => $body])['body'];
    $id = $queued['data']['id'];
    fwrite(STDERR, "Queued {$id}\n");

    $validation = poll_validation($id, $queued['data']['attributes']['expires_at'] ?? null);
    echo $id, ' ', $validation['data']['attributes']['status'], "\n";
});
