const shopifyPlugin = require('@shopify/eslint-plugin')
const vitestPlugin = require('@vitest/eslint-plugin')
const unusedImportsPlugin = require('eslint-plugin-unused-imports')
const tsdocPlugin = require('eslint-plugin-tsdoc')
const jsdocPlugin = require('eslint-plugin-jsdoc')
const noCatchAllPlugin = require('eslint-plugin-no-catch-all')
const eslintConfigPrettier = require('eslint-config-prettier')
const globals = require('globals')

// Load rules directly to avoid circular dependency
const rules = {
  'command-flags-with-env': require('./rules/command-flags-with-env'),
  'command-conventional-flag-env': require('./rules/command-conventional-flag-env'),
  'command-reserved-flags': require('./rules/command-reserved-flags'),
  'no-error-factory-functions': require('./rules/no-error-factory-functions'),
  'no-process-cwd': require('./rules/no-process-cwd'),
  'no-trailing-js-in-cli-kit-imports': require('./rules/no-trailing-js-in-cli-kit-imports'),
  'no-vi-manual-mock-clear': require('./rules/no-vi-manual-mock-clear'),
  'no-vi-mock-in-callbacks': require('./rules/no-vi-mock-in-callbacks'),
  'prompt-message-format': require('./rules/prompt-message-format'),
  'specific-imports-in-bootstrap-code': require('./rules/specific-imports-in-bootstrap-code'),
  'banner-headline-format': require('./rules/banner-headline-format'),
  'required-fields-when-loading-app': require('./rules/required-fields-when-loading-app'),
  'no-inline-graphql': require('./rules/no-inline-graphql'),
}

const cliPlugin = {
  meta: {
    name: '@shopify/eslint-plugin-cli',
    version: '3.47.2',
  },
  rules,
}

const baseRules = {
  // Disable strict-component-boundaries as it requires eslint-plugin-import resolver which we don't use
  '@shopify/strict-component-boundaries': 'off',
  // Use import-x rules instead of import (provided by @shopify/eslint-plugin)
  'import-x/order': [
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
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/no-explicit-any': [
    'error',
    {
      fixToUnknown: true,
    },
  ],
  // Switch exhaustiveness check may trigger in existing code, keep as warn
  '@typescript-eslint/switch-exhaustiveness-check': 'warn',
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
      selector: ['objectLiteralProperty', 'typeProperty'],
      format: null,
    },
  ],
  // Use .js extensions for TypeScript files (ESM convention)
  'import-x/extensions': ['error', 'ignorePackages', {
    ts: 'never',
    tsx: 'never',
    js: 'always',
  }],
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  'consistent-return': 'off',
  'import-x/no-cycle': 'off',
  'callback-return': 'off',
  'n/callback-return': 'off',
  'no-undefined': 'off',
  'node/no-deprecated-api': 'off',
  'n/no-deprecated-api': 'off',
  // In a monorepo, dependencies can be hoisted to root or in the package
  'import-x/no-extraneous-dependencies': 'off',
  'no-await-in-loop': 'error',
  'unused-imports/no-unused-imports': 'error',
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: 'path',
          message: "Please use: import { joinPath } from '@shopify/cli-kit/node/path'",
        },
        {
          name: 'node:path',
          message: "Please use: import { joinPath } from '@shopify/cli-kit/node/path'",
        },
        {
          name: 'child_process',
          message: "Please use: import { exec } from '@shopify/cli-kit/node/system'",
        },
        {
          name: 'node:child_process',
          message: "Please use: import { exec } from '@shopify/cli-kit/node/system'",
        },
      ],
    },
  ],
  'vitest/consistent-test-it': [
    'error',
    {
      fn: 'test',
      withinDescribe: 'test',
    },
  ],
  'vitest/max-nested-describe': [
    'error',
    {
      max: 2,
    },
  ],
  'vitest/no-disabled-tests': 'error',
  'vitest/prefer-expect-resolves': 'error',
  '@shopify/cli/command-flags-with-env': 'error',
  '@shopify/cli/command-conventional-flag-env': 'error',
  '@shopify/cli/command-reserved-flags': 'error',
  '@shopify/cli/no-error-factory-functions': 'error',
  '@shopify/cli/no-process-cwd': 'error',
  '@shopify/cli/no-trailing-js-in-cli-kit-imports': 'error',
  '@shopify/cli/no-vi-manual-mock-clear': 'error',
  '@shopify/cli/no-vi-mock-in-callbacks': 'error',
  '@shopify/cli/prompt-message-format': 'warn',
  '@shopify/cli/banner-headline-format': 'warn',
  '@shopify/cli/required-fields-when-loading-app': 'error',
  '@shopify/cli/no-inline-graphql': 'error',
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
  'tsdoc/syntax': 'error',
  'jsdoc/require-returns-description': 'error',
  'promise/catch-or-return': ['error', {allowFinally: true}],
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      args: 'all',
      argsIgnorePattern: '^_',
      caughtErrors: 'none',
      caughtErrorsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    },
  ],
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/no-empty-object-type': 'off',
  // Disable strict Node.js version checking for experimental features
  'n/no-unsupported-features/node-builtins': 'off',
  '@typescript-eslint/require-await': 'off',
  '@typescript-eslint/await-thenable': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/restrict-template-expressions': 'off',
  '@typescript-eslint/no-unsafe-enum-comparison': 'off',
  '@typescript-eslint/prefer-nullish-coalescing': 'warn',
  'no-negated-condition': 'warn',
  '@typescript-eslint/prefer-promise-reject-errors': 'warn',
  'prefer-promise-reject-errors': 'off',
  'no-lone-blocks': 'warn',
  '@typescript-eslint/only-throw-error': 'warn',
  '@typescript-eslint/prefer-readonly': 'error',
  // These should be moved to a warning/error eventually.
  '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
  '@typescript-eslint/no-unnecessary-condition': 'off',
  '@typescript-eslint/prefer-optional-chain': 'off',
  '@typescript-eslint/no-confusing-void-expression': 'off',
  '@typescript-eslint/non-nullable-type-assertion-style': 'off',
  '@typescript-eslint/consistent-indexed-object-style': 'off',
  '@babel/no-unused-expressions': 'off',
  'no-unused-expressions': 'off',
  '@typescript-eslint/no-unused-expressions': ['error', {allowTernary: true}],
  'no-restricted-globals': [
    'error',
    {
      name: 'fetch',
      message:
        'Please use our alternative fetch implementation in @shopify/cli-kit/node/http instead of Node.js built-in fetch. Built-in fetch does not support HTTP proxies.',
    },
  ],
}

