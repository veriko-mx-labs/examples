<?php
// Shared helper for the PHP examples: PHP 8.1 or later with the curl extension, no packages.
// It reads the key from VERIKO_API_KEY, sends every request with a timeout, checks the HTTP
// status before parsing the body, and turns any error response into an `ApiError`.
// veriko:operation GET /validations/{id} headers=If-None-Match

declare(strict_types=1);

const TERMINAL_STATUSES = ['valid', 'not_found', 'cep_unavailable', 'invalid', 'returned', 'failed', 'error'];
// Statuses worth retrying: the failure belongs to the moment, not to the request.
const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
// The synchronous validation can hold the connection for up to about a minute.
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
        parent::__construct("HTTP {$status} {$this->errorCode}: " . ($first['detail'] ?? 'no detail'));
    }
}

function api_key(): string
{
    $key = getenv('VERIKO_API_KEY');
    if ($key === false || $key === '') {
        fwrite(STDERR, "Set VERIKO_API_KEY to your API key (it starts with veriko_).\n");
        exit(1);
    }
    return $key;
}

/**
 * Sends one request. Returns ['status' => int, 'headers' => array, 'body' => mixed] for any 2xx or 304
 * (`body` is the decoded JSON, or the raw string when `binary` is true). Throws ApiError otherwise.
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
        // An error is not always JSON: a gateway can answer 502 with HTML.
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
 * Retries `$send` on retryable failures, waiting for Retry-After when the API sends it and backing
 * off exponentially otherwise. Only pass a `$send` that is safe to repeat: a GET, a PUT, or a POST
 * that carries an Idempotency-Key.
 */
function with_retry(callable $send, int $attempts = 5, float $baseDelay = 1.0): array
{
    for ($attempt = 1;; $attempt++) {
        try {
            return $send();
        } catch (ApiError $error) {
            // A spent quota stays spent until the plan renews: retrying cannot help.
            $retryable = $error->errorCode !== 'quota_exceeded'
                && ($error->transport
                    || in_array($error->status, RETRYABLE_STATUSES, true)
                    || $error->errorCode === 'idempotency_key_in_progress');
            if (!$retryable || $attempt >= $attempts) {
                throw $error;
            }
            $wait = $error->retryAfter ?? $baseDelay * 2 ** ($attempt - 1) * (0.5 + mt_rand() / mt_getrandmax() / 2);
            fwrite(STDERR, "Attempt {$attempt} failed ({$error->errorCode}); retrying in " . round($wait) . " s.\n");
            usleep((int) ($wait * 1_000_000));
        }
    }
}

/**
 * Polls GET /validations/{id} until the status is terminal. Honors Retry-After and
 * meta.next_poll_after_seconds, sends the ETag back as If-None-Match, and stops at `$expiresAt`.
 */
function poll_validation(string $id, ?string $expiresAt = null): array
{
    $etag = null;
    $deadline = $expiresAt !== null ? strtotime($expiresAt) : null;
    for (;;) {
        $wait = 2.0; // seconds until the next poll; 304 means nothing changed
        $response = with_retry(fn () => api('GET', "/validations/{$id}", [
            'headers' => $etag !== null ? ['If-None-Match' => $etag] : [],
        ]));
        if ($response['status'] === 200) {
            $etag = $response['headers']['etag'] ?? $etag;
            $status = $response['body']['data']['attributes']['status'];
            if (in_array($status, TERMINAL_STATUSES, true)) {
                return $response['body'];
            }
            fwrite(STDERR, "Status: {$status}\n");
            $wait = (float) ($response['headers']['retry-after'] ?? $response['body']['meta']['next_poll_after_seconds'] ?? 2);
        }
        if ($deadline !== null && time() + $wait > $deadline) {
            throw new RuntimeException("The validation {$id} did not reach a final status before {$expiresAt}.");
        }
        usleep((int) ($wait * 1_000_000));
    }
}

/** Prints an error the way an operator needs it, then exits non-zero. */
function fail(Throwable $error): never
{
    if ($error instanceof ApiError) {
        fwrite(STDERR, "HTTP {$error->status} {$error->errorCode}" . ($error->requestId ? " (request {$error->requestId})" : '') . "\n");
        foreach ($error->errors as $entry) {
            $pointer = $entry['source']['pointer'] ?? null;
            fwrite(STDERR, '  ' . ($entry['detail'] ?? '') . ($pointer ? " [{$pointer}]" : '') . "\n");
            if (!empty($entry['hint'])) {
                fwrite(STDERR, "  hint: {$entry['hint']}\n");
            }
        }
    } else {
        fwrite(STDERR, get_class($error) . ': ' . $error->getMessage() . "\n");
    }
    exit(1);
}

/** Runs `$main` and exits non-zero on any failure. */
function run(callable $main): void
{
    try {
        $main();
    } catch (Throwable $error) {
        fail($error);
    }
}
