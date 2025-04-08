/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow the use of `joinPath` for the hidden .shopify folder',
    },
    schema: [],
    messages: {
      noManualJoinPathForHiddenFolder:
        "Don't use joinPath for the hidden .shopify folder; use getPathInsideHiddenFolder from @shopify/cli-kit instead.",
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        // Check if the function being called is a path joining function
        const isJoinPathIdentifier = node.callee.type === 'Identifier' && node.callee.name === 'joinPath'

        const isPathJoin =
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'path' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'join'

        if (!isJoinPathIdentifier && !isPathJoin) return

        // Check if there are at least 2 arguments
        if (node.arguments.length < 2) return

        // Get the second argument
        const secondArg = node.arguments[1]

        // Check if the second argument is '.shopify'
        const isStringLiteral =
          secondArg.type === 'Literal' && typeof secondArg.value === 'string' && secondArg.value === '.shopify'

        const isTemplateLiteral =
          secondArg.type === 'TemplateLiteral' &&
          secondArg.quasis.length === 1 &&
          secondArg.quasis[0].value.raw === '.shopify'

        if (isStringLiteral || isTemplateLiteral) {
          context.report({
            node,
            messageId: 'noManualJoinPathForHiddenFolder',
          })
        }
      },
    }
  },
}
