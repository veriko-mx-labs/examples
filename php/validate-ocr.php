<?php
// Validate a SPEI transfer from its receipt: an image or a PDF of 1 to 3 pages.
//
//   VERIKO_API_KEY=veriko_... php php/validate-ocr.php path/to/receipt.png
//   VERIKO_API_KEY=veriko_... php php/validate-ocr.php https://example.com/receipt.png
//
// The argument is a local file (sent as base64) or an HTTPS URL (sent as `image_url`).
// Every accepted validation consumes quota. A receipt that is unreadable or is not a SPEI
// receipt is rejected with 422 (`image_not_readable_receipt`, `image_not_spei_receipt`) and
// the validation is still charged.
//
// veriko:operation POST /validate-ocr body=image,image_url,beneficiary_account
// veriko:operation GET /validations/{id}

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function () use ($argv): void {
    $source = $argv[1] ?? null;
    if ($source === null) {
        fwrite(STDERR, "Usage: php validate-ocr.php <receipt file or https URL>\n");
        exit(2);
    }

    $body = str_starts_with($source, 'https://')
        ? ['image_url' => $source]
        : ['image' => base64_encode((string) file_get_contents($source))];
    // Send the account when the receipt hides it or shows it incomplete (example value):
    // $body['beneficiary_account'] = '012180004412345678';

    $response = api('POST', '/validate-ocr', ['timeout' => SYNC_TIMEOUT, 'body' => $body]);

    $validation = $response['body'];
    if ($response['status'] === 202) {
        $validation = poll_validation($validation['data']['id'], $validation['data']['attributes']['expires_at'] ?? null);
    }
    echo $validation['data']['id'], ' ', $validation['data']['attributes']['status'], "\n";
});
