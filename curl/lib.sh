#!/usr/bin/env bash
# Shared helper for the curl examples: source it, then call `api METHOD /path [curl options]`.
# Requires bash, curl and jq. It reads the key from VERIKO_API_KEY, sends every request with a
# timeout, checks the HTTP status before reading the body, and prints `errors[]` on any non-2xx.
# veriko:operation GET /validations/{id} headers=If-None-Match

VERIKO_BASE_URL="${VERIKO_BASE_URL:-https://api.veriko.mx/v1}"
VERIKO_BASE_URL="${VERIKO_BASE_URL%/}"

# Statuses where the validation is final: stop polling when `data.attributes.status` is one of them.
TERMINAL_STATUSES="valid not_found cep_unavailable invalid returned failed error"
# Statuses worth retrying: the failure belongs to the moment, not to the request.
RETRYABLE_STATUSES="408 429 500 502 503 504"

# The synchronous validation can hold the connection for up to about a minute.
SYNC_TIMEOUT=75
DEFAULT_TIMEOUT=30

if [[ -z "${VERIKO_API_KEY:-}" ]]; then
  echo "Set VERIKO_API_KEY to your API key (it starts with veriko_)." >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
BODY_FILE="$WORK_DIR/body"
HEADERS_FILE="$WORK_DIR/headers"
# Set by `api`: the HTTP status, and the `errors[0].code` of a failed request.
STATUS=""
ERROR_CODE=""

# api METHOD PATH [curl options...]
# Writes the response body to $BODY_FILE and the headers to $HEADERS_FILE. Returns 0 for a 2xx or
# 304, 1 for an API error (printed to stderr), 2 for a transport failure.
# Set TIMEOUT to override the default 30 seconds.
api() {
  local method="$1" path="$2"
  shift 2
  ERROR_CODE=""
  STATUS="$(curl --silent --show-error --max-time "${TIMEOUT:-$DEFAULT_TIMEOUT}" \
    --request "$method" "${VERIKO_BASE_URL}${path}" \
    --header "Authorization: Bearer ${VERIKO_API_KEY}" \
    --header "Accept-Language: en" \
    --output "$BODY_FILE" --dump-header "$HEADERS_FILE" \
    --write-out '%{http_code}' "$@")" || { STATUS="000"; ERROR_CODE="network_error"; return 2; }

  if [[ "$STATUS" == 2* || "$STATUS" == "304" ]]; then
    return 0
  fi
  # An error is not always JSON: a gateway can answer 502 with HTML.
  if jq -e '.errors[0]' "$BODY_FILE" >/dev/null 2>&1; then
    ERROR_CODE="$(jq -r '.errors[0].code' "$BODY_FILE")"
    echo "HTTP ${STATUS} ${ERROR_CODE} (request $(jq -r '.meta.request_id // "unknown"' "$BODY_FILE"))" >&2
    jq -r '.errors[] | "  \(.detail)\(if .source.pointer then " [" + .source.pointer + "]" else "" end)\(if .hint then "\n  hint: " + .hint else "" end)"' "$BODY_FILE" >&2
  else
    ERROR_CODE="http_${STATUS}"
    echo "HTTP ${STATUS}: $(head -c 200 "$BODY_FILE")" >&2
  fi
  return 1
}

# header NAME: the value of a response header from the last `api` call.
header() {
  { grep -i "^$1:" "$HEADERS_FILE" || true; } | tail -n 1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'
}

# api_retry METHOD PATH [curl options...]
# Like `api`, repeated on retryable failures. Waits `Retry-After` when the API sends it and backs
# off exponentially otherwise. Never retries `quota_exceeded`: that 429 lasts until the plan renews.
# Use it only for requests that are safe to repeat: a GET, a PUT, or a POST with an Idempotency-Key.
api_retry() {
  local attempt=1 max_attempts=5 result delay
  while true; do
    api "$@" && return 0
    result=$?
    if [[ "$ERROR_CODE" == "quota_exceeded" || $attempt -ge $max_attempts ]]; then return "$result"; fi
    if [[ "$result" -ne 2 && " $RETRYABLE_STATUSES " != *" $STATUS "* && "$ERROR_CODE" != "idempotency_key_in_progress" ]]; then
      return "$result"
    fi
    delay="$(header retry-after)"
    delay="${delay:-$((2 ** (attempt - 1)))}"
    echo "Attempt ${attempt} failed (${ERROR_CODE}); retrying in ${delay} s." >&2
    sleep "$delay"
    attempt=$((attempt + 1))
  done
}

# poll_validation ID [EXPIRES_AT]
# Polls the validation until its status is terminal and leaves the final body in $BODY_FILE.
# Honors Retry-After and meta.next_poll_after_seconds, sends the ETag back as If-None-Match, and
# stops at EXPIRES_AT (ISO 8601).
poll_validation() {
  local id="$1" expires_at="${2:-}" etag="" status delay deadline=""
  [[ -n "$expires_at" ]] && deadline="$(date -d "$expires_at" +%s 2>/dev/null || true)"
  while true; do
    delay=2
    if [[ -n "$etag" ]]; then
      api_retry GET "/validations/${id}" --header "If-None-Match: ${etag}" || return 1
    else
      api_retry GET "/validations/${id}" || return 1
    fi
    if [[ "$STATUS" == "200" ]]; then
      etag="$(header etag)"
      status="$(jq -r '.data.attributes.status' "$BODY_FILE")"
      if [[ " $TERMINAL_STATUSES " == *" $status "* ]]; then return 0; fi
      echo "Status: ${status}" >&2
      delay="$(header retry-after)"
      delay="${delay:-$(jq -r '.meta.next_poll_after_seconds // 2' "$BODY_FILE")}"
    fi
    if [[ -n "$deadline" && $(($(date +%s) + delay)) -gt $deadline ]]; then
      echo "The validation ${id} did not reach a final status before ${expires_at}." >&2
      return 1
    fi
    sleep "$delay"
  done
}

# receipt_body SOURCE: prints a JSON body for the receipt validation.
# SOURCE is a local file (sent as base64 in `image`) or an https URL (sent as `image_url`).
receipt_body() {
  local source="$1"
  if [[ "$source" == https://* ]]; then
    jq -n --arg url "$source" '{image_url: $url}'
  else
    base64 < "$source" | tr -d '\n' | jq -R -s '{image: .}'
  fi
}
