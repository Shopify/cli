const {rules} = require('./oxlint')

module.exports = {
  meta: {name: '@shopify/cli-tsdoc'},
  rules: {
    syntax: rules['tsdoc-syntax'],
  },
}
