module.exports = {
  meta: {type: 'suggestion', schema: []},
  create(context) {
    return {
      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'Object') return
        let scope = context.sourceCode.getScope(node)
        while (scope) {
          const binding = scope.variables.find((variable) => variable.name === 'Object')
          if (binding?.defs.length) return
          scope = scope.upper
        }
        context.report({node, message: 'Use an object literal instead of new Object.'})
      },
    }
  },
}
