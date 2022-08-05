const path = require('pathe')

const rulesDirPlugin = require('eslint-plugin-rulesdir')

rulesDirPlugin.RULES_DIR = path.join(__dirname, 'eslint-rules')

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    extraFileExtensions: ['.cjs'],
  },
  plugins: ['no-catch-all', 'jest', '@nrwl/nx', 'unused-imports', 'rulesdir'],
  extends: ['plugin:@shopify/typescript', 'plugin:@shopify/prettier', 'plugin:@shopify/node', 'prettier'],
  rules: {
    'prettier/prettier': ['error'],
    'import/order': [
      'error',
      {
        groups: ['index', 'sibling', 'parent', 'internal', 'external', 'builtin', 'object', 'type'],
      },
    ],
    'no-catch-shadow': 'off',
    'no-catch-all/no-catch-all': 'error',
    'no-console': 'error',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-explicit-any': [
      'error',
      {
        fixToUnknown: true,
      },
    ],
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'default',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow',
      },
      {
        selector: 'default',
        filter: {
          match: true,
          // Allow double underscores and React UNSAFE_ (for lifecycle hooks that are to be deprecated)
          regex: '^(__|UNSAFE_).+$',
        },
        format: null,
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: 'typeParameter',
        format: ['PascalCase'],
        prefix: ['T'],
      },
      {
        selector: 'interface',
        format: ['PascalCase'],
        custom: {
          regex: '^I[A-Z]',
          match: false,
        },
      },
      {
        selector: 'objectLiteralProperty',
        format: null,
      },
    ],
    'consistent-return': 'off',
    'import/no-cycle': 'off',
    'callback-return': 'off',
    'no-undefined': 'off',
    'node/no-deprecated-api': 'off',
    'import/no-extraneous-dependencies': 'error',
    'no-await-in-loop': 'error',
    'unused-imports/no-unused-imports': 'error',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'path',
            message: "Please use: import { path } from '@shopify/cli-kit'",
          },
          {
            name: 'node:path',
            message: "Please use: import { path } from '@shopify/cli-kit'",
          },
          {
            name: 'child_process',
            message: "Please use: import { system } from '@shopify/cli-kit'",
          },
          {
            name: 'node:child_process',
            message: "Please use: import { system } from '@shopify/cli-kit'",
          },
        ],
      },
    ],
    'jest/max-nested-describe': [
      'error',
      {
        max: 1,
      },
    ],
    'jest/no-disabled-tests': 'error',
    'jest/prefer-expect-resolves': 'error',
    '@nrwl/nx/enforce-module-boundaries': [
      'error',
      {
        allow: [],
        depConstraints: [
          {
            sourceTag: 'scope:feature',
            onlyDependOnLibsWithTargs: ['scope:foundation'],
          },
          {
            sourceTag: 'scope:cli',
            onlyDependOnLibsWithTargs: ['scope:foundation', 'scope:feature'],
          },
          {
            sourceTag: 'scope:create-cli',
            onlyDependOnLibsWithTargs: ['scope:foundation'],
          },
        ],
      },
    ],
    'rulesdir/command-flags-with-env': 'error',
    'rulesdir/command-conventional-flag-env': 'error',
    'rulesdir/command-reserved-flags': 'error',
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/(cannot|will not|do not)/i]',
        message: "Be human - prefer don't to do not, won't to will not etc.",
      },
      {
        selector: 'TemplateElement[value.raw=/(cannot|will not|do not)/i]',
        message: "Be human - prefer don't to do not, won't to will not etc.",
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-restricted-syntax': 'off',
      },
    },
  ],
}
