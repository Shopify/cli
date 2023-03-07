module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Remove trailing .js when importing from @shopify/cli-kit',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noTrailingJsInCliKit: 'Trailing .js is not needed when importing from @shopify/cli-kit',
    },
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (source.startsWith('@shopify/cli-kit') && source.endsWith('.js')) {
          context.report({
            node,
            messageId: 'noTrailingJsInCliKit',
            fix: function (fixer) {
              return fixer.replaceText(node.source, `'${source.slice(0, -3)}'`)
            },
          })
        }
      },
    }
  },
}
