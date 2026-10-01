const {rules} = require('./oxlint')

// Keep existing disable comments valid while using independent implementations.
module.exports = {
  meta: {name: '@shopify/cli-tsdoc'},
  rules: {
    syntax: rules['tsdoc-syntax'],
  },
}
