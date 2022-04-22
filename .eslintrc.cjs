const path = require('pathe')

const rulesDirPlugin = require('eslint-plugin-rulesdir')

rulesDirPlugin.RULES_DIR = path.join(__dirname, 'eslint-rules')

module.exports = {
  parser: '@typescript-eslint/parser',
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
    'no-catch-all/no-catch-all': 'error',
    'no-console': 'error',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-var-requires': 'off',
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
            onlyDependOnLibsWithTargs: ['scope:foundation', 'features'],
          },
        ],
      },
    ],
    'rulesdir/command-flags-with-env': 'error',
    'rulesdir/command-conventional-flag-env': 'error',
  },
}
