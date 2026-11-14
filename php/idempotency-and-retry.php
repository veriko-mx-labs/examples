<?php
// Reintenta una validación sin riesgo: un `Idempotency-Key` por intento de negocio y espera creciente ante fallas pasajeras.
//
//   VERIKO_API_KEY=veriko_... php php/idempotency-and-retry.php
//
// La clave identifica el intento, así que derívala de tu propio identificador (aquí un número de
// pedido), nunca de un valor aleatorio por envío. La API la guarda 24 horas:
//   - misma clave y mismo cuerpo: vuelve la respuesta original con `Idempotent-Replayed: true`;
//   - misma clave y cuerpo distinto: 422 `idempotency_key_reused`;
//   - misma clave mientras corre la primera petición: 409 `idempotency_key_in_progress`.
// `with_retry` repite la petición con 408, 429, 500, 502, 503, 504 y ante fallas de red, y espera
// `Retry-After` cuando viene. Nunca reintenta `quota_exceeded`: ese 429 dura hasta que el plan
// se renueva.
// La segunda llamada de abajo repite la primera: no consume más cuota. La transferencia es de
// ejemplo: espera `not_found`.
//
// veriko:operation POST /validate headers=Idempotency-Key body=send_date,amount,tracking_key,sender_bank,beneficiary_account
// veriko:operation GET /validations/{id}

declare(strict_types=1);

require __DIR__ . '/client.php';

const IDEMPOTENCY_KEY = 'pedido-ejemplo-4812-intento-1';

function send(): array
{
    return api('POST', '/validate', [
        'timeout' => SYNC_TIMEOUT,
        'headers' => ['Idempotency-Key' => IDEMPOTENCY_KEY],
        'body' => [
            'send_date'           => '2025-03-15',
            'amount'              => 15000.50,
            'tracking_key'        => 'MXBA20250315001234',
            'sender_bank'         => '40012',
            'beneficiary_account' => '012180004412345678',
        ],
    ]);
}

run(function (): void {
    foreach ([1, 2] as $attempt) {
        $response = with_retry('send');
        $replayed = ($response['headers']['idempotent-replayed'] ?? '') === 'true' ? 'true' : 'false';
        $validation = $response['body'];
        if ($response['status'] === 202) {
            $validation = poll_validation($validation['data']['id'], $validation['data']['attributes']['expires_at'] ?? null);
        }
        echo "Llamada {$attempt}: {$validation['data']['id']} {$validation['data']['attributes']['status']} replayed={$replayed}\n";
    }
});
