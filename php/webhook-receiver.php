<?php
// Receive Veriko webhooks: verify the timestamped signature, reject stale deliveries, deduplicate.
//
//   VERIKO_WEBHOOK_SECRET=<secret from POST /webhooks> php -S 0.0.0.0:3000 php/webhook-receiver.php
//
// Optional: VERIKO_WEBHOOK_SECRET_PREVIOUS keeps the receiver working for the 24 hours after you
// rotate the secret, because the API then also sends `X-Webhook-Signature-Old`, signed with the
// previous secret.
//
// The signature covers the body exactly as received, so the receiver reads the raw bytes and
// parses the JSON only after the check. `t` must be within 5 minutes of this machine's clock:
// the window applies to `t`, the time of that attempt, not to the `timestamp` in the body,
// because a retry arrives up to about 8.6 hours after the event with a new `t`.
//
// veriko:receiver

declare(strict_types=1);

const TOLERANCE_SECONDS = 300;

/** `$header` is `t=<seconds>,v1=<hex>`. True when `v1` matches HMAC-SHA256 of `<t>.<body>` and `t` is in the window. */
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
    error_log('Set VERIKO_WEBHOOK_SECRET to the secret returned when you registered the endpoint.');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$rawBody = (string) file_get_contents('php://input');
$authentic = verify_timestamped($rawBody, $_SERVER['HTTP_X_WEBHOOK_SIGNATURE_TIMESTAMPED'] ?? null, $secret)
    // During a rotation, a delivery queued before the change carries the old signature.
    || ($previousSecret !== null && verify_timestamped($rawBody, $_SERVER['HTTP_X_WEBHOOK_SIGNATURE_OLD'] ?? null, $previousSecret));
if (!$authentic) {
    http_response_code(401); // a 4xx other than 408 and 429 is not retried
    exit;
}

// Deduplicate by delivery id: a retry repeats the same delivery. Use a shared store with a
// 24-hour expiry in production; this sketch keeps ids in a temporary directory.
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
// Before releasing goods on `valid`, compare `$attributes['banxico_confirmed']` (amount, account) with your order.
