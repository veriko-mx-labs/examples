"""Funciones compartidas de los ejemplos HTTP directos de este directorio: sólo biblioteca estándar, Python 3.9 o posterior.

Lee la clave de VERIKO_API_KEY, envía cada petición con un tiempo límite, revisa el estado
HTTP antes de analizar el cuerpo y convierte cualquier respuesta de error en un `ApiError`.
"""
# veriko:operation GET /validations/{id} headers=If-None-Match
import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Optional

BASE_URL = os.environ.get("VERIKO_BASE_URL", "https://api.veriko.mx/v1").rstrip("/")

# Estados en los que la validación es final: deja de sondear cuando `data.attributes.status` es uno de ellos.
TERMINAL_STATUSES = frozenset({"valid", "not_found", "cep_unavailable", "invalid", "returned", "failed", "error"})
# Estados que vale la pena reintentar: la falla es del momento, no de la petición.
RETRYABLE_STATUSES = frozenset({408, 429, 500, 502, 503, 504})

# La validación síncrona puede mantener la conexión abierta hasta cerca de un minuto.
SYNC_TIMEOUT = 75
DEFAULT_TIMEOUT = 30


class ApiError(Exception):
    def __init__(self, status: int, errors: list, request_id: Optional[str], retry_after: Optional[float]):
        first = errors[0] if errors else {}
        super().__init__(f"HTTP {status} {first.get('code', 'desconocido')}: {first.get('detail', 'sin detalle')}")
        self.status = status
        self.errors = errors  # cada entrada de `errors[]`: decide con `code`, nunca con `detail`
        self.code = first.get("code", f"http_{status}")
        self.request_id = request_id
        self.retry_after = retry_after  # segundos, de la cabecera Retry-After


@dataclass
class Response:
    status: int
    headers: Any
    body: Any  # el JSON ya analizado, o bytes cuando `binary=True`


def api_key() -> str:
    key = os.environ.get("VERIKO_API_KEY")
    if not key:
        print("Define VERIKO_API_KEY con tu clave de API (empieza con veriko_).", file=sys.stderr)
        sys.exit(1)
    return key


def api(method: str, path: str, *, query: Optional[dict] = None, body: Any = None,
        headers: Optional[dict] = None, timeout: float = DEFAULT_TIMEOUT, binary: bool = False) -> Response:
    """Envía una petición. Devuelve un Response con cualquier 2xx o 304; en otro caso lanza ApiError."""
    url = BASE_URL + path
    if query:
        url += "?" + urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
    request_headers = {"Authorization": f"Bearer {api_key()}", "Accept-Language": "en"}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    request_headers.update(headers or {})
    request = urllib.request.Request(url, data=data, method=method, headers=request_headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            status, response_headers = response.status, response.headers
    except urllib.error.HTTPError as error:
        if error.code == 304:
            return Response(304, error.headers, None)
        raise _api_error(error) from None
    if binary:
        return Response(status, response_headers, raw)
    return Response(status, response_headers, json.loads(raw) if raw else None)


def _api_error(error: urllib.error.HTTPError) -> ApiError:
    # Un error no siempre es JSON: un gateway puede responder 502 con HTML.
    text = error.read().decode("utf-8", "replace")
    errors = [{"status": str(error.code), "code": f"http_{error.code}", "detail": text[:200]}]
    request_id = None
    try:
        parsed = json.loads(text)
        if isinstance(parsed.get("errors"), list) and parsed["errors"]:
            errors = parsed["errors"]
        request_id = (parsed.get("meta") or {}).get("request_id")
    except (ValueError, AttributeError):
        pass
    try:
        retry_after: Optional[float] = float(error.headers.get("Retry-After"))
    except (TypeError, ValueError):
        retry_after = None
    return ApiError(error.code, errors, request_id, retry_after)


def with_retry(send: Callable[[], Response], attempts: int = 5, base_delay: float = 1.0) -> Response:
    """Reintenta `send` cuando la falla se puede reintentar: espera Retry-After si la API lo envía y,
    si no, espera cada vez más (retroceso exponencial). Pasa sólo un `send` que se pueda repetir
    sin riesgo: un GET, un PUT o un POST que lleve Idempotency-Key."""
    for attempt in range(1, attempts + 1):
        try:
            return send()
        except (ApiError, urllib.error.URLError, TimeoutError, ConnectionError) as error:
            if isinstance(error, ApiError):
                # Una cuota agotada sigue agotada hasta que el plan se renueva: reintentar no ayuda.
                retryable = error.code != "quota_exceeded" and (
                    error.status in RETRYABLE_STATUSES or error.code == "idempotency_key_in_progress"
                )
                label = error.code
            else:
                retryable, label = True, type(error).__name__  # tiempo límite agotado o falla de red
            if not retryable or attempt == attempts:
                raise
            wait = error.retry_after if isinstance(error, ApiError) and error.retry_after else (
                base_delay * 2 ** (attempt - 1) * (0.5 + random.random() / 2)
            )
            print(f"El intento {attempt} falló ({label}); reintento en {wait:.0f} s.", file=sys.stderr)
            time.sleep(wait)
    raise AssertionError("unreachable")


def poll_validation(validation_id: str, expires_at: Optional[str] = None) -> dict:
    """Sondea GET /validations/{id} hasta que el estado sea final. Respeta Retry-After y
    meta.next_poll_after_seconds, devuelve el ETag en If-None-Match y se detiene en `expires_at`."""
    etag = None
    deadline = _parse_time(expires_at) if expires_at else None
    while True:
        wait = 2.0  # segundos hasta el siguiente sondeo; 304 significa que nada cambió
        response = with_retry(lambda: api(
            "GET", f"/validations/{validation_id}", headers={"If-None-Match": etag} if etag else {}))
        if response.status == 200:
            etag = response.headers.get("ETag") or etag
            status = response.body["data"]["attributes"]["status"]
            if status in TERMINAL_STATUSES:
                return response.body
            print(f"Estado: {status}", file=sys.stderr)
            wait = float(response.headers.get("Retry-After")
                         or (response.body.get("meta") or {}).get("next_poll_after_seconds") or 2)
        if deadline is not None and time.time() + wait > deadline:
            raise TimeoutError(f"La validación {validation_id} no llegó a un estado final antes de {expires_at}.")
        time.sleep(wait)


def _parse_time(value: str) -> float:
    from datetime import datetime
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def fail(error: BaseException) -> None:
    """Imprime un error como lo necesita quien opera el programa y termina con un código distinto de cero."""
    if isinstance(error, ApiError):
        suffix = f" (petición {error.request_id})" if error.request_id else ""
        print(f"HTTP {error.status} {error.code}{suffix}", file=sys.stderr)
        for entry in error.errors:
            pointer = (entry.get("source") or {}).get("pointer")
            print(f"  {entry.get('detail', '')}{f' [{pointer}]' if pointer else ''}", file=sys.stderr)
            if entry.get("hint"):
                print(f"  sugerencia: {entry['hint']}", file=sys.stderr)
    else:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
    sys.exit(1)


def run(main: Callable[[], None]) -> None:
    """Corre `main` y termina con un código distinto de cero ante cualquier falla."""
    try:
        main()
    except (ApiError, urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
        fail(error)
