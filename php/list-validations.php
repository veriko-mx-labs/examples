<?php
// Recorre todas las páginas del historial de validaciones.
//
//   VERIKO_API_KEY=veriko_... php php/list-validations.php
//
// `per_page` acepta de 1 a 50 en este listado; un valor mayor se ajusta al tope. Avanza con `page`
// hasta `meta.pagination.total_pages`. Los parámetros que la operación no declara se ignoran sin
// error, así que revisa los nombres.
// Listar no consume cuota.
//
// veriko:operation GET /validations query=page,per_page,from,to

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function (): void {
    $page = 1;
    $totalPages = 1;
    while ($page <= $totalPages) {
        $response = with_retry(fn () => api('GET', '/validations', [
            'query' => ['page' => $page, 'per_page' => 50, 'from' => '2025-01-01', 'to' => '2025-12-31'],
        ]));
        foreach ($response['body']['data'] as $item) {
            echo $item['id'], ' ', $item['attributes']['status'], "\n";
        }
        $totalPages = $response['body']['meta']['pagination']['total_pages'];
        $page++;
    }
});
