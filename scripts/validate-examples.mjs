import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES = [
  ['curl/validate.sh', /-X\s+([A-Z]+)/u],
  ['node/validate.mjs', /method:\s*['"]([A-Z]+)['"]/u],
  ['python/validate.py', /requests\.([a-z]+)\s*\(/u],
  ['php/validate.php', /CURLOPT_POST\s*=>\s*true/u],
];

const spec = parse(readFileSync(join(ROOT, 'spec', 'openapi.yaml'), 'utf8'));

function methodOf(file, source, pattern) {
  const match = source.match(pattern);
  assert.ok(match, `${file}: no se pudo determinar el método HTTP`);
  if (file.endsWith('.php')) return 'post';
  return match[1].toLowerCase();
}

function pathsOf(file, source) {
  const paths = [
    ...source.matchAll(/https:\/\/api\.veriko\.mx\/v1(\/[A-Za-z0-9_{}$./-]+)/gu),
  ].map((match) => match[1]);
  assert.ok(paths.length > 0, `${file}: no contiene ninguna ruta de la API`);
  return paths;
}

function operationAt(path, method) {
  const found = Object.entries(spec.paths).find(([template]) => {
    const pattern = new RegExp(`^${template.replace(/\{[^/]+\}/g, '[^/]+')}$`, 'u');
    return pattern.test(path.replace(/\$\{[^/]+\}/g, 'valor'));
  });
  assert.ok(found, `el spec no declara ${method.toUpperCase()} ${path}`);
  const operation = found[1][method];
  assert.ok(operation, `el spec no declara ${method.toUpperCase()} ${path}`);
  return operation;
}

function acceptsApiKey(operation) {
  const schemes = operation.security ?? spec.security ?? [];
  return schemes.length === 0 || schemes.some((alternative) => 'ApiKeyAuth' in alternative);
}

let checked = 0;
for (const [file, methodPattern] of EXAMPLES) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const method = methodOf(file, source, methodPattern);
  for (const path of pathsOf(file, source)) {
    const operation = operationAt(path, method);
    assert.ok(acceptsApiKey(operation), `${method.toUpperCase()} ${path} no es M2M`);
    checked += 1;
  }
}

console.log(`${checked} rutas de ejemplo verificadas contra el spec público; todas son M2M.`);
