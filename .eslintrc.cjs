const path = require('pathe')

const rulesDirPlugin = require('eslint-plugin-rulesdir')

rulesDirPlugin.RULES_DIR = path.join(__dirname, 'eslint-rules')

module.exports = {
  parser: '@typescript-eslint/parser',
  settings: {},
  parserOptions: {
    project: './tsconfig.json',
    EXPERIMENTAL_useSourceOfProjectReferenceRedirect: true,
  },
  plugins: ['no-catch-all', 'jest', '@nrwl/nx', 'unused-imports', 'rulesdir', 'eslint-plugin-tsdoc', 'jsdoc'],
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
    'jest/consistent-test-it': [
      'error',
      {
        fn: 'test',
        withinDescribe: 'test',
      },
    ],
    'jest/max-nested-describe': [
      'error',
      {
        max: 2,
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
            sourceTag: 'scope:plugin',
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
    'rulesdir/no-error-factory-functions': 'error',
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
  },
  overrides: [
    {
      // TODO: Document all the public modules
      files: ['**/public/**/ruby.ts', '**/public/plugins/**/*.ts'],
      excludedFiles: ['*.test.ts'],
      rules: {
        'jsdoc/check-access': 1,
        'jsdoc/check-alignment': 1,
        'jsdoc/check-indentation': 1,
        'jsdoc/check-line-alignment': 1,
        'jsdoc/check-param-names': 1,
        'jsdoc/check-property-names': 1,
        'jsdoc/check-syntax': 1,
        'jsdoc/check-tag-names': 1,
        'jsdoc/check-types': 1,
        'jsdoc/check-values': 1,
        'jsdoc/empty-tags': 1,
        'jsdoc/implements-on-classes': 1,
        'jsdoc/match-description': 1,
        'jsdoc/multiline-blocks': 1,
        'jsdoc/newline-after-description': 1,
        'jsdoc/no-bad-blocks': 1,
        'jsdoc/no-defaults': 1,
        'jsdoc/no-multi-asterisks': 1,
        'jsdoc/no-types': 1,
        'jsdoc/no-undefined-types': 1,
        'jsdoc/require-asterisk-prefix': 1,
        'jsdoc/require-description': 1,
        'jsdoc/require-description-complete-sentence': 1,
        'jsdoc/require-hyphen-before-param-description': 1,
        'jsdoc/require-jsdoc': 1,
        'jsdoc/require-param': 1,
        'jsdoc/require-param-description': 1,
        'jsdoc/require-param-name': 1,
        'jsdoc/require-property': 1,
        'jsdoc/require-property-description': 1,
        'jsdoc/require-property-name': 1,
        'jsdoc/require-property-type': 1,
        'jsdoc/require-returns': 1,
        'jsdoc/require-returns-check': 1,
        'jsdoc/require-returns-description': 1,
        'jsdoc/require-throws': 1,
        'jsdoc/require-yields': 1,
        'jsdoc/require-yields-check': 1,
        'jsdoc/tag-lines': 1,
        'jsdoc/valid-types': 1,
      },
      settings: {
        jsdoc: {
          mode: 'typescript',
        },
      },
    },
    {
      files: ['**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-restricted-syntax': 'off',
      },
    },
    {
      files: ['src/public/**/*.ts'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'error',
      },
    },
  ],
}
