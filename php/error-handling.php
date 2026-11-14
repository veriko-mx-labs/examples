<?php
// Maneja los errores de la API: revisa primero el estado HTTP, decide con `errors[].code` y muestra `detail` y `hint`.
//
//   VERIKO_API_KEY=veriko_... php php/error-handling.php
//
// Este script envía a propósito una petición inválida (un `422`). La API la rechaza antes de
// llegar a Banxico, así que no consume cuota.
// Decide con `code`: es estable y nunca se traduce. `detail` cambia con la cabecera
// `Accept-Language` y puede reformularse, así que muéstralo pero no lo compares.
//
// veriko:operation POST /validate body=amount,beneficiary_account

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function (): void {
    try {
        // No trae `tracking_key` ni `numeric_reference`: la API no puede buscar el pago.
        api('POST', '/validate', ['timeout' => SYNC_TIMEOUT, 'body' => ['amount' => 100, 'beneficiary_account' => '012180004412345678']]);
    } catch (ApiError $error) {
        if ($error->transport) {
            throw $error; // un tiempo límite agotado o una falla de red
        }
        // Un 422 trae una entrada de resumen y luego una por cada campo inválido: lee todo el arreglo.
        foreach ($error->errors as $entry) {
            $pointer = $entry['source']['pointer'] ?? null;
            echo $entry['code'], $pointer ? " en {$pointer}" : '', ': ', $entry['detail'], "\n";
        }
        switch ($error->errorCode) {
            case 'quota_exceeded':
                echo "Se agotó la cuota del plan. No reintentes; cambia de plan o espera a la renovación.\n";
                break;
            case 'rate_limit_exceeded':
                echo 'Límite de tasa alcanzado. Reintenta en ', $error->retryAfter ?? 60, " s.\n";
                break;
            default:
                echo 'La petición ', $error->requestId ?? 'desconocida', " falló con HTTP {$error->status}.\n";
        }
        exit(1);
    }
});
