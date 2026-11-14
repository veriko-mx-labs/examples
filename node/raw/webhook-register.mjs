// Registra un endpoint de webhook, envía una entrega de prueba y muestra su historial de entregas.
//
//   VERIKO_API_KEY=veriko_... node node/raw/webhook-register.mjs https://example.com/hooks/veriko
//
// La URL debe ser una dirección HTTPS pública que responda 2xx: mientras pruebas, corre
// `webhook-receiver.mjs` detrás de un túnel. La respuesta trae el `secret` de firma una sola vez;
// guárdalo como VERIKO_WEBHOOK_SECRET para el receptor. El endpoint se suscribe a los siete
// eventos de validación, así que `validation.returned` avisa de una devolución posterior.
//
// veriko:operation POST /webhooks body=url,events,description
// veriko:operation POST /webhooks/{id}/test
// veriko:operation GET /webhooks/{id}/deliveries query=per_page
// veriko:operation DELETE /webhooks/{id}

import { api, run } from './client.mjs';

run(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('Uso: node webhook-register.mjs <URL https pública>');
    process.exit(2);
  }

  const created = await api('POST', '/webhooks', {
    body: {
      url,
      description: 'Endpoint de ejemplo',
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
  console.log(`Secreto (se muestra una vez): ${attributes.secret}`);

  // La prueba responde 200 aunque la entrega falle: revisa `delivered`.
  const test = await api('POST', `/webhooks/${id}/test`);
  const result = test.body.data.attributes;
  console.log(`Prueba delivered=${result.delivered} http_status=${result.http_status} ${result.error ?? ''}`);

  const deliveries = await api('GET', `/webhooks/${id}/deliveries`, { query: { per_page: 5 } });
  for (const delivery of deliveries.body.data) console.log(`${delivery.id} ${delivery.attributes.status}`);

  if (process.argv[3] === '--delete') {
    await api('DELETE', `/webhooks/${id}`);
    console.log(`Eliminado ${id}`);
  }
});
