import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);

const roots = ['apps', 'packages', 'deploy', 'docs', 'scripts'];
const allowedPrefixes = [
  'docs/case-studies/',
  'scripts/customer-data/',
];
const allowedFiles = new Set(['scripts/productization-guard.mjs']);
const ignoredDirs = new Set([
  '.git',
  '.turbo',
  '.wwebjs_auth',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'storage',
  'tmp',
]);
const textExtensions = new Set([
  '.cjs',
  '.css',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.prisma',
  '.sh',
  '.sql',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);
const blockedPatterns = [
  /\bSL[-_]/,
  /Santi Living/i,
  /Santi Mebel/i,
  /\bSanti\b/i,
  /santi-living/i,
  /SL-SM/i,
  /Ongkir/i,
  /khusnudhoni/i,
  /Cemoro123/i,
  /changeme/i,
];

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function isAllowed(repoPath) {
  return (
    allowedFiles.has(repoPath) ||
    allowedPrefixes.some((prefix) => repoPath.startsWith(prefix))
  );
}

function shouldRead(filePath) {
  return textExtensions.has(path.extname(filePath));
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(dir, entry.name);
    const repoPath = toRepoPath(absolutePath);

    if (isAllowed(repoPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      walk(absolutePath, files);
    } else if (entry.isFile() && shouldRead(absolutePath)) {
      files.push(absolutePath);
    }
  }
}

const files = [];
for (const root of roots) {
  const absoluteRoot = path.join(repoRoot, root);
  if (fs.existsSync(absoluteRoot)) {
    walk(absoluteRoot, files);
  }
}

const findings = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of blockedPatterns) {
      if (pattern.test(line)) {
        findings.push(`${toRepoPath(file)}:${index + 1}: ${pattern}`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error(
    'Customer-specific productization guard failed:\n' +
      findings.join('\n')
  );
  process.exit(1);
}

console.log('Productization guard passed.');
