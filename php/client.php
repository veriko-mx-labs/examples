<?php
// Funciones compartidas de los ejemplos de PHP: PHP 8.1 o posterior con la extensión curl, sin paquetes.
// Lee la clave de VERIKO_API_KEY, envía cada petición con un tiempo límite, revisa el estado
// HTTP antes de analizar el cuerpo y convierte cualquier respuesta de error en un `ApiError`.
// veriko:operation GET /validations/{id} headers=If-None-Match

declare(strict_types=1);

// Estados en los que la validación es final: deja de sondear cuando `data.attributes.status` es uno de ellos.
const TERMINAL_STATUSES = ['valid', 'not_found', 'cep_unavailable', 'invalid', 'returned', 'failed', 'error'];
// Estados que vale la pena reintentar: la falla es del momento, no de la petición.
const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
// La validación síncrona puede mantener la conexión abierta hasta cerca de un minuto.
const SYNC_TIMEOUT = 75;
const DEFAULT_TIMEOUT = 30;

function base_url(): string
{
    return rtrim(getenv('VERIKO_BASE_URL') ?: 'https://api.veriko.mx/v1', '/');
}

final class ApiError extends RuntimeException
{
    public string $errorCode;
    /** @param list<array<string, mixed>> $errors */
    public function __construct(
        public int $status,
        public array $errors,
        public ?string $requestId,
        public ?float $retryAfter,
        public bool $transport = false,
    ) {
        $first = $errors[0] ?? [];
        $this->errorCode = (string) ($first['code'] ?? "http_{$status}");
        parent::__construct("HTTP {$status} {$this->errorCode}: " . ($first['detail'] ?? 'sin detalle'));
    }
}

function api_key(): string
{
    $key = getenv('VERIKO_API_KEY');
    if ($key === false || $key === '') {
        fwrite(STDERR, "Define VERIKO_API_KEY con tu clave de API (empieza con veriko_).\n");
        exit(1);
    }
    return $key;
}

/**
 * Envía una petición. Devuelve ['status' => int, 'headers' => array, 'body' => mixed] con cualquier 2xx o 304
 * (`body` es el JSON decodificado, o la cadena sin procesar cuando `binary` es true). En otro caso lanza ApiError.
 *
 * @param array{query?: array<string, scalar>, body?: mixed, headers?: array<string, string>, timeout?: int, binary?: bool} $options
 */
function api(string $method, string $path, array $options = []): array
{
    $url = base_url() . $path;
    if (!empty($options['query'])) {
        $url .= '?' . http_build_query($options['query']);
    }
    $headers = ['Authorization: Bearer ' . api_key(), 'Accept-Language: en'];
    foreach (($options['headers'] ?? []) as $name => $value) {
        $headers[] = "{$name}: {$value}";
    }
    $responseHeaders = [];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $options['timeout'] ?? DEFAULT_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HEADERFUNCTION => function ($ch, string $line) use (&$responseHeaders): int {
            if (str_contains($line, ':')) {
                [$name, $value] = explode(':', $line, 2);
                $responseHeaders[strtolower(trim($name))] = trim($value);
            }
            return strlen($line);
        },
    ]);
    if (array_key_exists('body', $options)) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($options['body'], JSON_THROW_ON_ERROR));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $raw = curl_exec($ch);
    if ($raw === false) {
        $message = curl_error($ch);
        throw new ApiError(0, [['code' => 'network_error', 'detail' => $message]], null, null, true);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($status === 304) {
        return ['status' => 304, 'headers' => $responseHeaders, 'body' => null];
    }
    if ($status >= 400) {
        // Un error no siempre es JSON: un gateway puede responder 502 con HTML.
        $errors = [['status' => (string) $status, 'code' => "http_{$status}", 'detail' => substr((string) $raw, 0, 200)]];
        $requestId = null;
        $parsed = json_decode((string) $raw, true);
        if (is_array($parsed)) {
            if (!empty($parsed['errors']) && is_array($parsed['errors'])) {
                $errors = $parsed['errors'];
            }
            $requestId = $parsed['meta']['request_id'] ?? null;
        }
        $retryAfter = isset($responseHeaders['retry-after']) ? (float) $responseHeaders['retry-after'] : null;
        throw new ApiError($status, $errors, $requestId, $retryAfter > 0 ? $retryAfter : null);
    }
    $body = !empty($options['binary']) ? $raw : ($raw === '' ? null : json_decode((string) $raw, true, 512, JSON_THROW_ON_ERROR));
    return ['status' => $status, 'headers' => $responseHeaders, 'body' => $body];
}

