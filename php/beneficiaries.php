<?php
// Crea, lista, actualiza y elimina la cuenta de un beneficiario guardado.
//
//   VERIKO_API_KEY=veriko_... php php/beneficiaries.php
//
// Un beneficiario ayuda a que la validación por comprobante complete una cuenta que la imagen
// muestra enmascarada. La cuenta de abajo es de ejemplo; eliminar archiva al beneficiario. Las
// llamadas de beneficiarios no consumen cuota.
//
// veriko:operation POST /beneficiaries body=account_number,bank_code,label
// veriko:operation GET /beneficiaries
// veriko:operation PUT /beneficiaries/{id} body=label
// veriko:operation DELETE /beneficiaries/{id}

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function (): void {
    $created = api('POST', '/beneficiaries', ['body' => [
        'account_number' => '012180004412345678',
        'bank_code'      => '40012',
        'label'          => 'Proveedor de ejemplo',
    ]])['body'];
    $id = $created['data']['id'];
    echo "Creado {$id}\n";

    $list = api('GET', '/beneficiaries')['body'];
    echo count($list['data']), " beneficiarios\n";

    api('PUT', "/beneficiaries/{$id}", ['body' => ['label' => 'Proveedor de ejemplo (con otro nombre)']]);
    echo "Actualizado {$id}\n";

    api('DELETE', "/beneficiaries/{$id}");
    echo "Eliminado {$id}\n";
});
