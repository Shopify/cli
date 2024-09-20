module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure setLastSeenUserIdAfterAuth is called in ensureAuthenticated function',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    return {
      FunctionDeclaration(node) {
        if (node.id && node.id.name === 'ensureAuthenticated') {
          let setLastSeenUserIdCalled = false

          const checkForSetLastSeenUserIdCall = (node) => {
            if (
              node.type === 'CallExpression' &&
              node.callee.type === 'Identifier' &&
              node.callee.name === 'setLastSeenUserIdAfterAuth'
            ) {
              setLastSeenUserIdCalled = true
            }
          }

          // Traverse the entire function body
          context.getSourceCode().ast.body.forEach((bodyNode) => {
            if (bodyNode.type === 'FunctionDeclaration' && bodyNode.id.name === 'ensureAuthenticated') {
              context.getSourceCode().visitorKeys[bodyNode.type].forEach((key) => {
                if (key === 'body') {
                  const functionBody = bodyNode[key]
                  if (functionBody.type === 'BlockStatement') {
                    functionBody.body.forEach((statement) => {
                      context.getSourceCode().visitorKeys[statement.type].forEach((statementKey) => {
                        const child = statement[statementKey]
                        if (Array.isArray(child)) {
                          child.forEach(checkForSetLastSeenUserIdCall)
                        } else if (child && typeof child === 'object') {
                          checkForSetLastSeenUserIdCall(child)
                        }
                      })
                    })
                  }
                }
              })
            }
          })

          if (!setLastSeenUserIdCalled) {
            context.report({
              node,
              message: 'ensureAuthenticated function must call setLastSeenUserIdAfterAuth',
            })
          }
        }
      },
    }
  },
}
