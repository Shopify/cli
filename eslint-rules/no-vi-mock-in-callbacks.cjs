module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'vi.mock should only be used at the top level of a test.',
    },
    schema: [],
    messages: {
      noViMockInCallbacks:
        "Don't use vi.mock inside callbacks, since it gets hoisted at the top of the test. If you really need it, use vi.doMock instead.",
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee

        if (
          callee.type === 'MemberExpression' &&
          callee.object.name === 'vi' &&
          callee.property.name === 'mock' &&
          node.parent.parent.type !== 'Program'
        ) {
          context.report({node, messageId: 'noViMockInCallbacks'})
        }
      },
    }
  },
}
