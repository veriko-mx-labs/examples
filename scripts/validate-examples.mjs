// Checks every example against the public OpenAPI spec in spec/openapi.yaml.
//
// The file list comes from the directory tree, so a new example is checked without editing this
// script. Each example declares the operations it calls with one annotation per operation:
//
//   veriko:operation METHOD /path[?query] [query=a,b] [headers=A,B] [body=x,y]
//
// The script checks the annotation against the spec (operation, M2M security, query parameters,
// headers, request body fields, required fields), checks the source against the annotation (every
// request in the code is declared, every declared name appears in the code), compares the
// terminal status lists with the spec, and checks that each example is listed in README.md.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGUAGE_DIRECTORIES = ['curl', 'node', 'python', 'php'];
const EXAMPLE_EXTENSIONS = new Set(['.sh', '.mjs', '.py', '.php']);
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
// Headers every example may send besides the ones the operation declares.
const COMMON_HEADERS = new Set(['Authorization', 'Content-Type', 'Accept', 'Accept-Language']);
// A synchronous validation can take over a minute: the client must wait at least this long.
const SYNC_TIMEOUT_SECONDS = 75;

const specText = readFileSync(join(ROOT, 'spec', 'openapi.yaml'), 'utf8');
const spec = parse(specText);
const failures = [];
const fail = (file, message) => failures.push(`${file}: ${message}`);

// ---------------------------------------------------------------- spec helpers

function resolve(node) {
  let current = node;
  while (current && typeof current === 'object' && '$ref' in current) {
    current = current.$ref
      .replace(/^#\//u, '')
      .split('/')
      .reduce((value, key) => value?.[key], spec);
  }
  return current;
}

// `/validations/{id}/cep` and `/validations/${id}/cep` both become `/validations/{}/cep`.
function normalizePath(path) {
  return path
    .split('?')[0]
    .replace(/\$\{[^}]*\}|\{\$[^}]*\}|\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*/gu, '{}')
    .replace(/\/+$/u, '');
}

// Keyed by method and path with every parameter collapsed to `{}`. A literal segment such as
// `/validations/export` is a different key from `/validations/{}`, so the most specific template
// always wins.
const operations = new Map();
for (const [template, item] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    if (item[method]) operations.set(`${method.toUpperCase()} ${normalizePath(template)}`, { operation: item[method], template, item });
  }
}

const operationFor = (method, path) => operations.get(`${method} ${normalizePath(path)}`);

function parametersOf({ operation, item }, location) {
  return [...(item.parameters ?? []), ...(operation.parameters ?? [])]
    .map(resolve)
    .filter((parameter) => parameter?.in === location)
    .map((parameter) => parameter.name);
}

function requestSchema(entry) {
  const content = resolve(entry.operation.requestBody)?.content ?? {};
  const media = content['application/json'] ?? Object.values(content)[0];
  return media ? resolve(media.schema) : undefined;
}

// Collects the property names of a schema and of everything nested in it.
function propertyNames(schema, names = new Set(), seen = new Set()) {
  const resolved = resolve(schema);
  if (!resolved || typeof resolved !== 'object' || seen.has(resolved)) return names;
  seen.add(resolved);
  for (const [name, property] of Object.entries(resolved.properties ?? {})) {
    names.add(name);
    propertyNames(property, names, seen);
  }
  for (const part of [...(resolved.allOf ?? []), ...(resolved.oneOf ?? []), ...(resolved.anyOf ?? [])]) propertyNames(part, names, seen);
  if (resolved.items) propertyNames(resolved.items, names, seen);
  return names;
}

function requiredNames(schema) {
  const resolved = resolve(schema);
  if (!resolved) return [];
  const names = [...(resolved.required ?? [])];
  for (const part of resolved.allOf ?? []) names.push(...requiredNames(part));
  return names;
}

function isM2M(operation) {
  const schemes = operation.security ?? spec.security ?? [];
  return schemes.length === 0 || schemes.some((alternative) => 'ApiKeyAuth' in alternative);
}

