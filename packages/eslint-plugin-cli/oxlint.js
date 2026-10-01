const cli = require('./index')

module.exports = {
  meta: {name: '@shopify/cli-oxlint'},
  rules: {
    ...cli.rules,
    ...require('./oxlint-rules/public-jsdoc'),
    ...require('./oxlint-rules/core-conventions'),
    ...require('./oxlint-rules/node-conventions'),
    ...require('./oxlint-rules/declarations'),
    'unused-imports': require('./oxlint-rules/unused-imports'),
    'naming-convention': require('./oxlint-rules/naming-convention'),
    'member-ordering': require('./oxlint-rules/member-ordering'),
    'import-order': require('./oxlint-rules/import-order'),
    'module-boundaries': require('./oxlint-rules/module-boundaries'),
    'restricted-syntax': require('./oxlint-rules/restricted-syntax'),
    'no-catch-all': require('./oxlint-rules/no-catch-all'),
    'tsdoc-syntax': require('./oxlint-rules/tsdoc-syntax'),
    'no-new-object': require('./oxlint-rules/no-new-object'),
    'id-length': require('./oxlint-rules/id-length'),
  },
}
