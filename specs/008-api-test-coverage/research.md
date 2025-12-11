# Research: API Test Coverage

**Feature**: 008-api-test-coverage  
**Date**: 2025-12-11

## Coverage Provider

**Decision**: Use `@vitest/coverage-v8`

**Rationale**:

- V8 is the native JavaScript engine coverage tool, built into Node.js
- Faster than Istanbul because it uses native instrumentation
- No source transformation required
- Recommended default by Vitest documentation

**Alternatives Considered**:

- `@vitest/coverage-istanbul`: More mature, better branch coverage details, but slower due to source transformation. Not needed for our use case.

## Threshold Configuration

**Decision**: 80% threshold for all metrics (lines, branches, functions, statements)

**Rationale**:

- Industry standard for mature codebases
- Achievable without excessive mocking
- Hard fail ensures discipline

**Configuration**:

```typescript
coverage: {
  provider: 'v8',
  thresholds: {
    lines: 80,
    branches: 80,
    functions: 80,
    statements: 80,
  },
}
```

## File Exclusions

**Decision**: Exclude non-source files from coverage calculation

**Rationale**:

- Test files testing themselves is meaningless
- Generated files (dist/) are duplicates
- Config files are not business logic

**Patterns**:

```typescript
coverage: {
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/test/**',
    'vitest.config.ts',
  ],
  include: ['src/**/*.ts'],
}
```

## Report Formats

**Decision**: Generate both terminal summary and HTML report

**Rationale**:

- Terminal summary for quick CI feedback
- HTML report for detailed local debugging

**Configuration**:

```typescript
coverage: {
  reporter: ['text', 'html'],
  reportsDirectory: './coverage',
}
```

## Vitest Configuration Location

**Decision**: Use `vitest.config.ts` in `apps/api/`

**Rationale**:

- Vitest looks for config in project root by default
- Separates test config from build config (tsconfig)
- Already using Vitest in package.json scripts
