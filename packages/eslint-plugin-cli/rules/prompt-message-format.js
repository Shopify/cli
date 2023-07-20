module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow certain characters to appear in the message attribute of prompts',
      category: 'Stylistic Issues',
      recommended: false,
    },
    schema: [],
    messages: {
      chooseSelectDisallowed: 'Message should not contain the words "choose" or "select".',
      invalidPunctuation: 'The message attribute should not end with any punctuation except "?" and ":".',
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
          functionName === 'renderDangerousConfirmationPrompt' ||
          functionName === 'renderTextPrompt'
        ) {
          const firstArgument = node.arguments[0]

          if (firstArgument.type === 'ObjectExpression') {
            const messageProperty = firstArgument.properties.find((property) => property.key.name === 'message')

            if (messageProperty) {
              let messageValue = messageProperty.value.value

              if (typeof messageValue === 'string') {
                messageValue = messageValue.toLowerCase()

                if (
                  messageValue.includes('choose') ||
                  messageValue.includes('select') ||
                  messageValue.includes('pick')
                ) {
                  context.report({
                    node: messageProperty,
                    messageId: 'chooseSelectDisallowed',
                  })
                }

                const lastChar = messageValue.slice(-1)
                const invalidPunctuation = /[!.,;]/

                if (lastChar.match(invalidPunctuation)) {
                  context.report({
                    node: messageProperty,
                    messageId: 'invalidPunctuation',
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
