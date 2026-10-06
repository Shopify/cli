const {rules} = require('./oxlint')

module.exports = {
  meta: {name: '@shopify/cli-compat'},
  rules: {
    'id-length': rules['id-length'],
    'typescript-eslint-naming-convention': rules['naming-convention'],
    'n-prefer-global-console': rules['prefer-global-console'],
    'n-prefer-global-url': rules['prefer-global-url'],
    'no-restricted-syntax': rules['restricted-syntax'],
    'nx-enforce-module-boundaries': rules['module-boundaries'],
  },
}
