module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ensure all URLs use a secure protocol (https) ',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },
  create: function (context) {
    return {
      Literal(node) {
        const value = node.value
        const httpRegex = /http:\/\/[^ \t\r\n]+/g
        const comments = context.getSourceCode().getAllComments()
        const isComment = comments.some((comment) => comment.range[1] === node.range[0])

        if (!isComment && typeof value === 'string' && value.match(httpRegex)) {
          context.report({
            node,
            message: 'Use https:// instead of http:// for URLs',
          })
        }
      },
    }
  },
}
