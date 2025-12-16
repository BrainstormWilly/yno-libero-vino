/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: ['build/', 'node_modules/', '.react-router/'],
  extends: ['eslint:recommended'],
  rules: {
    'prefer-const': 'warn',
    'no-extra-semi': 'warn',
    'no-case-declarations': 'warn',
    'no-empty-pattern': 'warn',
  },
  overrides: [
    // TypeScript files
    {
      files: ['**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint', 'import'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/recommended',
        'plugin:import/typescript',
      ],
      settings: {
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
          },
          node: {
            extensions: ['.ts', '.tsx'],
          },
        },
        'import/internal-regex': '^~/',
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/no-explicit-any': 'warn',
        'import/export': 'warn',
        'prefer-const': 'warn',
        'no-extra-semi': 'warn',
        'no-case-declarations': 'warn',
        'no-empty-pattern': 'warn',
      },
    },
    // React/TSX files
    {
      files: ['**/*.{tsx,jsx}'],
      plugins: ['react', 'react-hooks', 'jsx-a11y'],
      extends: [
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
      ],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'react/no-unescaped-entities': 'warn',
        'react-hooks/exhaustive-deps': 'warn',
        'jsx-a11y/click-events-have-key-events': 'warn',
        'jsx-a11y/no-static-element-interactions': 'warn',
      },
    },
  ],
};

