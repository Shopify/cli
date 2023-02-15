// https://eslint.org/docs/developer-guide/working-with-rules
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'ensure that command flags include the environment variable name',
    },
    schema: [],
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        if (node.key.name === 'flags') {
          node.value.properties.forEach((flag) => {
            const arguments = flag.value?.arguments ?? []
            const argument = arguments[0]
            if (!argument) {
              return
            }
            const properties = argument.properties.map((property) => property.key.name)
            if (!properties.includes('env')) {
              context.report(
                argument,
                'Flags must specify the environment variable that represents the flag through the env property',
              )
            }
          })
        }
      },
    }
  },
}
