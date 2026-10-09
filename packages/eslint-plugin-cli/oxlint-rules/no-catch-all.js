function containsThrow(node) {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'ThrowStatement') return true
  if (
    [
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
      'ClassDeclaration',
      'ClassExpression',
    ].includes(node.type)
  ) {
    return false
  }
  return Object.entries(node).some(([name, value]) => {
    if (name === 'parent') return false
    return Array.isArray(value) ? value.some(containsThrow) : containsThrow(value)
  })
}

module.exports = {
  meta: {type: 'problem', schema: []},
  create(context) {
    return {
      CatchClause(node) {
        if (!containsThrow(node.body)) {
          context.report({node, message: 'catch block should rethrow unexpected errors'})
        }
      },
    }
  },
}
