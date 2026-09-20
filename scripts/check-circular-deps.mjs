#!/usr/bin/env node

/**
 * Sync ERP Architectural Gate: Circular Dependency Checker
 *
 * Scans TypeScript files in `apps/api/src/modules/` (and optionally `apps/api/src/`)
 * for circular dependencies (file-level elementary cycles, dynamic import workarounds,
 * and inter-module architectural cycles).
 *
 * Exit Codes:
 *   0: No circular dependencies detected (passes gate)
 *   1: Circular dependencies detected (fails gate)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function findRepoRoot(startDir = __dirname) {
  let current = path.resolve(startDir);
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'package.json')) && fs.existsSync(path.join(current, 'turbo.json'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(startDir, '..');
}

export function getAllTsFiles(dir, customIgnores = []) {
  const defaultIgnores = new Set(['node_modules', 'dist', 'test', '.turbo', '.git', ...customIgnores]);
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!defaultIgnores.has(entry.name)) {
        results.push(...getAllTsFiles(fullPath, customIgnores));
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

export function resolveCandidate(candidate) {
  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  const baseCandidate = candidate.replace(/\.(js|jsx|mjs)$/, '');
  for (const ext of extensions) {
    const p = (candidate !== baseCandidate ? baseCandidate : candidate) + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return p;
    }
  }
  return null;
}

export function resolveImportSpecifier(fromFile, specifier, { repoRoot, apiSrc, modulesDir, pathMappings = {} }) {
  if (specifier.startsWith('.')) {
    return resolveCandidate(path.resolve(path.dirname(fromFile), specifier));
  }

  for (const [aliasPattern, targetPatterns] of Object.entries(pathMappings)) {
    const prefix = aliasPattern.replace(/\*$/, '');
    if (specifier.startsWith(prefix)) {
      const rest = specifier.slice(prefix.length);
      for (const targetPattern of targetPatterns) {
        const targetPrefix = targetPattern.replace(/\*$/, '');
        const candidateBase = path.isAbsolute(targetPrefix)
          ? path.join(targetPrefix, rest)
          : path.resolve(apiSrc, targetPrefix, rest);
        const resolved = resolveCandidate(candidateBase);
        if (resolved) return resolved;
      }
    }
  }

  if (specifier.startsWith('@modules/')) {
    return resolveCandidate(path.join(modulesDir, specifier.replace('@modules/', '')));
  }
  if (specifier.startsWith('@src/') || specifier.startsWith('@/')) {
    return resolveCandidate(path.join(apiSrc, specifier.replace(/^@src\/|^@\//, '')));
  }
  if (specifier.startsWith('@middlewares/')) {
    return resolveCandidate(path.join(apiSrc, 'middlewares', specifier.replace('@middlewares/', '')));
  }
  if (specifier.startsWith('@routes/')) {
    return resolveCandidate(path.join(apiSrc, 'routes', specifier.replace('@routes/', '')));
  }
  if (specifier.startsWith('@sync-erp/database')) {
    return resolveCandidate(path.join(repoRoot, 'packages/database/src', specifier.replace('@sync-erp/database', '')));
  }
  if (specifier.startsWith('@sync-erp/shared')) {
    return resolveCandidate(path.join(repoRoot, 'packages/shared/src', specifier.replace('@sync-erp/shared', '')));
  }

  return null;
}

export function getModuleName(filePath, modulesDir, apiSrc) {
  if (filePath.startsWith(modulesDir)) {
    return path.relative(modulesDir, filePath).split(path.sep)[0];
  }
  if (filePath.startsWith(apiSrc)) {
    const rel = path.relative(apiSrc, filePath).split(path.sep);
    return rel.length > 1 ? rel[0] : 'root';
  }
  return 'external';
}

export function canonicalCycleKey(cycle) {
  if (!cycle || cycle.length === 0) return '';
  let minIndex = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cycle[i] < cycle[minIndex]) {
      minIndex = i;
    }
  }
  const rotated = [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
  return rotated.join(' -> ');
}

export function findElementaryCycles(nodes, adjList) {
  const nodeIndex = new Map(nodes.map((n, i) => [n, i]));
  const cycles = [];
  const cycleKeys = new Set();

  for (let i = 0; i < nodes.length; i++) {
    const start = nodes[i];
    const subAdj = new Map();
    for (let j = i; j < nodes.length; j++) {
      const u = nodes[j];
      const validNeighbors = (adjList.get(u) || []).filter(v => (nodeIndex.get(v) ?? -1) >= i);
      subAdj.set(u, validNeighbors);
    }

    const stack = [];
    const blocked = new Set();
    const bMap = new Map();
    for (let j = i; j < nodes.length; j++) {
      bMap.set(nodes[j], new Set());
    }

    function unblock(u) {
      blocked.delete(u);
      for (const w of bMap.get(u) || []) {
        bMap.get(u).delete(w);
        if (blocked.has(w)) unblock(w);
      }
    }

    function circuit(u) {
      let f = false;
      stack.push(u);
      blocked.add(u);

      for (const w of subAdj.get(u) || []) {
        if (w === start) {
          const cycle = [...stack];
          const key = canonicalCycleKey(cycle);
          if (!cycleKeys.has(key)) {
            cycleKeys.add(key);
            cycles.push(cycle);
          }
          f = true;
        } else if (!blocked.has(w)) {
          if (circuit(w)) f = true;
        }
      }

      if (f) {
        unblock(u);
      } else {
        for (const w of subAdj.get(u) || []) {
          bMap.get(w)?.add(u);
        }
      }

      stack.pop();
      return f;
    }

    circuit(start);
  }

  return cycles;
}

export function runCircularDependencyCheck(options = {}) {
  const root = options.repoRoot || findRepoRoot();
  const apiSrc = options.apiSrc || path.join(root, 'apps/api/src');
  const modulesDir = options.modulesDir || path.join(apiSrc, 'modules');
  const scanDir = options.scanDir || modulesDir;
  const includeDynamic = options.includeDynamic ?? true;
  const includeTypeOnly = options.includeTypeOnly ?? false;
  const checkModuleCycles = options.checkModuleCycles ?? true;
  const pathMappings = options.pathMappings || {};
  const maxCycles = options.maxCycles ?? 0;

  const allFiles = options.files || getAllTsFiles(scanDir);
  const edges = [];

  for (const file of allFiles) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

    function visit(node) {
      let spec = null;
      let isTypeOnly = false;
      let isDynamic = false;

      if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          spec = node.moduleSpecifier.text;
          isTypeOnly = !!node.importClause?.isTypeOnly;
          if (!isTypeOnly && !node.importClause?.name && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            const elements = node.importClause.namedBindings.elements;
            if (elements.length > 0 && elements.every(el => el.isTypeOnly)) {
              isTypeOnly = true;
            }
          }
        }
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          spec = node.moduleSpecifier.text;
          isTypeOnly = !!node.isTypeOnly;
          if (!isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)) {
            const elements = node.exportClause.elements;
            if (elements.length > 0 && elements.every(el => el.isTypeOnly)) {
              isTypeOnly = true;
            }
          }
        }
      } else if (
        includeDynamic &&
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          spec = arg.text;
          isDynamic = true;
        }
      }

      if (spec) {
        const target = resolveImportSpecifier(file, spec, {
          repoRoot: root,
          apiSrc,
          modulesDir,
          pathMappings,
        });

        if (target && target.startsWith(scanDir)) {
          if (!isTypeOnly || includeTypeOnly) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            edges.push({
              from: file,
              to: target,
              line,
              isTypeOnly,
              isDynamic,
              spec,
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  // 1. File-level elementary cycle search
  const fileAdj = new Map();
  for (const f of allFiles) fileAdj.set(f, []);
  for (const e of edges) {
    if (fileAdj.has(e.from)) {
      fileAdj.get(e.from).push(e.to);
    }
  }

  const rawFileCycles = findElementaryCycles(allFiles, fileAdj);
  const fileCycles = rawFileCycles.map(c => ({
    cycle: c,
    edges: c.map((u, idx) => {
      const v = c[(idx + 1) % c.length];
      return edges.find(e => e.from === u && e.to === v) || { from: u, to: v, line: '?' };
    }),
  }));

  // 2. Module-level cycle detection
  const moduleMutualPairs = [];
  const moduleTransitiveCycles = [];
  if (checkModuleCycles) {
    const modEdgesMap = new Map();
    for (const e of edges) {
      const mFrom = getModuleName(e.from, modulesDir, apiSrc);
      const mTo = getModuleName(e.to, modulesDir, apiSrc);
      if (mFrom !== mTo && mFrom !== 'root' && mTo !== 'root' && mFrom !== 'external' && mTo !== 'external') {
        const key = `${mFrom}->${mTo}`;
        if (!modEdgesMap.has(key)) {
          modEdgesMap.set(key, { from: mFrom, to: mTo, count: 0, samples: [] });
        }
        const item = modEdgesMap.get(key);
        item.count++;
        if (item.samples.length < 3) {
          item.samples.push(e);
        }
      }
    }

    const uniqueModules = [...new Set(allFiles.map(f => getModuleName(f, modulesDir, apiSrc)).filter(m => m !== 'root' && m !== 'external'))].sort();
    const modAdj = new Map(uniqueModules.map(m => [m, new Set()]));
    for (const item of modEdgesMap.values()) {
      modAdj.get(item.from)?.add(item.to);
    }

    // A. 2-module bilateral mutual couplings (A <-> B)
    const checkedPairs = new Set();
    const mutualKeySet = new Set();
    for (const m1 of uniqueModules) {
      for (const m2 of modAdj.get(m1) || []) {
        if (modAdj.get(m2)?.has(m1)) {
          const pairKey = [m1, m2].sort().join(' <-> ');
          mutualKeySet.add(`${m1}->${m2}`);
          mutualKeySet.add(`${m2}->${m1}`);
          if (!checkedPairs.has(pairKey)) {
            checkedPairs.add(pairKey);
            moduleMutualPairs.push({
              modules: [m1, m2],
              edge1: modEdgesMap.get(`${m1}->${m2}`),
              edge2: modEdgesMap.get(`${m2}->${m1}`),
            });
          }
        }
      }
    }

    // B. Transitive cycles (length >= 3) composed of non-mutual edges
    const transAdj = new Map(uniqueModules.map(m => [m, []]));
    for (const [m1, targets] of modAdj) {
      for (const m2 of targets) {
        if (!mutualKeySet.has(`${m1}->${m2}`)) {
          transAdj.get(m1).push(m2);
        }
      }
    }

    for (const start of uniqueModules) {
      function dfs(curr, pathNodes, visited) {
        for (const next of transAdj.get(curr) || []) {
          if (next === start && pathNodes.length >= 3) {
            moduleTransitiveCycles.push({
              modules: [...pathNodes],
              cycleEdges: pathNodes.map((u, idx) => {
                const v = pathNodes[(idx + 1) % pathNodes.length];
                return modEdgesMap.get(`${u}->${v}`) || { from: u, to: v, count: 0, samples: [] };
              }),
            });
          } else if (!visited.has(next) && next > start) {
            visited.add(next);
            dfs(next, [...pathNodes, next], visited);
            visited.delete(next);
          }
        }
      }
      dfs(start, [start], new Set([start]));
    }
  }

  const moduleCycleCount = moduleMutualPairs.length + moduleTransitiveCycles.length;
  const totalCycleCount = fileCycles.length + moduleCycleCount;
  const hasErrors = totalCycleCount > maxCycles;

  return {
    repoRoot: root,
    scanDir,
    totalFiles: allFiles.length,
    totalEdges: edges.length,
    includeDynamic,
    includeTypeOnly,
    fileCycles,
    moduleMutualPairs,
    moduleTransitiveCycles,
    moduleCycleCount,
    totalCycleCount,
    hasErrors,
  };
}

export function formatReport(result) {
  const rel = p => path.relative(result.repoRoot, p);
  const lines = [];

  lines.push('='.repeat(72));
  lines.push('  SYNC ERP ARCHITECTURAL GATE: CIRCULAR DEPENDENCY CHECK');
  lines.push('='.repeat(72));
  lines.push(`Scan Scope:             ${rel(result.scanDir)} (${result.totalFiles} files scanned)`);
  lines.push(`Import Edges Evaluated: ${result.totalEdges}`);
  lines.push(`Dynamic Imports:        ${result.includeDynamic ? 'Included' : 'Ignored'}`);
  lines.push(`Type-Only Imports:      ${result.includeTypeOnly ? 'Included' : 'Excluded'}`);
  lines.push('-'.repeat(72));

  if (result.fileCycles.length > 0) {
    lines.push(`\n❌ ERROR: Found ${result.fileCycles.length} file-level circular dependency cycle(s):\n`);
    result.fileCycles.forEach((fc, idx) => {
      lines.push(`[File Cycle #${idx + 1}] (${fc.cycle.length} files)`);
      for (const edge of fc.edges) {
        const dynamicTag = edge.isDynamic ? ' [DYNAMIC IMPORT]' : '';
        lines.push(`  ${rel(edge.from)}:${edge.line || '?'}${dynamicTag}`);
        lines.push(`    ↳ imports ${rel(edge.to)}`);
      }
      lines.push('');
    });
  } else {
    lines.push('\n✅ No file-level circular dependencies detected.');
  }

  if (result.moduleMutualPairs.length > 0 || result.moduleTransitiveCycles.length > 0) {
    lines.push(`\n❌ ERROR: Found ${result.moduleCycleCount} inter-module architectural coupling(s):\n`);

    if (result.moduleMutualPairs.length > 0) {
      lines.push(`-- Bilateral Mutual Dependencies (${result.moduleMutualPairs.length} pairs) --`);
      result.moduleMutualPairs.forEach((mc, idx) => {
        lines.push(`[Mutual Pair #${idx + 1}] ${mc.modules[0]} <───> ${mc.modules[1]}`);
        const sample1 = mc.edge1.samples[0];
        const sample2 = mc.edge2.samples[0];
        const text1 = sample1 ? ` (e.g. ${rel(sample1.from)}:${sample1.line})` : '';
        const text2 = sample2 ? ` (e.g. ${rel(sample2.from)}:${sample2.line})` : '';
        lines.push(`  ${mc.modules[0]} ──> ${mc.modules[1]} [${mc.edge1.count || mc.edge1.samples.length} import(s)]${text1}`);
        lines.push(`  ${mc.modules[1]} ──> ${mc.modules[0]} [${mc.edge2.count || mc.edge2.samples.length} import(s)]${text2}`);
        lines.push('');
      });
    }

    if (result.moduleTransitiveCycles.length > 0) {
      lines.push(`-- Multilateral Transitive Cycles (${result.moduleTransitiveCycles.length} cycles) --`);
      result.moduleTransitiveCycles.forEach((tc, idx) => {
        const chain = `${tc.modules.join(' ──> ')} ──> ${tc.modules[0]}`;
        lines.push(`[Transitive Cycle #${idx + 1}] ${chain} (${tc.modules.length} modules)`);
        for (const edge of tc.cycleEdges) {
          const sample = edge.samples[0];
          const text = sample ? ` (e.g. ${rel(sample.from)}:${sample.line})` : '';
          lines.push(`  ${edge.from} ──> ${edge.to} [${edge.count || edge.samples.length} import(s)]${text}`);
        }
        lines.push('');
      });
    }
  } else {
    lines.push('✅ No inter-module circular couplings detected.');
  }

  lines.push('='.repeat(72));
  if (result.hasErrors) {
    lines.push('FAILED: Architectural invariants violated. Refactoring or port abstraction required.');
  } else {
    lines.push('PASSED: All scanned files and modules satisfy acyclic architectural invariants.');
  }
  lines.push('='.repeat(72));

  return lines.join('\n');
}

export function parseCliArgs(argv = process.argv.slice(2), repoRoot = findRepoRoot()) {
  const apiSrc = path.join(repoRoot, 'apps/api/src');
  const modulesDir = path.join(apiSrc, 'modules');
  const options = {
    repoRoot,
    apiSrc,
    modulesDir,
    scanDir: modulesDir,
    includeDynamic: true,
    includeTypeOnly: false,
    checkModuleCycles: true,
    json: false,
    maxCycles: 0,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all' || arg === '--scope=src') {
      options.scanDir = apiSrc;
    } else if (arg === '--include-types') {
      options.includeTypeOnly = true;
    } else if (arg === '--no-dynamic') {
      options.includeDynamic = false;
    } else if (arg === '--no-module-cycles') {
      options.checkModuleCycles = false;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--max-cycles') {
      options.maxCycles = parseInt(argv[++i], 10) || 0;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Sync ERP Circular Dependency Checker

Usage: node scripts/check-circular-deps.mjs [options]

Options:
  --all, --scope=src    Scan entire apps/api/src directory (default: apps/api/src/modules)
  --include-types       Include type-only imports in cycle analysis
  --no-dynamic          Ignore dynamic import('...') calls
  --no-module-cycles    Skip inter-module architectural coupling checks
  --max-cycles <N>      Allow up to N cycles before exiting with failure (default: 0)
  --json                Output results in JSON format
  --help, -h            Show this help message
`);
      process.exit(0);
    }
  }

  return options;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const options = parseCliArgs(process.argv.slice(2));
  const result = runCircularDependencyCheck(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatReport(result));
  }

  process.exitCode = result.hasErrors ? 1 : 0;
}
