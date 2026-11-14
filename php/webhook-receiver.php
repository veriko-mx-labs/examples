<?php
// Recibe los webhooks de Veriko: verifica la firma con marca de tiempo, rechaza las entregas vencidas y descarta las repetidas.
//
//   VERIKO_WEBHOOK_SECRET=<secreto de POST /webhooks> php -S 0.0.0.0:3000 php/webhook-receiver.php
//
// Opcional: VERIKO_WEBHOOK_SECRET_PREVIOUS mantiene el receptor funcionando durante las 24 horas
// posteriores a rotar el secreto, porque la API envía entonces también `X-Webhook-Signature-Old`,
// firmada con el secreto anterior.
//
// La firma cubre el cuerpo tal como llegó, así que el receptor lee los bytes sin procesar y
// analiza el JSON hasta después de la verificación. `t` debe estar a menos de 5 minutos del reloj
// de esta máquina: la ventana aplica a `t`, la hora de ese intento, y no al `timestamp` del
// cuerpo, porque un reintento llega hasta unas 8.6 horas después del evento con un `t` nuevo.
//
// veriko:receiver

declare(strict_types=1);

const TOLERANCE_SECONDS = 300;

/** `$header` es `t=<segundos>,v1=<hex>`. Devuelve true cuando `v1` coincide con el HMAC-SHA256 de `<t>.<cuerpo>` y `t` está en la ventana. */
function verify_timestamped(string $rawBody, ?string $header, string $secret): bool
{
    if ($header === null || $header === '') {
        return false;
    }
    $fields = [];
    foreach (explode(',', $header) as $part) {
        [$name, $value] = array_pad(explode('=', trim($part), 2), 2, '');
        $fields[$name] = $value;
    }
    $t = $fields['t'] ?? '';
    if (!ctype_digit($t) || abs(time() - (int) $t) > TOLERANCE_SECONDS) {
        return false;
    }
    $expected = hash_hmac('sha256', "{$t}." . $rawBody, $secret);
    return hash_equals($expected, strtolower($fields['v1'] ?? ''));
}

$secret = getenv('VERIKO_WEBHOOK_SECRET');
$previousSecret = getenv('VERIKO_WEBHOOK_SECRET_PREVIOUS') ?: null;
if ($secret === false || $secret === '') {
    http_response_code(500);
    error_log('Define VERIKO_WEBHOOK_SECRET con el secreto que recibiste al registrar el endpoint.');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$rawBody = (string) file_get_contents('php://input');
$authentic = verify_timestamped($rawBody, $_SERVER['HTTP_X_WEBHOOK_SIGNATURE_TIMESTAMPED'] ?? null, $secret)
    // Durante una rotación, una entrega que quedó en cola antes del cambio lleva la firma anterior.
    || ($previousSecret !== null && verify_timestamped($rawBody, $_SERVER['HTTP_X_WEBHOOK_SIGNATURE_OLD'] ?? null, $previousSecret));
if (!$authentic) {
    http_response_code(401); // un 4xx distinto de 408 y 429 no se reintenta
    exit;
}

// Descarta las repetidas por id de entrega: un reintento repite la misma entrega. En producción
// usa un almacén compartido con vencimiento de 24 horas; este ejemplo guarda los ids en un
// directorio temporal.
$deliveryId = $_SERVER['HTTP_X_VERIKO_DELIVERY_ID'] ?? null;
if ($deliveryId !== null) {
    $marker = sys_get_temp_dir() . '/veriko-delivery-' . hash('sha256', $deliveryId);
    if (file_exists($marker)) {
        http_response_code(200);
        exit;
    }
    touch($marker);
}

http_response_code(200);
$event = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
$attributes = $event['data']['attributes'];
error_log("{$event['event']} {$event['data']['id']} status={$attributes['status']} client_ref=" . ($attributes['client_ref'] ?? '-'));
// Antes de entregar la mercancía con `valid`, compara `$attributes['banxico_confirmed']` (monto, cuenta) con tu pedido.
