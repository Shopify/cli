module.exports = {
  settings: {},
  plugins: ['no-catch-all', 'vitest', 'unused-imports', 'eslint-plugin-tsdoc', 'jsdoc', 'import', '@shopify/cli'],
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
        selector: ['objectLiteralProperty', 'typeProperty'],
        format: null,
      },
    ],
    'import/extensions': ['error', 'always', {ignorePackages: true}],
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
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
  },
  overrides: [
    {
      files: ['**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-restricted-syntax': 'off',
        '@shopify/cli/required-fields-when-loading-app': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
}
