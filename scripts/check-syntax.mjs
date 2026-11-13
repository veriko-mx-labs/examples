// Checks the syntax of every example with the interpreter of its language:
// `bash -n`, `node --check`, Python's parser (3.9 grammar) and `php -l`.
//
//   node scripts/check-syntax.mjs            skips a language whose interpreter is not installed
//   node scripts/check-syntax.mjs --require  fails when an interpreter is missing

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRE_ALL = process.argv.includes('--require');

const PYTHON_PARSE = 'import ast, sys; ast.parse(open(sys.argv[1], encoding="utf-8").read(), sys.argv[1], feature_version=(3, 9))';
const CHECKS = {
  '.sh': { command: 'bash', args: (file) => ['-n', file] },
  '.mjs': { command: process.execPath, args: (file) => ['--check', file] },
  '.py': { command: 'python3', args: (file) => ['-I', '-c', PYTHON_PARSE, file] },
  '.php': { command: 'php', args: (file) => ['-l', file] },
};

function walk(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    if (['node_modules', '__pycache__', 'vendor'].includes(entry) || entry.startsWith('.')) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (extname(path) in CHECKS) found.push(path);
  }
  return found;
}

const files = ['curl', 'node', 'python', 'php'].flatMap((directory) => walk(join(ROOT, directory))).sort();
const available = new Map();
const isAvailable = (command) => {
  if (!available.has(command)) available.set(command, spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0);
  return available.get(command);
};

let checked = 0;
const problems = [];
const skipped = new Set();
for (const file of files) {
  const check = CHECKS[extname(file)];
  if (!isAvailable(check.command)) {
    skipped.add(check.command);
    continue;
  }
  const result = spawnSync(check.command, check.args(file), { encoding: 'utf8' });
  checked += 1;
  if (result.status !== 0) problems.push(`${relative(ROOT, file)}\n${(result.stderr || result.stdout).trim()}`);
}

if (REQUIRE_ALL && skipped.size > 0) problems.push(`missing interpreters: ${[...skipped].join(', ')}`);
if (problems.length > 0) {
  console.error(problems.join('\n\n'));
  process.exit(1);
}
console.log(`${checked} files passed the syntax check${skipped.size > 0 ? ` (skipped: ${[...skipped].join(', ')})` : ''}.`);
