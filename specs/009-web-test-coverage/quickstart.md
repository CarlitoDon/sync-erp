# Quickstart: Frontend Tests

**Feature**: 009-web-test-coverage

## Prerequisites

- Node.js > 18
- VS Code (recommended)

## Config

Environment variables are mocked in tests. No `.env` setup required for unit/component tests.

## Running Tests

### Unit Tests

Run all tests:

```bash
npm run test --workspace=@sync-erp/web
```

Run specific test file:

```bash
npm run test --workspace=@sync-erp/web -- test/path/to/file.test.tsx
```

### Coverage

Generate coverage report:

```bash
npm run test:coverage --workspace=@sync-erp/web
```

Coverage report location: `apps/web/coverage/index.html`

## CLI Commands

| Command                 | Description              |
| :---------------------- | :----------------------- |
| `npm run test`          | Run tests in watch mode  |
| `npm run test:run`      | Run tests once (CI)      |
| `npm run test:coverage` | Generate coverage report |
