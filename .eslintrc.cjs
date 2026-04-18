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
      { argsIgnorePattern: '^_' },
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
      files: ['**/seed*.ts', '**/scripts/**/*.ts', '**/prisma/**/*.ts'],
      rules: {
        '@sync-erp/no-hardcoded-enum': 'off',
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