const testFileRules = {
  '@typescript-eslint/no-explicit-any': 'off',
  'no-restricted-syntax': 'off',
  '@shopify/cli/required-fields-when-loading-app': 'off',
  // '@typescript-eslint/ban-types' was removed in @typescript-eslint v8, use @typescript-eslint/no-restricted-types instead
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/no-dynamic-delete': 'off',
  '@typescript-eslint/unbound-method': 'off',
  '@typescript-eslint/no-redundant-type-constituents': 'off',
  '@typescript-eslint/no-confusing-void-expression': 'off',
  '@typescript-eslint/no-unnecessary-template-expression': 'warn',
  '@typescript-eslint/no-unnecessary-condition': 'off',
  '@typescript-eslint/restrict-plus-operands': 'off',
  '@typescript-eslint/non-nullable-type-assertion-style': 'off',
  '@typescript-eslint/prefer-reduce-type-parameter': 'warn',
  'no-restricted-globals': 'off',
}

// Build the flat config array
const config = [
  // Spread the Shopify configs (these already include typescript-eslint plugin)
  ...shopifyPlugin.configs.typescript,
  ...shopifyPlugin.configs.node,
  ...shopifyPlugin.configs.prettier,

  // Global ignores
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/vendor/**', '**/bin/bundle.js'],
  },

  // Add CLI-specific plugins and rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      vitest: vitestPlugin,
      'unused-imports': unusedImportsPlugin,
      tsdoc: tsdocPlugin,
      jsdoc: jsdocPlugin,
      'no-catch-all': noCatchAllPlugin,
      '@shopify/cli': cliPlugin,
    },
    rules: baseRules,
  },

  // Prettier config to disable conflicting rules
  eslintConfigPrettier,

  // Test files config
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.test-data.ts', '**/testing/*.ts', '**/testing/*.tsx'],
    rules: testFileRules,
  },

  // Features package - allow console for test utilities
  {
    files: ['**/packages/features/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // JS bin files - different rules apply
  {
    files: ['**/bin/*.js'],
    rules: {
      'import-x/extensions': 'off',
      'import-x/no-unresolved': 'off',
      '@shopify/cli/specific-imports-in-bootstrap-code': 'off',
      '@nx/enforce-module-boundaries': 'off',
      'n/no-unpublished-bin': 'off',
    },
  },
]

module.exports = config
