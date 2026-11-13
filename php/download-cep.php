<?php
// Download the CEP of a validation as a PDF or an XML file.
//
//   VERIKO_API_KEY=veriko_... php php/download-cep.php <validation id> [pdf|xml]
//
// The CEP exists only when the validation is `valid` or `returned`. Otherwise the API answers 404
// `cep_not_available`. A validation that was purged answers 410 and an unknown format, 400
// `invalid_export_format`.
//
// veriko:operation GET /validations/{id}/cep query=format

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function () use ($argv): void {
    $id = $argv[1] ?? null;
    $format = $argv[2] ?? 'pdf';
    if ($id === null) {
        fwrite(STDERR, "Usage: php download-cep.php <validation id> [pdf|xml]\n");
        exit(2);
    }

    try {
        $response = api('GET', "/validations/{$id}/cep", ['query' => ['format' => $format], 'binary' => true]);
    } catch (ApiError $error) {
        if ($error->errorCode === 'cep_not_available') {
            fwrite(STDERR, "Banxico has no CEP for this validation (yet).\n");
            exit(1);
        }
        throw $error;
    }
    $file = "cep-{$id}.{$format}";
    file_put_contents($file, $response['body']);
    echo "Saved {$file} ({$response['headers']['content-type']}, " . strlen($response['body']) . " bytes)\n";
});
