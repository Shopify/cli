const {TSDocConfiguration, TSDocParser, TextRange} = require('@microsoft/tsdoc')

const parser = new TSDocParser(new TSDocConfiguration())

module.exports = {
  rules: {
    syntax: {
      meta: {
        type: 'problem',
      },
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode()

        return {
          Program() {
            for (const comment of sourceCode.getAllComments()) {
              if (comment.type !== 'Block' || !comment.range) continue

              const textRange = TextRange.fromStringRange(sourceCode.text, comment.range[0], comment.range[1])
              if (textRange.length < 5 || textRange.buffer[textRange.pos + 2] !== '*') continue

              const parserContext = parser.parseRange(textRange)
              for (const message of parserContext.log.messages) {
                context.report({
                  loc: {
                    start: sourceCode.getLocFromIndex(message.textRange.pos),
                    end: sourceCode.getLocFromIndex(message.textRange.end),
                  },
                  message: `${message.messageId}: ${message.unformattedText}`,
                })
              }
            }
          },
        }
      },
    },
  },
}
