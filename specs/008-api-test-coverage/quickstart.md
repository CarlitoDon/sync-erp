# Quickstart: API Test Coverage

## Prerequisites

- Node.js 18+
- `npm install` completed at repo root

## Setup (One-time)

```bash
# From repo root
cd apps/api
npm install @vitest/coverage-v8 --save-dev
```

## Running Coverage

```bash
# Generate coverage report
npm run test:coverage

# Or from repo root
npm run test:coverage --workspace=@sync-erp/api
```

## Viewing Reports

### Terminal Summary

Coverage summary is printed after test run:

```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   85.2  |    78.4  |   82.1  |   85.2  |
 services/          |   88.0  |    80.0  |   85.0  |   88.0  |
 routes/            |   82.0  |    75.0  |   80.0  |   82.0  |
--------------------|---------|----------|---------|---------|
```

### HTML Report

Open in browser:

```bash
# macOS
open apps/api/coverage/index.html

# Windows
start apps/api/coverage/index.html

# Linux
xdg-open apps/api/coverage/index.html
```

## Threshold Behavior

| Scenario          | Exit Code | Meaning |
| ----------------- | --------- | ------- |
| All metrics ≥ 80% | 0         | Success |
| Any metric < 80%  | 1         | Failure |

## Common Issues

### "Coverage provider is not available"

```bash
npm install @vitest/coverage-v8 --save-dev
```

### Low branch coverage

- Check for uncovered `else` branches
- Review early returns in functions
- Add edge case tests
