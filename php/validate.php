<?php
// Valida una transferencia SPEI con los datos exactos (sin OCR de imagen).
// Requiere: VERIKO_API_KEY en el entorno. Referencia completa: https://docs.veriko.mx/openapi.yaml
// Uso: VERIKO_API_KEY=veriko_... php validate.php

declare(strict_types=1);

$apiKey = getenv('VERIKO_API_KEY');
if ($apiKey === false || $apiKey === '') {
    fwrite(STDERR, "Falta la variable de entorno VERIKO_API_KEY (empieza con veriko_).\n");
    exit(1);
}

$ch = curl_init('https://api.veriko.mx/v1/validate');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        "Authorization: Bearer {$apiKey}",
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'fecha'               => '2025-03-15',
        'monto'               => 15000.50,
        'clave_rastreo'       => 'MXBA20250315001234',
        'cuenta_beneficiaria' => '012180004412345678',
    ]),
]);

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$body = json_decode((string) $response, true);
if ($status >= 400) {
    fwrite(STDERR, "HTTP {$status}: " . json_encode($body['errors'] ?? $body) . "\n");
    exit(1);
}

echo $body['data']['attributes']['status'], "\n"; // "valid"
