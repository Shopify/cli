function containsThrow(node) {
  if (typeof node !== 'object' || node === null) return false
  if (node.type === 'ThrowStatement') return true

  return Object.entries(node).some(([field, value]) => {
    if (field === 'parent') return false
    if (Array.isArray(value)) return value.some(containsThrow)
    return containsThrow(value)
  })
}

module.exports = {
  rules: {
    'no-catch-all': {
      create(context) {
        return {
          CatchClause(node) {
            if (!containsThrow(node.body)) {
              context.report({
                node,
                message: 'catch block should rethrow unexpected errors',
              })
            }
          },
        }
      },
    },
  },
}
