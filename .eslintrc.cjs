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
    'rulesdir/no-process-cwd': 'error',
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
  },
  overrides: [
    {
      files: ['**/public/**/*.ts'],
      excludedFiles: [
        '*.test.ts',
        // TODO: Document all the public modules
        '**/public/node/abort.ts',
        '**/public/node/analytics.ts',
        '**/public/node/base-command.ts',
        '**/public/node/cli.ts',
        '**/public/node/dot-env.ts',
        '**/public/node/error-handler.ts',
        '**/public/node/framework.ts',
        '**/public/node/fs.ts',
        '**/public/node/github.ts',
        '**/public/node/hooks/prerun.ts',
        '**/public/node/os.ts',
        '**/public/node/node-package-manager.ts',
        '**/public/node/plugins/tunnel.ts',
        '**/public/node/presets.ts',
        '**/public/node/result.ts',
      ],
      rules: {
        'jsdoc/check-access': 'error',
        'jsdoc/check-alignment': 'error',
        'jsdoc/check-indentation': 'error',
        'jsdoc/check-line-alignment': 'error',
        'jsdoc/check-param-names': 'error',
        'jsdoc/check-property-names': 'error',
        'jsdoc/check-syntax': 'error',
        'jsdoc/check-tag-names': 'error',
        'jsdoc/check-types': 'error',
        'jsdoc/check-values': 'error',
        'jsdoc/empty-tags': 'error',
        'jsdoc/implements-on-classes': 'error',
        'jsdoc/match-description': 'error',
        'jsdoc/multiline-blocks': 'error',
        'jsdoc/newline-after-description': 'error',
        'jsdoc/no-bad-blocks': 'error',
        'jsdoc/no-defaults': 'error',
        'jsdoc/no-multi-asterisks': 'error',
        'jsdoc/no-types': 'error',
        'jsdoc/no-undefined-types': 'error',
        'jsdoc/require-asterisk-prefix': 'error',
        'jsdoc/require-description': 'error',
        'jsdoc/require-description-complete-sentence': 'error',
        'jsdoc/require-hyphen-before-param-description': 'error',
        'jsdoc/require-jsdoc': 'error',
        'jsdoc/require-param': 'error',
        'jsdoc/require-param-description': 'error',
        'jsdoc/require-param-name': 'error',
        'jsdoc/require-property': 'error',
        'jsdoc/require-property-description': 'error',
        'jsdoc/require-property-name': 'error',
        'jsdoc/require-property-type': 'error',
        'jsdoc/require-returns': 'error',
        'jsdoc/require-returns-check': 'error',
        'jsdoc/require-returns-description': 'error',
        'jsdoc/require-throws': 'error',
        'jsdoc/require-yields': 'error',
        'jsdoc/require-yields-check': 'error',
        'jsdoc/tag-lines': 'error',
        'jsdoc/valid-types': 'error',
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
