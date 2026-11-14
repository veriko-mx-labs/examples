// Recibe los webhooks de Veriko con el SDK de Node: verifica la firma con marca de tiempo y acepta
// el secreto anterior durante una rotación.
//
//   cd node/sdk && npm install
//   VERIKO_WEBHOOK_SECRET=<secreto de POST /webhooks> node webhook-receiver.mjs
//
// VERIKO_WEBHOOK_SECRET_PREVIOUS es opcional: defínela durante las 24 horas posteriores a regenerar
// el secreto. `verifyWebhookTimestamped` rechaza un `t` a más de 5 minutos (300 s) del reloj de esta
// máquina y compara en tiempo constante. Pásale el cuerpo sin procesar, no un JSON serializado de nuevo.
//
// veriko:receiver

import { createServer } from 'node:http';

import { verifyWebhookTimestamped } from '@veriko-mx/sdk';

const secret = process.env.VERIKO_WEBHOOK_SECRET;
const previousSecret = process.env.VERIKO_WEBHOOK_SECRET_PREVIOUS;
if (!secret) {
  console.error('Define VERIKO_WEBHOOK_SECRET con el secreto que recibiste al registrar el endpoint.');
  process.exit(1);
}

function isAuthentic(rawBody, headers) {
  const options = { toleranceSeconds: 300 };
  if (verifyWebhookTimestamped(rawBody, headers['x-webhook-signature-timestamped'], secret, options)) return true;
  return (
    previousSecret !== undefined &&
    verifyWebhookTimestamped(rawBody, headers['x-webhook-signature-old'], previousSecret, options)
  );
}

createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks);
    if (req.method !== 'POST' || !isAuthentic(rawBody, req.headers)) {
      res.writeHead(401).end();
      return;
    }
    res.writeHead(200).end(); // responde primero y procesa después
    const event = JSON.parse(rawBody.toString('utf8'));
    console.log(event.event, event.data.id, event.data.attributes.status);
  });
}).listen(Number(process.env.PORT ?? 3000), () => console.log('Escuchando webhooks'));
