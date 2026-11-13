// Receive Veriko webhooks with the Node SDK: verify the timestamped signature and accept the old
// secret during a rotation.
//
//   cd node/sdk && npm install
//   VERIKO_WEBHOOK_SECRET=<secret from POST /webhooks> node webhook-receiver.mjs
//
// VERIKO_WEBHOOK_SECRET_PREVIOUS is optional: set it for the 24 hours after you regenerate the
// secret. `verifyWebhookTimestamped` rejects a `t` more than 5 minutes (300 s) from this machine's
// clock and compares in constant time. Pass the raw body, not re-serialized JSON.
//
// veriko:receiver

import { createServer } from 'node:http';

import { verifyWebhookTimestamped } from '@veriko-mx/sdk';

const secret = process.env.VERIKO_WEBHOOK_SECRET;
const previousSecret = process.env.VERIKO_WEBHOOK_SECRET_PREVIOUS;
if (!secret) {
  console.error('Set VERIKO_WEBHOOK_SECRET to the secret returned when you registered the endpoint.');
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
    res.writeHead(200).end(); // answer first, process afterwards
    const event = JSON.parse(rawBody.toString('utf8'));
    console.log(event.event, event.data.id, event.data.attributes.status);
  });
}).listen(Number(process.env.PORT ?? 3000), () => console.log('Listening for webhooks'));