function collectTerminalSets() {
  const sets = [];
  const visit = (node) => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === 'object') {
      if (Array.isArray(node['x-terminal-values'])) sets.push(new Set(node['x-terminal-values']));
      Object.values(node).forEach(visit);
    }
  };
  visit(spec);
  return sets;
}
const TERMINAL_SETS = collectTerminalSets();
const VALIDATION_TERMINAL = TERMINAL_SETS.find((set) => set.has('valid'));
const EXPORT_TERMINAL = TERMINAL_SETS.find((set) => set.has('ready'));
if (!VALIDATION_TERMINAL || !EXPORT_TERMINAL) throw new Error('The spec declares no x-terminal-values for validations or exports.');

const HEADER_PARAMETERS = new Set();
for (const item of Object.values(spec.paths)) {
  for (const method of METHODS) {
    for (const parameter of [...(item.parameters ?? []), ...(item[method]?.parameters ?? [])].map(resolve)) {
      if (parameter?.in === 'header') HEADER_PARAMETERS.add(parameter.name);
    }
  }
}

// ---------------------------------------------------------------- example files

function walk(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    if (['node_modules', '__pycache__', 'vendor'].includes(entry) || entry.startsWith('.')) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (EXAMPLE_EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) found.push(path);
  }
  return found;
}

const files = LANGUAGE_DIRECTORIES.flatMap((directory) => walk(join(ROOT, directory)))
  .map((path) => relative(ROOT, path).split(sep).join('/'))
  .sort();
if (files.length === 0) throw new Error('No example files found.');

const ANNOTATION = /veriko:operation\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*)([^\n]*)/gu;

function annotationsOf(file, source) {
  const annotations = [];
  for (const match of source.matchAll(ANNOTATION)) {
    const [, method, rawPath, rest] = match;
    const options = { query: [], headers: [], body: [] };
    for (const option of rest.trim().split(/\s+/u).filter(Boolean)) {
      const [name, value = ''] = option.split('=');
      if (name in options) options[name] = value.split(',').filter(Boolean);
      else fail(file, `unknown annotation option "${name}"`);
    }
    const [path, inlineQuery] = rawPath.split('?');
    for (const pair of (inlineQuery ?? '').split('&').filter(Boolean)) {
      const name = pair.split('=')[0];
      if (!options.query.includes(name)) options.query.push(name);
    }
    annotations.push({ method, path, key: `${method} ${normalizePath(path)}`, ...options });
  }
  return annotations;
}

