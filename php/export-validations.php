<?php
// Exporta el historial de validaciones como un archivo CSV.
//
//   VERIKO_API_KEY=veriko_... php php/export-validations.php
//
// `format` acepta `csv` y `xlsx` (`csv` por defecto). La respuesta es un archivo adjunto; un
// error llega como JSON. Exportar no consume cuota.
//
// veriko:operation GET /validations/export query=format,from,to,limit

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function (): void {
    $response = with_retry(fn () => api('GET', '/validations/export', [
        'query' => ['format' => 'csv', 'from' => '2025-01-01', 'to' => '2025-12-31', 'limit' => 1000],
        'binary' => true,
        'timeout' => 120,
    ]));
    file_put_contents('validations.csv', $response['body']);
    echo 'Guardado validations.csv (', strlen($response['body']), " bytes)\n";
});
