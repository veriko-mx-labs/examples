// veriko:operation GET /validations/{id} headers=If-None-Match
// Funciones compartidas de los ejemplos HTTP directos de este directorio: sin dependencias, Node 18 o posterior.
// Lee la clave de VERIKO_API_KEY, envía cada petición con un tiempo límite, revisa el estado
// HTTP antes de analizar el cuerpo y convierte cualquier respuesta de error en un `ApiError`.

export const BASE_URL = (process.env.VERIKO_BASE_URL ?? 'https://api.veriko.mx/v1').replace(/\/+$/u, '');

// Estados en los que la validación es final: deja de sondear cuando `data.attributes.status` es uno de ellos.
export const TERMINAL_STATUSES = new Set(['valid', 'not_found', 'cep_unavailable', 'invalid', 'returned', 'failed', 'error']);
// Estados que vale la pena reintentar: la falla es del momento, no de la petición.
export const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// La validación síncrona puede mantener la conexión abierta hasta cerca de un minuto.
export const SYNC_TIMEOUT_MS = 75_000;
export const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(status, errors, requestId, retryAfter) {
    const first = errors[0] ?? {};
    super(`HTTP ${status} ${first.code ?? 'desconocido'}: ${first.detail ?? 'sin detalle'}`);
    this.status = status;
    this.errors = errors; // cada entrada de `errors[]`: decide con `code`, nunca con `detail`
    this.code = first.code ?? `http_${status}`;
    this.hint = first.hint;
    this.requestId = requestId;
    this.retryAfter = retryAfter; // segundos, de la cabecera Retry-After
  }
}

export function apiKey() {
  const key = process.env.VERIKO_API_KEY;
  if (!key) {
    console.error('Define VERIKO_API_KEY con tu clave de API (empieza con veriko_).');
    process.exit(1);
  }
  return key;
}

// Envía una petición. Se resuelve con { status, headers, body } con cualquier 2xx o 304.
// `body` es el JSON ya analizado, o un Buffer cuando `binary` es true. En otro caso se rechaza con ApiError.
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
    // Un error no siempre es JSON: un gateway puede responder 502 con HTML.
    const text = await response.text();
    let errors = [{ status: String(response.status), code: `http_${response.status}`, detail: text.slice(0, 200) }];
    let requestId;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.errors) && parsed.errors.length > 0) errors = parsed.errors;
      requestId = parsed.meta?.request_id;
    } catch {
      // Se conserva la entrada de respaldo.
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ApiError(response.status, errors, requestId, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined);
  }

  if (binary) return { status: response.status, headers: response.headers, body: Buffer.from(await response.arrayBuffer()) };
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text === '' ? null : JSON.parse(text) };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Reintenta `send` cuando la falla se puede reintentar: espera Retry-After si la API lo envía y,
// si no, espera cada vez más (retroceso exponencial). Pasa sólo un `send` que se pueda repetir
// sin riesgo: un GET, un PUT o un POST que lleve Idempotency-Key.
export async function withRetry(send, { attempts = 5, baseDelayMs = 1000 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await send();
    } catch (error) {
      const network = error?.name === 'TimeoutError' || error instanceof TypeError;
      const retryable =
        network ||
        (error instanceof ApiError &&
          // Una cuota agotada sigue agotada hasta que el plan se renueva: reintentar no ayuda.
          error.code !== 'quota_exceeded' &&
          (RETRYABLE_STATUSES.has(error.status) || error.code === 'idempotency_key_in_progress'));
      if (!retryable || attempt >= attempts) throw error;
      const backoff = baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random() / 2);
      const wait = error instanceof ApiError && error.retryAfter ? error.retryAfter * 1000 : backoff;
      console.error(`El intento ${attempt} falló (${error.code ?? error.name}); reintento en ${Math.round(wait / 1000)} s.`);
      await sleep(wait);
    }
  }
}

// Sondea GET /validations/{id} hasta que el estado sea final. Respeta Retry-After y
// meta.next_poll_after_seconds, devuelve el ETag en If-None-Match y se detiene en `expiresAt`.
export async function pollValidation(id, { expiresAt } = {}) {
  let etag;
  for (;;) {
    let wait = 2; // segundos hasta el siguiente sondeo; 304 significa que nada cambió
    const response = await withRetry(() =>
      api('GET', `/validations/${id}`, { headers: etag ? { 'If-None-Match': etag } : {} }),
    );
    if (response.status === 200) {
      etag = response.headers.get('etag') ?? etag;
      const { status } = response.body.data.attributes;
      if (TERMINAL_STATUSES.has(status)) return response.body;
      console.error(`Estado: ${status}`);
      wait = Number(response.headers.get('retry-after') ?? response.body.meta?.next_poll_after_seconds ?? 2);
    }
    if (expiresAt && Date.now() + wait * 1000 > Date.parse(expiresAt)) {
      throw new Error(`La validación ${id} no llegó a un estado final antes de ${expiresAt}.`);
    }
    await sleep(wait * 1000);
  }
}

// Imprime un ApiError como lo necesita quien opera el programa y termina con un código distinto de cero.
export function fail(error) {
  if (error instanceof ApiError) {
    console.error(`HTTP ${error.status} ${error.code}${error.requestId ? ` (petición ${error.requestId})` : ''}`);
    for (const entry of error.errors) {
      console.error(`  ${entry.detail ?? ''}${entry.source?.pointer ? ` [${entry.source.pointer}]` : ''}`);
      if (entry.hint) console.error(`  sugerencia: ${entry.hint}`);
    }
  } else {
    console.error(error?.stack ?? String(error));
  }
  process.exit(1);
}

// Corre `main` y termina con un código distinto de cero ante cualquier falla.
export function run(main) {
  main().catch(fail);
}
