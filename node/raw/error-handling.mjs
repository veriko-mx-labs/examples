// Maneja los errores de la API: revisa primero el estado HTTP, decide con `errors[].code` y muestra `detail` y `hint`.
//
//   VERIKO_API_KEY=veriko_... node node/raw/error-handling.mjs
//
// Este script envía a propósito una petición inválida (un `422`). La API la rechaza antes de
// llegar a Banxico, así que no consume cuota.
// Decide con `code`: es estable y nunca se traduce. `detail` cambia con la cabecera
// `Accept-Language` y puede reformularse, así que muéstralo pero no lo compares.
//
// veriko:operation POST /validate body=amount,beneficiary_account

import { ApiError, SYNC_TIMEOUT_MS, api, run } from './client.mjs';

run(async () => {
  try {
    // No trae `tracking_key` ni `numeric_reference`: la API no puede buscar el pago.
    await api('POST', '/validate', { timeoutMs: SYNC_TIMEOUT_MS, body: { amount: 100, beneficiary_account: '012180004412345678' } });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error; // un tiempo límite agotado o una falla de red
    // Un 422 trae una entrada de resumen y luego una por cada campo inválido: lee todo el arreglo.
    for (const entry of error.errors) {
      console.log(`${entry.code}${entry.source?.pointer ? ` en ${entry.source.pointer}` : ''}: ${entry.detail}`);
    }
    switch (error.code) {
      case 'quota_exceeded':
        console.log('Se agotó la cuota del plan. No reintentes; cambia de plan o espera a la renovación.');
        break;
      case 'rate_limit_exceeded':
        console.log(`Límite de tasa alcanzado. Reintenta en ${error.retryAfter ?? 60} s.`);
        break;
      default:
        console.log(`La petición ${error.requestId ?? 'desconocida'} falló con HTTP ${error.status}.`);
    }
    process.exitCode = 1;
  }
});
