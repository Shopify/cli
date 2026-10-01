const {rules} = require('./oxlint')

// Keep existing disable comments valid while using independent implementations.
module.exports = {
  meta: {name: '@shopify/cli-no-catch-all'},
  rules: {
    'no-catch-all': rules['no-catch-all'],
  },
}
