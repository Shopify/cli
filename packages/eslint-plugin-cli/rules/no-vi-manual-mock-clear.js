module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow the use of manual clearAll/resetAll/restoreAll for vi mocks',
    },
    schema: [],
    messages: {
      noViManualMockClear:
        "Don't clear/reset/restore vitest mocks manually; vitest does it automatically before each test.",
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee

        if (
          callee.type === 'MemberExpression' &&
          callee.object.name === 'vi' &&
          ['clearAllMocks', 'resetAllMocks', 'restoreAllMocks'].includes(callee.property.name)
        ) {
          context.report({node, messageId: 'noViManualMockClear'})
        }
      },
    }
  },
}
