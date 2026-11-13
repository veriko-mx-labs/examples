"""Shared helper for the raw HTTP examples in this directory: standard library only, Python 3.9+.

It reads the key from VERIKO_API_KEY, sends every request with a timeout, checks the HTTP
status before parsing the body, and turns any error response into an `ApiError`.
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

# Statuses where the validation is final: stop polling when `data.attributes.status` is one of them.
TERMINAL_STATUSES = frozenset({"valid", "not_found", "cep_unavailable", "invalid", "returned", "failed", "error"})
# Statuses worth retrying: the failure belongs to the moment, not to the request.
RETRYABLE_STATUSES = frozenset({408, 429, 500, 502, 503, 504})

# The synchronous validation can hold the connection for up to about a minute.
SYNC_TIMEOUT = 75
DEFAULT_TIMEOUT = 30


class ApiError(Exception):
    def __init__(self, status: int, errors: list, request_id: Optional[str], retry_after: Optional[float]):
        first = errors[0] if errors else {}
        super().__init__(f"HTTP {status} {first.get('code', 'unknown')}: {first.get('detail', 'no detail')}")
        self.status = status
        self.errors = errors  # every entry of `errors[]`: branch on `code`, never on `detail`
        self.code = first.get("code", f"http_{status}")
        self.request_id = request_id
        self.retry_after = retry_after  # seconds, from the Retry-After header


@dataclass
class Response:
    status: int
    headers: Any
    body: Any  # parsed JSON, or bytes when `binary=True`


def api_key() -> str:
    key = os.environ.get("VERIKO_API_KEY")
    if not key:
        print("Set VERIKO_API_KEY to your API key (it starts with veriko_).", file=sys.stderr)
        sys.exit(1)
    return key


def api(method: str, path: str, *, query: Optional[dict] = None, body: Any = None,
        headers: Optional[dict] = None, timeout: float = DEFAULT_TIMEOUT, binary: bool = False) -> Response:
    """Send one request. Returns a Response for any 2xx or 304; raises ApiError otherwise."""
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
    # An error is not always JSON: a gateway can answer 502 with HTML.
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
    """Retry `send` on retryable failures, waiting for Retry-After when the API sends it and
    backing off exponentially otherwise. Only pass a `send` that is safe to repeat: a GET, a PUT,
    or a POST that carries an Idempotency-Key."""
    for attempt in range(1, attempts + 1):
        try:
            return send()
        except (ApiError, urllib.error.URLError, TimeoutError, ConnectionError) as error:
            if isinstance(error, ApiError):
                # A spent quota stays spent until the plan renews: retrying cannot help.
                retryable = error.code != "quota_exceeded" and (
                    error.status in RETRYABLE_STATUSES or error.code == "idempotency_key_in_progress"
                )
                label = error.code
            else:
                retryable, label = True, type(error).__name__  # timeout or network failure
            if not retryable or attempt == attempts:
                raise
            wait = error.retry_after if isinstance(error, ApiError) and error.retry_after else (
                base_delay * 2 ** (attempt - 1) * (0.5 + random.random() / 2)
            )
            print(f"Attempt {attempt} failed ({label}); retrying in {wait:.0f} s.", file=sys.stderr)
            time.sleep(wait)
    raise AssertionError("unreachable")


def poll_validation(validation_id: str, expires_at: Optional[str] = None) -> dict:
    """Poll GET /validations/{id} until the status is terminal. Honors Retry-After and
    meta.next_poll_after_seconds, sends the ETag back as If-None-Match, and stops at `expires_at`."""
    etag = None
    deadline = _parse_time(expires_at) if expires_at else None
    while True:
        wait = 2.0  # seconds until the next poll; 304 means nothing changed
        response = with_retry(lambda: api(
            "GET", f"/validations/{validation_id}", headers={"If-None-Match": etag} if etag else {}))
        if response.status == 200:
            etag = response.headers.get("ETag") or etag
            status = response.body["data"]["attributes"]["status"]
            if status in TERMINAL_STATUSES:
                return response.body
            print(f"Status: {status}", file=sys.stderr)
            wait = float(response.headers.get("Retry-After")
                         or (response.body.get("meta") or {}).get("next_poll_after_seconds") or 2)
        if deadline is not None and time.time() + wait > deadline:
            raise TimeoutError(f"The validation {validation_id} did not reach a final status before {expires_at}.")
        time.sleep(wait)


def _parse_time(value: str) -> float:
    from datetime import datetime
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def fail(error: BaseException) -> None:
    """Print an error the way an operator needs it, then exit non-zero."""
    if isinstance(error, ApiError):
        suffix = f" (request {error.request_id})" if error.request_id else ""
        print(f"HTTP {error.status} {error.code}{suffix}", file=sys.stderr)
        for entry in error.errors:
            pointer = (entry.get("source") or {}).get("pointer")
            print(f"  {entry.get('detail', '')}{f' [{pointer}]' if pointer else ''}", file=sys.stderr)
            if entry.get("hint"):
                print(f"  hint: {entry['hint']}", file=sys.stderr)
    else:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
    sys.exit(1)


def run(main: Callable[[], None]) -> None:
    """Run `main` and exit non-zero on any failure."""
    try:
        main()
    except (ApiError, urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
        fail(error)
