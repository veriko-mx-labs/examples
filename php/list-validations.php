<?php
// Walk every page of the validation history.
//
//   VERIKO_API_KEY=veriko_... php php/list-validations.php
//
// `per_page` accepts 1 to 50 on this listing; a larger value is clamped. Move forward with `page`
// until `meta.pagination.total_pages`. Parameters the operation does not declare are ignored without
// an error, so check the names.
// Listing consumes no quota.
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
