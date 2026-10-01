const {rules, meta} = require('./index')

module.exports = [
  {plugins: {'@shopify/cli': {rules, meta}}},
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@shopify/cli/command-flags-with-env': 'error',
      '@shopify/cli/command-conventional-flag-env': 'error',
      '@shopify/cli/command-reserved-flags': 'error',
      '@shopify/cli/no-error-factory-functions': 'error',
      '@shopify/cli/no-process-cwd': 'error',
      '@shopify/cli/no-trailing-js-in-cli-kit-imports': 'error',
      '@shopify/cli/no-vi-manual-mock-clear': 'error',
      '@shopify/cli/no-vi-mock-in-callbacks': 'error',
      '@shopify/cli/prompt-message-format': 'error',
      '@shopify/cli/banner-headline-format': 'error',
      '@shopify/cli/required-fields-when-loading-app': 'error',
      '@shopify/cli/no-inline-graphql': 'error',
      '@shopify/cli/command-json-output': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.test-data.ts', '**/testing/*.ts', '**/testing/*.tsx'],
    rules: {'@shopify/cli/required-fields-when-loading-app': 'off'},
  },
]
