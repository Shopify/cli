module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require a period at the end of the banner headline attribute',
      category: 'Stylistic Issues',
      recommended: false,
    },
    schema: [],
    messages: {
      missingPunctuation: 'The headline attribute should end with punctuation.',
      invalidChar: 'The char attribute should be a punctuation.',
    },
  },

  create: function (context) {
    function checkForPunctuation(value, node) {
      const punctuationRegex = /[!.:?]+$/
      if (typeof value === 'string' && !value.match(punctuationRegex)) {
        context.report({
          node: node,
          messageId: 'missingPunctuation',
        })
      }
    }

    function checkForChar(value, node) {
      const charProperty = value.properties.find((property) => property.key.name === 'char')

      if (charProperty) {
        const punctuationRegex = /[!.:?]+/
        if (!charProperty.value.value.match(punctuationRegex)) {
          context.report({
            node: charProperty,
            messageId: 'invalidChar',
          })
        }
      } else {
        context.report({
          node: node,
          messageId: 'missingPunctuation',
        })
      }
    }

    return {
      CallExpression(node) {
        const callee = node.callee
        const functionName = callee.name

        if (
          functionName === 'renderSuccess' ||
          functionName === 'renderInfo' ||
          functionName === 'renderWarning' ||
          functionName === 'renderError'
        ) {
          const firstArgument = node.arguments[0]

          if (firstArgument.type === 'ObjectExpression') {
            const headlineProperty = firstArgument.properties.find((property) => property.key.name === 'headline')

            if (headlineProperty) {
              const headlineValue = headlineProperty.value

              if (headlineValue.type === 'Literal') {
                checkForPunctuation(headlineValue.value, headlineProperty)
              } else if (headlineValue.type === 'ArrayExpression') {
                const lastElement = headlineValue.elements[headlineValue.elements.length - 1]

                if (lastElement.type === 'Literal') {
                  checkForPunctuation(lastElement.value, lastElement)
                } else if (lastElement.type === 'ObjectExpression') {
                  checkForChar(lastElement, lastElement)
                }
              }
            }
          }
        }
      },
    }
  },
}
