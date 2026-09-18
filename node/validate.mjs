#!/usr/bin/env node
// Valida una transferencia SPEI con los datos exactos (sin OCR de imagen).
// Requiere: VERIKO_API_KEY en el entorno. Referencia completa: https://docs.veriko.mx/openapi.yaml
// Uso: VERIKO_API_KEY=veriko_... node validate.mjs

const apiKey = process.env.VERIKO_API_KEY;
if (!apiKey) {
  console.error('Falta la variable de entorno VERIKO_API_KEY (empieza con veriko_).');
  process.exit(1);
}

const res = await fetch('https://api.veriko.mx/v1/validate', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fecha: '2025-03-15',
    monto: 15000.50,
    clave_rastreo: 'MXBA20250315001234',
    cuenta_beneficiaria: '012180004412345678',
  }),
});

const body = await res.json();
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, body.errors ?? body);
  process.exit(1);
}

console.log(body.data.attributes.status); // "valid"
