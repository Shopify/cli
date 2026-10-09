const {rules} = require('./oxlint')

module.exports = {
  meta: {name: '@shopify/cli-no-catch-all'},
  rules: {
    'no-catch-all': rules['no-catch-all'],
  },
}
