<?php
// Handle API errors: check the HTTP status first, branch on `errors[].code`, show `detail` and `hint`.
//
//   VERIKO_API_KEY=veriko_... php php/error-handling.php
//
// This script sends an invalid request on purpose (a `422`). The API rejects it before it
// reaches Banxico, so it consumes no quota.
// Branch on `code`: it is stable and never translated. `detail` changes with the
// `Accept-Language` header and may be reworded, so show it but do not compare it.
//
// veriko:operation POST /validate body=amount,beneficiary_account

declare(strict_types=1);

require __DIR__ . '/client.php';

run(function (): void {
    try {
        // Neither `tracking_key` nor `numeric_reference`: the API cannot look the payment up.
        api('POST', '/validate', ['timeout' => SYNC_TIMEOUT, 'body' => ['amount' => 100, 'beneficiary_account' => '012180004412345678']]);
    } catch (ApiError $error) {
        if ($error->transport) {
            throw $error; // a timeout or a network failure
        }
        // A 422 lists a summary entry and then one entry per invalid field: read the whole array.
        foreach ($error->errors as $entry) {
            $pointer = $entry['source']['pointer'] ?? null;
            echo $entry['code'], $pointer ? " at {$pointer}" : '', ': ', $entry['detail'], "\n";
        }
        switch ($error->errorCode) {
            case 'quota_exceeded':
                echo "The plan quota is spent. Do not retry; upgrade the plan or wait for the renewal.\n";
                break;
            case 'rate_limit_exceeded':
                echo 'Rate limited. Retry after ', $error->retryAfter ?? 60, " s.\n";
                break;
            default:
                echo 'Request ', $error->requestId ?? 'unknown', " failed with HTTP {$error->status}.\n";
        }
        exit(1);
    }
});
