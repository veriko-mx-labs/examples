// Register a webhook endpoint, send a test delivery and show its delivery history.
//
//   VERIKO_API_KEY=veriko_... node node/raw/webhook-register.mjs https://example.com/hooks/veriko
//
// The URL must be a public HTTPS address that answers 2xx: run `webhook-receiver.mjs` behind a
// tunnel while you try it. The response carries the signing `secret` once; store it
// as VERIKO_WEBHOOK_SECRET for the receiver. The endpoint subscribes to all seven validation
// events, so `validation.returned` reports a later return.
//
// veriko:operation POST /webhooks body=url,events,description
// veriko:operation POST /webhooks/{id}/test
// veriko:operation GET /webhooks/{id}/deliveries query=per_page
// veriko:operation DELETE /webhooks/{id}

import { api, run } from './client.mjs';

run(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node webhook-register.mjs <public https URL>');
    process.exit(2);
  }

  const created = await api('POST', '/webhooks', {
    body: {
      url,
      description: 'Example endpoint',
      events: [
        'validation.completed',
        'validation.failed',
        'validation.error',
        'validation.returned',
        'validation.retry.scheduled',
        'validation.retry.resolved',
        'validation.retry.exhausted',
      ],
    },
  });
  const { id, attributes } = created.body.data;
  console.log(`Endpoint ${id}`);
  console.log(`Secret (shown once): ${attributes.secret}`);

  // The test returns 200 even when delivery failed: check `delivered`.
  const test = await api('POST', `/webhooks/${id}/test`);
  const result = test.body.data.attributes;
  console.log(`Test delivered=${result.delivered} http_status=${result.http_status} ${result.error ?? ''}`);

  const deliveries = await api('GET', `/webhooks/${id}/deliveries`, { query: { per_page: 5 } });
  for (const delivery of deliveries.body.data) console.log(`${delivery.id} ${delivery.attributes.status}`);

  if (process.argv[3] === '--delete') {
    await api('DELETE', `/webhooks/${id}`);
    console.log(`Deleted ${id}`);
  }
});
