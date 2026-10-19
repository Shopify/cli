const {TSDocParser, TextRange} = require('@microsoft/tsdoc')

module.exports = {
  meta: {type: 'problem', schema: []},
  create(context) {
    const parser = new TSDocParser()
    return {
      Program() {
        const source = context.sourceCode
        for (const comment of source.getAllComments()) {
          if (comment.type !== 'Block' || !comment.value.startsWith('*')) continue
          const range = TextRange.fromStringRange(source.text, ...comment.range)
          for (const message of parser.parseRange(range).log.messages) {
            context.report({
              loc: {
                start: source.getLocFromIndex(message.textRange.pos),
                end: source.getLocFromIndex(message.textRange.end),
              },
              message: `${message.messageId}: ${message.unformattedText}`,
            })
          }
        }
      },
    }
  },
}
