<?php
// Descarga el CEP de una validación como archivo PDF o XML.
//
//   VERIKO_API_KEY=veriko_... php php/download-cep.php <id de la validación> [pdf|xml]
//
// El CEP existe sólo cuando la validación es `valid` o `returned`. En otro caso la API responde 404
// `cep_not_available`. Una validación purgada responde 410 y un formato desconocido, 400
// `invalid_export_format`.
//
// veriko:operation GET /validations/{id}/cep query=format

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function () use ($argv): void {
    $id = $argv[1] ?? null;
    $format = $argv[2] ?? 'pdf';
    if ($id === null) {
        fwrite(STDERR, "Uso: php download-cep.php <id de la validación> [pdf|xml]\n");
        exit(2);
    }

    try {
        $response = api('GET', "/validations/{$id}/cep", ['query' => ['format' => $format], 'binary' => true]);
    } catch (ApiError $error) {
        if ($error->errorCode === 'cep_not_available') {
            fwrite(STDERR, "Banxico todavía no tiene CEP para esta validación.\n");
            exit(1);
        }
        throw $error;
    }
    $file = "cep-{$id}.{$format}";
    file_put_contents($file, $response['body']);
    echo "Guardado {$file} ({$response['headers']['content-type']}, " . strlen($response['body']) . " bytes)\n";
});
