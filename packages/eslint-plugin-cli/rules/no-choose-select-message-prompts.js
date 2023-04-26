module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow "choose" or "select" in the message attribute of renderSelectPrompt and renderAutocompletePrompt',
      category: 'Possible Errors',
      recommended: false,
    },
    schema: [],
    messages: {
      chooseSelectDisallowed: 'The message attribute should not contain the words "choose" or "select".',
    },
  },

  create: function (context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        const functionName = callee.name

        if (
          functionName === 'renderSelectPrompt' ||
          functionName === 'renderAutocompletePrompt' ||
          functionName === 'renderConfirmationPrompt' ||
          functionName === 'renderTextPrompt'
        ) {
          const firstArgument = node.arguments[0]

          if (firstArgument.type === 'ObjectExpression') {
            const messageProperty = firstArgument.properties.find((property) => property.key.name === 'message')

            if (messageProperty) {
              let messageValue = messageProperty.value.value

              if (typeof messageValue === 'string') {
                messageValue = messageValue.toLowerCase()

                if (messageValue.includes('choose') || messageValue.includes('select')) {
                  context.report({
                    node: messageProperty,
                    messageId: 'chooseSelectDisallowed',
                  })
                }
              }
            }
          }
        }
      },
    }
  },
}