/**
 * Reintenta `$send` cuando la falla se puede reintentar: espera Retry-After si la API lo envía y, si no,
 * espera cada vez más (retroceso exponencial). Pasa sólo un `$send` que se pueda repetir sin riesgo: un
 * GET, un PUT o un POST que lleve Idempotency-Key.
 */
function with_retry(callable $send, int $attempts = 5, float $baseDelay = 1.0): array
{
    for ($attempt = 1;; $attempt++) {
        try {
            return $send();
        } catch (ApiError $error) {
            // Una cuota agotada sigue agotada hasta que el plan se renueva: reintentar no ayuda.
            $retryable = $error->errorCode !== 'quota_exceeded'
                && ($error->transport
                    || in_array($error->status, RETRYABLE_STATUSES, true)
                    || $error->errorCode === 'idempotency_key_in_progress');
            if (!$retryable || $attempt >= $attempts) {
                throw $error;
            }
            $wait = $error->retryAfter ?? $baseDelay * 2 ** ($attempt - 1) * (0.5 + mt_rand() / mt_getrandmax() / 2);
            fwrite(STDERR, "El intento {$attempt} falló ({$error->errorCode}); reintento en " . round($wait) . " s.\n");
            usleep((int) ($wait * 1_000_000));
        }
    }
}

/**
 * Sondea GET /validations/{id} hasta que el estado sea final. Respeta Retry-After y
 * meta.next_poll_after_seconds, devuelve el ETag en If-None-Match y se detiene en `$expiresAt`.
 */
function poll_validation(string $id, ?string $expiresAt = null): array
{
    $etag = null;
    $deadline = $expiresAt !== null ? strtotime($expiresAt) : null;
    for (;;) {
        $wait = 2.0; // segundos hasta el siguiente sondeo; 304 significa que nada cambió
        $response = with_retry(fn () => api('GET', "/validations/{$id}", [
            'headers' => $etag !== null ? ['If-None-Match' => $etag] : [],
        ]));
        if ($response['status'] === 200) {
            $etag = $response['headers']['etag'] ?? $etag;
            $status = $response['body']['data']['attributes']['status'];
            if (in_array($status, TERMINAL_STATUSES, true)) {
                return $response['body'];
            }
            fwrite(STDERR, "Estado: {$status}\n");
            $wait = (float) ($response['headers']['retry-after'] ?? $response['body']['meta']['next_poll_after_seconds'] ?? 2);
        }
        if ($deadline !== null && time() + $wait > $deadline) {
            throw new RuntimeException("La validación {$id} no llegó a un estado final antes de {$expiresAt}.");
        }
        usleep((int) ($wait * 1_000_000));
    }
}

/** Imprime un error como lo necesita quien opera el programa y termina con un código distinto de cero. */
function fail(Throwable $error): never
{
    if ($error instanceof ApiError) {
        fwrite(STDERR, "HTTP {$error->status} {$error->errorCode}" . ($error->requestId ? " (petición {$error->requestId})" : '') . "\n");
        foreach ($error->errors as $entry) {
            $pointer = $entry['source']['pointer'] ?? null;
            fwrite(STDERR, '  ' . ($entry['detail'] ?? '') . ($pointer ? " [{$pointer}]" : '') . "\n");
            if (!empty($entry['hint'])) {
                fwrite(STDERR, "  sugerencia: {$entry['hint']}\n");
            }
        }
    } else {
        fwrite(STDERR, get_class($error) . ': ' . $error->getMessage() . "\n");
    }
    exit(1);
}

/** Corre `$main` y termina con un código distinto de cero ante cualquier falla. */
function run(callable $main): void
{
    try {
        $main();
    } catch (Throwable $error) {
        fail($error);
    }
}
