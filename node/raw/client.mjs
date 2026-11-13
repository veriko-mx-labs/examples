// veriko:operation GET /validations/{id} headers=If-None-Match
// Shared helper for the raw HTTP examples in this directory: no dependencies, Node 18 or later.
// It reads the key from VERIKO_API_KEY, sends every request with a timeout, checks the HTTP
// status before parsing the body, and turns any error response into an `ApiError`.

export const BASE_URL = (process.env.VERIKO_BASE_URL ?? 'https://api.veriko.mx/v1').replace(/\/+$/u, '');

// Statuses where the validation is final: stop polling when `data.attributes.status` is one of them.
export const TERMINAL_STATUSES = new Set(['valid', 'not_found', 'cep_unavailable', 'invalid', 'returned', 'failed', 'error']);
// Statuses worth retrying: the failure belongs to the moment, not to the request.
export const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// The synchronous validation can hold the connection for up to about a minute.
export const SYNC_TIMEOUT_MS = 75_000;
export const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(status, errors, requestId, retryAfter) {
    const first = errors[0] ?? {};
    super(`HTTP ${status} ${first.code ?? 'unknown'}: ${first.detail ?? 'no detail'}`);
    this.status = status;
    this.errors = errors; // every entry of `errors[]`: branch on `code`, never on `detail`
    this.code = first.code ?? `http_${status}`;
    this.hint = first.hint;
    this.requestId = requestId;
    this.retryAfter = retryAfter; // seconds, from the Retry-After header
  }
}

export function apiKey() {
  const key = process.env.VERIKO_API_KEY;
  if (!key) {
    console.error('Set VERIKO_API_KEY to your API key (it starts with veriko_).');
    process.exit(1);
  }
  return key;
}

// Sends one request. Resolves with { status, headers, body } for any 2xx or 304.
// `body` is parsed JSON, or a Buffer when `binary` is true. Rejects with ApiError otherwise.
export async function api(method, path, { query, body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, binary = false } = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Accept-Language': 'en',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.status === 304) return { status: 304, headers: response.headers, body: null };

  if (!response.ok) {
    // An error is not always JSON: a gateway can answer 502 with HTML.
    const text = await response.text();
    let errors = [{ status: String(response.status), code: `http_${response.status}`, detail: text.slice(0, 200) }];
    let requestId;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.errors) && parsed.errors.length > 0) errors = parsed.errors;
      requestId = parsed.meta?.request_id;
    } catch {
      // Keep the fallback entry.
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ApiError(response.status, errors, requestId, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
  }

  if (binary) return { status: response.status, headers: response.headers, body: Buffer.from(await response.arrayBuffer()) };
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text === '' ? null : JSON.parse(text) };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries `send` on retryable failures, waiting for Retry-After when the API sends it and
// backing off exponentially otherwise. Only pass a `send` that is safe to repeat: a GET, a PUT,
// or a POST that carries an Idempotency-Key.
export async function withRetry(send, { attempts = 5, baseDelayMs = 1000 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await send();
    } catch (error) {
      const network = error?.name === 'TimeoutError' || error instanceof TypeError;
      const retryable =
        network ||
        (error instanceof ApiError &&
          // A spent quota stays spent until the plan renews: retrying cannot help.
          error.code !== 'quota_exceeded' &&
          (RETRYABLE_STATUSES.has(error.status) || error.code === 'idempotency_key_in_progress'));
      if (!retryable || attempt >= attempts) throw error;
      const backoff = baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random() / 2);
      const wait = error instanceof ApiError && error.retryAfter ? error.retryAfter * 1000 : backoff;
      console.error(`Attempt ${attempt} failed (${error.code ?? error.name}); retrying in ${Math.round(wait / 1000)} s.`);
      await sleep(wait);
    }
  }
}

// Polls GET /validations/{id} until the status is terminal. Honors Retry-After and
// meta.next_poll_after_seconds, sends the ETag back as If-None-Match, and stops at `expiresAt`.
export async function pollValidation(id, { expiresAt } = {}) {
  let etag;
  for (;;) {
    let wait = 2; // seconds until the next poll; 304 means nothing changed
    const response = await withRetry(() =>
      api('GET', `/validations/${id}`, { headers: etag ? { 'If-None-Match': etag } : {} }),
    );
    if (response.status === 200) {
      etag = response.headers.get('etag') ?? etag;
      const { status } = response.body.data.attributes;
      if (TERMINAL_STATUSES.has(status)) return response.body;
      console.error(`Status: ${status}`);
      wait = Number(response.headers.get('retry-after') ?? response.body.meta?.next_poll_after_seconds ?? 2);
    }
    if (expiresAt && Date.now() + wait * 1000 > Date.parse(expiresAt)) {
      throw new Error(`The validation ${id} did not reach a final status before ${expiresAt}.`);
    }
    await sleep(wait * 1000);
  }
}

// Prints an ApiError the way an operator needs it, then exits non-zero.
export function fail(error) {
  if (error instanceof ApiError) {
    console.error(`HTTP ${error.status} ${error.code}${error.requestId ? ` (request ${error.requestId})` : ''}`);
    for (const entry of error.errors) {
      console.error(`  ${entry.detail ?? ''}${entry.source?.pointer ? ` [${entry.source.pointer}]` : ''}`);
      if (entry.hint) console.error(`  hint: ${entry.hint}`);
    }
  } else {
    console.error(error?.stack ?? String(error));
  }
  process.exit(1);
}

// Runs `main` and exits non-zero on any failure.
export function run(main) {
  main().catch(fail);
}
