module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', '@sync-erp'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.config.js',
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@sync-erp/no-hardcoded-enum': 'error',
  },

  overrides: [
    {
      files: ['packages/shared/**'],
      rules: {
        '@sync-erp/no-hardcoded-enum': 'off',
      },
    },
    {
      // Seed data and scripts - legitimate hardcoded enum usage
      files: ['**/seed*.ts', '**/scripts/**/*.ts', 'scripts/**/*.ts', '**/prisma/**/*.ts'],
      rules: {
        '@sync-erp/no-hardcoded-enum': 'off',
        'no-console': 'off',
      },
    },
    {
      // MCP tool schemas and smoke/e2e harnesses intentionally expose enum values
      // as JSON-schema literals for external clients.
      files: ['apps/mcp/src/tools/**/*.ts', 'apps/mcp/src/e2e.ts', 'apps/mcp/src/smoke.ts'],
      rules: {
        '@sync-erp/no-hardcoded-enum': 'off',
        'no-console': 'off',
      },
    },
    {
      // Historical import scripts contain captured source enum values and CLI logging.
      files: ['storage/imports/**/*.ts'],
      rules: {
        '@sync-erp/no-hardcoded-enum': 'off',
        'no-console': 'off',
      },
    },
    {
      // Local maintenance scripts use broad replace callbacks by design.
      files: ['scripts/fix-test-any.ts', 'scripts/ts-morph-post.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      // Root migration checker is a Node CLI script.
      files: ['check-migrations.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-console': 'off',
      },
    },
    {
      // Bot service - needs console logging for service operations
      files: ['apps/bot/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-console': 'off',
        '@sync-erp/no-hardcoded-enum': 'off',
      },
    },
  ],
};
