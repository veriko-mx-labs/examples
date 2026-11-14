<?php
// Valida una transferencia SPEI a partir de su comprobante: una imagen o un PDF de 1 a 3 páginas.
//
//   VERIKO_API_KEY=veriko_... php php/validate-ocr.php ruta/al/comprobante.png
//   VERIKO_API_KEY=veriko_... php php/validate-ocr.php https://example.com/comprobante.png
//
// El argumento es un archivo local (se envía en base64) o una URL HTTPS (se envía como `image_url`).
// Cada validación aceptada consume cuota. Un comprobante que no se puede leer o que no es de SPEI
// se rechaza con 422 (`image_not_readable_receipt`, `image_not_spei_receipt`) y
// la validación se cobra de todos modos.
//
// veriko:operation POST /validate-ocr body=image,image_url,beneficiary_account
// veriko:operation GET /validations/{id}

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function () use ($argv): void {
    $source = $argv[1] ?? null;
    if ($source === null) {
        fwrite(STDERR, "Uso: php validate-ocr.php <archivo del comprobante o URL https>\n");
        exit(2);
    }

    $body = str_starts_with($source, 'https://')
        ? ['image_url' => $source]
        : ['image' => base64_encode((string) file_get_contents($source))];
    // Envía la cuenta cuando el comprobante la oculta o la muestra incompleta (valor de ejemplo):
    // $body['beneficiary_account'] = '012180004412345678';

    $response = api('POST', '/validate-ocr', ['timeout' => SYNC_TIMEOUT, 'body' => $body]);

    $validation = $response['body'];
    if ($response['status'] === 202) {
        $validation = poll_validation($validation['data']['id'], $validation['data']['attributes']['expires_at'] ?? null);
    }
    echo $validation['data']['id'], ' ', $validation['data']['attributes']['status'], "\n";
});