// Requests written in the source: `api('POST', '/validate')`, `api POST /validate`, `api_retry GET "/x"`.
const CODE_REQUEST = /['"](GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*f?(["'`])(\/[^"'`\n]*)\2/gu;
const SHELL_REQUEST = /\bapi(?:_retry)?\s+(GET|POST|PUT|PATCH|DELETE)\s+["']?(\/[^"'\s]*)/gu;

function requestsOf(source) {
  const requests = [];
  for (const match of source.matchAll(CODE_REQUEST)) requests.push({ method: match[1], path: match[3] });
  for (const match of source.matchAll(SHELL_REQUEST)) requests.push({ method: match[1], path: match[2] });
  return requests.map(({ method, path }) => ({
    method,
    path,
    key: `${method} ${normalizePath(path)}`,
    query: (path.split('?')[1] ?? '').split('&').filter(Boolean).map((pair) => pair.split('=')[0]),
  }));
}

function helperFor(file, source) {
  const directory = dirname(file);
  return ['client.mjs', 'client.py', 'client.php', 'lib.sh']
    .map((name) => `${directory}/${name}`)
    .find((candidate) => files.includes(candidate) && candidate !== file && /\b(?:client|lib)(?:\.\w+)?\b/u.test(source));
}

const wordPattern = (name) => new RegExp(`(?<![A-Za-z0-9_-])${name.replace(/[\\^$*+?.()|[\]{}]/gu, '\\$&')}(?![A-Za-z0-9_-])`, 'u');

function checkStatusList(file, source, label, expected) {
  for (const line of source.split('\n')) {
    if (!new RegExp(`\\b${label}\\s*=`, 'u').test(line)) continue;
    const text = line.slice(line.search(new RegExp(`\\b${label}\\b`, 'u')) + label.length);
    const quoted = [...text.matchAll(/["']([^"']*)["']/gu)].map((match) => match[1]);
    const actual = new Set(quoted.flatMap((chunk) => chunk.split(/[^a-z_]+/u)).filter(Boolean));
    const missing = [...expected].filter((status) => !actual.has(status));
    const extra = [...actual].filter((status) => !expected.has(status));
    if (missing.length > 0 || extra.length > 0) {
      fail(file, `${label} differs from the spec (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
    }
  }
}

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const sources = new Map(files.map((file) => [file, readFileSync(join(ROOT, file), 'utf8')]));
const annotationsByFile = new Map(files.map((file) => [file, annotationsOf(file, sources.get(file))]));
const covered = new Map(); // `METHOD template` -> languages

for (const file of files) {
  const source = sources.get(file);
  const annotations = annotationsByFile.get(file);
  const isSdk = file.includes('/sdk/');
  const language = file.split('/')[0];
  const helper = helperFor(file, source);
  const helperAnnotations = helper ? annotationsByFile.get(helper) : [];

  const isHelper = /\/(?:client\.(?:mjs|py|php)|lib\.sh)$/u.test(file);
  const isReceiver = source.includes('veriko:receiver');

  if (annotations.length === 0 && !isReceiver) fail(file, 'has no `veriko:operation` or `veriko:receiver` annotation');

  // A webhook receiver sends no request. It must read the headers the spec names and apply the 5-minute window.
  if (isReceiver) {
    for (const header of ['X-Webhook-Signature-Timestamped', 'X-Webhook-Signature-Old']) {
      if (!specText.includes(header)) fail(file, `the spec does not mention the header ${header}`);
      if (!new RegExp(header.replaceAll('-', '[-_]'), 'iu').test(source)) fail(file, `does not read ${header}`);
    }
    if (!/\b300\b/u.test(source)) fail(file, 'does not apply the 5-minute (300 s) tolerance window');
    if (!/timingSafeEqual|compare_digest|hash_equals|verifyWebhookTimestamped|verify_webhook_timestamped/u.test(source)) fail(file, 'does not compare signatures in constant time');
  }

  // 1. The annotation against the spec, and against the source.
  for (const annotation of annotations) {
    const label = `${annotation.method} ${annotation.path}`;
    const entry = operationFor(annotation.method, annotation.path);
    if (!entry) {
      fail(file, `the spec does not declare ${label}`);
      continue;
    }
    if (!isM2M(entry.operation)) fail(file, `${label} is not available with an API key`);
    const coveredKey = `${annotation.method} ${entry.template}`;
    covered.set(coveredKey, new Set([...(covered.get(coveredKey) ?? []), language]));

    const queryNames = parametersOf(entry, 'query');
    for (const name of annotation.query) if (!queryNames.includes(name)) fail(file, `${label}: the spec declares no query parameter "${name}"`);
    const headerNames = parametersOf(entry, 'header');
    for (const name of annotation.headers) {
      if (!headerNames.includes(name) && !COMMON_HEADERS.has(name)) fail(file, `${label}: the spec declares no header "${name}"`);
    }

    const schema = requestSchema(entry);
    if (annotation.body.length > 0) {
      if (!schema) fail(file, `${label}: the operation takes no request body`);
      else {
        const names = propertyNames(schema);
        for (const name of annotation.body) {
          if (!names.has(name)) fail(file, `${label}: the request body has no field "${name}"`);
        }
        const missing = requiredNames(schema).filter((name) => !annotation.body.includes(name));
        if (missing.length > 0) fail(file, `${label}: required body fields not declared: ${missing.join(', ')}`);
      }
    }

    if (!isSdk) {
      for (const name of [...annotation.query, ...annotation.body, ...annotation.headers]) {
        if (!wordPattern(name).test(source)) fail(file, `${label}: "${name}" is declared but does not appear in the source`);
      }
    }
  }

  // 2. Every request in the code is declared and exists in the spec.
  const declared = new Map(annotations.map((annotation) => [annotation.key, annotation]));
  const found = requestsOf(source);
  for (const request of found) {
    if (!operationFor(request.method, request.path)) fail(file, `the spec does not declare ${request.method} ${request.path}`);
    const annotation = declared.get(request.key);
    if (!annotation) {
      fail(file, `${request.method} ${request.path} is called but not annotated`);
      continue;
    }
    for (const name of request.query) {
      if (!annotation.query.includes(name)) fail(file, `${request.method} ${request.path}: query parameter "${name}" is not annotated`);
    }
    // An operation whose body is required must declare it.
    const entry = operationFor(request.method, request.path);
    if (entry && resolve(entry.operation.requestBody)?.required && annotation.body.length === 0) {
      fail(file, `${request.method} ${request.path} requires a request body; declare it with body=`);
    }
  }
  // An annotated operation the file never sends must come from its helper, or from the SDK.
  const helperKeys = new Set(helperAnnotations.map((annotation) => annotation.key));
  const foundKeys = new Set(found.map((request) => request.key));
  for (const annotation of annotations) {
    if (isSdk || foundKeys.has(annotation.key) || helperKeys.has(annotation.key)) continue;
    fail(file, `${annotation.method} ${annotation.path} is annotated but the file never sends it`);
  }

  // 3. A header the spec declares may only appear when an annotation declares it (here or in the helper).
  const declaredHeaders = new Set([...annotations, ...helperAnnotations].flatMap((annotation) => annotation.headers));
  for (const name of HEADER_PARAMETERS) {
    if (!isSdk && !isHelper && wordPattern(name).test(source) && !declaredHeaders.has(name)) fail(file, `mentions the header "${name}" without declaring it in an annotation`);
  }

  // 4. The synchronous validation can take over a minute: the client must wait for it.
  const sendsSync = annotations.some((annotation) => ['POST /validate', 'POST /validate-ocr'].includes(annotation.key) && !annotation.query.includes('async'));
  if (sendsSync && !isSdk && !/SYNC_TIMEOUT/u.test(source)) fail(file, `sends a synchronous validation without SYNC_TIMEOUT (${SYNC_TIMEOUT_SECONDS} s)`);
  const timeout = source.match(/\bSYNC_TIMEOUT(_MS)?\s*=\s*([\d_]+)/u);
  if (timeout) {
    const seconds = Number(timeout[2].replaceAll('_', '')) / (timeout[1] ? 1000 : 1);
    if (seconds < SYNC_TIMEOUT_SECONDS) fail(file, `SYNC_TIMEOUT is ${seconds} s; use at least ${SYNC_TIMEOUT_SECONDS} s`);
  }

  // 5. Terminal status lists match the spec.
  checkStatusList(file, source, 'TERMINAL_STATUSES', VALIDATION_TERMINAL);
  checkStatusList(file, source, 'CEP_EXPORT_TERMINAL_STATUSES', EXPORT_TERMINAL);

  // 7. No hardcoded key, no em dash, credentials from the environment.
  if (/veriko_[A-Za-z0-9]{20,}/u.test(source)) fail(file, 'contains what looks like an API key');
  if (source.includes('—')) fail(file, 'contains an em dash');
  if (!isSdk && !helper && !/VERIKO_API_KEY|VERIKO_WEBHOOK_SECRET/u.test(source)) fail(file, 'does not read its credentials from the environment');

  // 8. Listed in the README.
  if (!isHelper && !readme.includes(`\`${file}\``)) fail(file, 'is not listed in README.md');
}

// README references that point nowhere.
for (const match of readme.matchAll(/`((?:curl|node|python|php)\/[^`\s]+\.(?:sh|mjs|py|php))`/gu)) {
  if (!files.includes(match[1])) fail('README.md', `lists ${match[1]}, which does not exist`);
}
if (readme.includes('—')) fail('README.md', 'contains an em dash');

if (failures.length > 0) {
  console.error(`${failures.length} problem(s):\n${failures.map((message) => `  ${message}`).join('\n')}`);
  process.exit(1);
}

const operationCount = [...operations.keys()].length;
console.log(`${files.length} example files checked against the spec; ${covered.size} of ${operationCount} operations exercised.`);
for (const [operation, languages] of [...covered].sort()) console.log(`  ${operation.padEnd(46)} ${[...languages].sort().join(', ')}`);
