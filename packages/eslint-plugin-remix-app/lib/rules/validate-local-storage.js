module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ensure localStorage is not used for embedded apps',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },
  create: function (context) {
    return {
      Identifier: function (node) {
        if (/^localStorage$/.test(node.name)) {
          context.report(node, 'The {{name}} API should not be used in embedded apps.', {name: node.name})
        }
      },
    }
  },
}
