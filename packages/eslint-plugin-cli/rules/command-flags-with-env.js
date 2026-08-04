// https://eslint.org/docs/developer-guide/working-with-rules
const {findFlagOptions} = require('./flag-options')

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
            const options = findFlagOptions(flag.value)
            if (!options) return

            const properties = options.properties.map((property) => property.key?.name)
            if (!properties.includes('env')) {
              context.report(
                options,
                'Flags must specify the environment variable that represents the flag through the env property',
              )
            }
          })
        }
      },
    }
  },
}
