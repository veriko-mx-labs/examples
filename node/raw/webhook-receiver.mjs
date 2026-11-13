// Receive Veriko webhooks: verify the timestamped signature, reject stale deliveries, deduplicate.
//
//   VERIKO_WEBHOOK_SECRET=<secret from POST /webhooks> node node/raw/webhook-receiver.mjs
//
// Optional: VERIKO_WEBHOOK_SECRET_PREVIOUS keeps the receiver working for the 24 hours after you
// rotate the secret, because the API then also sends `X-Webhook-Signature-Old`, signed with the
// previous secret. PORT defaults to 3000.
//
// The signature covers the body exactly as received, so the receiver reads the raw bytes and
// parses the JSON only after the check. `t` must be within 5 minutes of this machine's clock:
// the window applies to `t`, the time of that attempt, not to the `timestamp` in the body,
// because a retry arrives up to about 8.6 hours after the event with a new `t`.

// veriko:receiver

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const SECRET = process.env.VERIKO_WEBHOOK_SECRET;
const PREVIOUS_SECRET = process.env.VERIKO_WEBHOOK_SECRET_PREVIOUS;
const TOLERANCE_SECONDS = 300;
const seen = new Set(); // use a shared store with a 24-hour expiry in production

if (!SECRET) {
  console.error('Set VERIKO_WEBHOOK_SECRET to the secret returned when you registered the endpoint.');
  process.exit(1);
}

// `header` is `t=<seconds>,v1=<hex>`. Returns true when `v1` matches HMAC-SHA256 of `<t>.<body>`
// and `t` is inside the tolerance window.
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
  // During a rotation, a delivery queued before the change carries the old signature.
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
      res.writeHead(401).end(); // a 4xx other than 408 and 429 is not retried
      return;
    }

    // Answer 2xx first, process afterwards: the sender waits 10 seconds at most.
    res.writeHead(200).end();

    const deliveryId = req.headers['x-veriko-delivery-id'];
    if (deliveryId && seen.has(deliveryId)) return; // a retry of a delivery already handled
    if (deliveryId) seen.add(deliveryId);

    const event = JSON.parse(rawBody.toString('utf8'));
    const { id, attributes } = event.data;
    console.log(`${event.event} ${id} status=${attributes.status} client_ref=${attributes.client_ref ?? '-'}`);
    if (event.event === 'validation.completed' && attributes.status === 'valid') {
      // Before releasing goods, compare `attributes.banxico_confirmed` (amount, account) with your order.
    }
  });
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log('Listening for webhooks'));
