#!/usr/bin/env node
/**
 * Patch zod-prisma-types for Node v22+ compatibility.
 *
 * Node v22 removed the `recursive` option from `fs.rmdirSync()`.
 * This script patches the library to use `fs.rmSync()` instead.
 *
 * Run via: node scripts/patch-zod-prisma-types.mjs
 * Or automatically via postinstall script.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetFile = resolve(
  __dirname,
  '../packages/database/node_modules/zod-prisma-types/dist/classes/directoryHelper.js'
);

if (!existsSync(targetFile)) {
  console.log(
    '[patch] zod-prisma-types not installed yet, skipping patch.'
  );
  process.exit(0);
}

let content = readFileSync(targetFile, 'utf-8');
const OLD = 'fs_1.default.rmdirSync(path, { recursive: true });';
const NEW =
  'fs_1.default.rmSync(path, { recursive: true, force: true });';

if (content.includes(OLD)) {
  content = content.replace(OLD, NEW);
  writeFileSync(targetFile, content, 'utf-8');
  console.log(
    '[patch] ✅ Patched zod-prisma-types: rmdirSync → rmSync (Node v22 compat)'
  );
} else if (content.includes(NEW)) {
  console.log('[patch] ℹ️  zod-prisma-types already patched.');
} else {
  console.log(
    '[patch] ⚠️  Could not find expected code in directoryHelper.js — manual check needed.'
  );
}
