// Recibe los webhooks de Veriko: verifica la firma con marca de tiempo, rechaza las entregas vencidas y descarta las repetidas.
//
//   VERIKO_WEBHOOK_SECRET=<secreto de POST /webhooks> node node/raw/webhook-receiver.mjs
//
// Opcional: VERIKO_WEBHOOK_SECRET_PREVIOUS mantiene el receptor funcionando durante las 24 horas
// posteriores a rotar el secreto, porque la API envía entonces también `X-Webhook-Signature-Old`,
// firmada con el secreto anterior. PORT es 3000 por defecto.
//
// La firma cubre el cuerpo tal como llegó, así que el receptor lee los bytes sin procesar y
// analiza el JSON hasta después de la verificación. `t` debe estar a menos de 5 minutos del reloj
// de esta máquina: la ventana aplica a `t`, la hora de ese intento, y no al `timestamp` del
// cuerpo, porque un reintento llega hasta unas 8.6 horas después del evento con un `t` nuevo.

// veriko:receiver

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const SECRET = process.env.VERIKO_WEBHOOK_SECRET;
const PREVIOUS_SECRET = process.env.VERIKO_WEBHOOK_SECRET_PREVIOUS;
const TOLERANCE_SECONDS = 300;
const seen = new Set(); // en producción usa un almacén compartido con vencimiento de 24 horas

if (!SECRET) {
  console.error('Define VERIKO_WEBHOOK_SECRET con el secreto que recibiste al registrar el endpoint.');
  process.exit(1);
}

// `header` es `t=<segundos>,v1=<hex>`. Devuelve true cuando `v1` coincide con el HMAC-SHA256 de `<t>.<cuerpo>`
// y `t` está dentro de la ventana de tolerancia.
function verifyTimestamped(rawBody, header, secret) {
  if (!header) return false;
  const fields = Object.fromEntries(header.split(',').map((part) => part.trim().split('=')));
  const t = Number(fields.t);
  if (!Number.isInteger(t) || Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest();
  const received = Buffer.from(fields.v1 ?? '', 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function isAuthentic(rawBody, headers) {
  if (verifyTimestamped(rawBody, headers['x-webhook-signature-timestamped'], SECRET)) return true;
  // Durante una rotación, una entrega que quedó en cola antes del cambio lleva la firma anterior.
  return PREVIOUS_SECRET !== undefined && verifyTimestamped(rawBody, headers['x-webhook-signature-old'], PREVIOUS_SECRET);
}

const server = createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks);
    if (!isAuthentic(rawBody, req.headers)) {
      res.writeHead(401).end(); // un 4xx distinto de 408 y 429 no se reintenta
      return;
    }

    // Responde 2xx primero y procesa después: quien envía espera 10 segundos como máximo.
    res.writeHead(200).end();

    const deliveryId = req.headers['x-veriko-delivery-id'];
    if (deliveryId && seen.has(deliveryId)) return; // es un reintento de una entrega que ya se atendió
    if (deliveryId) seen.add(deliveryId);

    const event = JSON.parse(rawBody.toString('utf8'));
    const { id, attributes } = event.data;
    console.log(`${event.event} ${id} status=${attributes.status} client_ref=${attributes.client_ref ?? '-'}`);
    if (event.event === 'validation.completed' && attributes.status === 'valid') {
      // Antes de entregar la mercancía, compara `attributes.banxico_confirmed` (monto, cuenta) con tu pedido.
    }
  });
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log('Escuchando webhooks'));
