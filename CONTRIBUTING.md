# Cómo contribuir

Los issues y los pull requests son bienvenidos.

## Reportar un error o pedir un cambio

Abre un issue con el formulario de [reporte de error](https://github.com/veriko-mx-labs/examples/issues/new?template=bug_report.yml) o de [solicitud de mejora](https://github.com/veriko-mx-labs/examples/issues/new?template=feature_request.yml). Antes, busca entre los issues abiertos.

Un reporte de error necesita las versiones que usas, los pasos para reproducirlo y, cuando la API respondió con un error, su `request_id`. Quita las claves de API, los comprobantes, los números de cuenta y los datos de clientes de todo lo que pegues.

No abras un issue público para una vulnerabilidad de seguridad. Sigue [SECURITY.md](SECURITY.md).

## Proponer un cambio

1. Si el cambio es más grande que una corrección, abre antes un issue para acordarlo antes de escribirlo.
2. Haz un fork del repositorio y crea una rama desde `main`.
3. Haz el cambio. Agrega el ejemplo con su línea `veriko:operation` y su fila en el README.
4. Corre las comprobaciones de este repositorio:

   ```bash
   npm ci
   npm run lint
   npm test
   ```

   `npm run lint` revisa la sintaxis de cada ejemplo con los intérpretes que tengas instalados: `bash`, `node`, `python3` y `php`. El CI también corre `node scripts/check-syntax.mjs --require`, que falla cuando falta un intérprete. Usa Node.js 18 o posterior, Python 3.9 o posterior y PHP 8.1 o posterior.
5. Actualiza README.md cuando cambie lo que ven quienes usan los ejemplos.
6. Abre un pull request contra `main` y llena la plantilla.

Escribe los mensajes de commit en español, en imperativo, y deja un solo cambio por commit.

Un ejemplo nuevo necesita una línea `veriko:operation` que declare las operaciones que llama y una fila en la tabla de flujos del README. `npm test` revisa las dos contra el spec.

Los ejemplos no envían datos reales. Usa transferencias inventadas y lee la clave de API de `VERIKO_API_KEY`.

## El contrato de la API

El contrato de la API es el spec público en <https://docs.veriko.mx/openapi.yaml>. `spec/openapi.yaml` es una copia que sincroniza un workflow programado. No la edites a mano. Cuando la API se comporte distinto del spec, abre un issue.
