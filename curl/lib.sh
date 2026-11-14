#!/usr/bin/env bash
# Funciones compartidas de los ejemplos de cURL: cárgalo con `source` y llama a `api MÉTODO /ruta [opciones de curl]`.
# Requiere bash, curl y jq. Lee la clave de VERIKO_API_KEY, envía cada petición con un tiempo
# límite, revisa el estado HTTP antes de leer el cuerpo e imprime `errors[]` si el estado no es 2xx.
# veriko:operation GET /validations/{id} headers=If-None-Match

VERIKO_BASE_URL="${VERIKO_BASE_URL:-https://api.veriko.mx/v1}"
VERIKO_BASE_URL="${VERIKO_BASE_URL%/}"

# Estados en los que la validación es final: deja de sondear cuando `data.attributes.status` es uno de ellos.
TERMINAL_STATUSES="valid not_found cep_unavailable invalid returned failed error"
# Estados que vale la pena reintentar: la falla es del momento, no de la petición.
RETRYABLE_STATUSES="408 429 500 502 503 504"

# La validación síncrona puede mantener la conexión abierta hasta cerca de un minuto.
SYNC_TIMEOUT=75
DEFAULT_TIMEOUT=30

if [[ -z "${VERIKO_API_KEY:-}" ]]; then
  echo "Define VERIKO_API_KEY con tu clave de API (empieza con veriko_)." >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
BODY_FILE="$WORK_DIR/body"
HEADERS_FILE="$WORK_DIR/headers"
# Los define `api`: el estado HTTP y el `errors[0].code` de una petición fallida.
STATUS=""
ERROR_CODE=""

# api MÉTODO RUTA [opciones de curl...]
# Escribe el cuerpo de la respuesta en $BODY_FILE y las cabeceras en $HEADERS_FILE. Devuelve 0 con un
# 2xx o un 304, 1 con un error de la API (se imprime en stderr) y 2 con una falla de transporte.
# Define TIMEOUT para cambiar los 30 segundos predeterminados.
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
  # Un error no siempre es JSON: un gateway puede responder 502 con HTML.
  if jq -e '.errors[0]' "$BODY_FILE" >/dev/null 2>&1; then
    ERROR_CODE="$(jq -r '.errors[0].code' "$BODY_FILE")"
    echo "HTTP ${STATUS} ${ERROR_CODE} (petición $(jq -r '.meta.request_id // "desconocida"' "$BODY_FILE"))" >&2
    jq -r '.errors[] | "  \(.detail)\(if .source.pointer then " [" + .source.pointer + "]" else "" end)\(if .hint then "\n  sugerencia: " + .hint else "" end)"' "$BODY_FILE" >&2
  else
    ERROR_CODE="http_${STATUS}"
    echo "HTTP ${STATUS}: $(head -c 200 "$BODY_FILE")" >&2
  fi
  return 1
}

# header NOMBRE: el valor de una cabecera de la respuesta de la última llamada a `api`.
header() {
  { grep -i "^$1:" "$HEADERS_FILE" || true; } | tail -n 1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'
}

# api_retry MÉTODO RUTA [opciones de curl...]
# Como `api`, pero se repite cuando la falla se puede reintentar. Espera `Retry-After` si la API lo
# envía y, si no, espera cada vez más (retroceso exponencial). Nunca reintenta `quota_exceeded`: ese
# 429 dura hasta que el plan se renueva.
# Úsala sólo con peticiones que se pueden repetir sin riesgo: un GET, un PUT o un POST con Idempotency-Key.
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
    echo "El intento ${attempt} falló (${ERROR_CODE}); reintento en ${delay} s." >&2
    sleep "$delay"
    attempt=$((attempt + 1))
  done
}

# poll_validation ID [EXPIRES_AT]
# Sondea la validación hasta que su estado sea final y deja el cuerpo final en $BODY_FILE.
# Respeta Retry-After y meta.next_poll_after_seconds, devuelve el ETag en If-None-Match y se
# detiene en EXPIRES_AT (ISO 8601).
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
      echo "Estado: ${status}" >&2
      delay="$(header retry-after)"
      delay="${delay:-$(jq -r '.meta.next_poll_after_seconds // 2' "$BODY_FILE")}"
    fi
    if [[ -n "$deadline" && $(($(date +%s) + delay)) -gt $deadline ]]; then
      echo "La validación ${id} no llegó a un estado final antes de ${expires_at}." >&2
      return 1
    fi
    sleep "$delay"
  done
}

# receipt_body ORIGEN: imprime el cuerpo JSON de la validación de un comprobante.
# ORIGEN es un archivo local (se envía en base64 en `image`) o una URL https (se envía como `image_url`).
receipt_body() {
  local source="$1"
  if [[ "$source" == https://* ]]; then
    jq -n --arg url "$source" '{image_url: $url}'
  else
    base64 < "$source" | tr -d '\n' | jq -R -s '{image: .}'
  fi
}
