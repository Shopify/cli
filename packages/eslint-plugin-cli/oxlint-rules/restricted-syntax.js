module.exports = {
  meta: {type: 'suggestion', schema: {type: 'array', items: {type: 'object'}}},
  create(context) {
    return Object.fromEntries(
      context.options.map(({selector, message}) => [selector, (node) => context.report({node, message})]),
    )
  },
}
