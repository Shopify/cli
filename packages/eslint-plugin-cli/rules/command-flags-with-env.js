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
        if (node.key.name !== 'flags') return

        const flags = node.value?.properties ?? []
        flags.forEach((flag) => {
          const argument = flag.value?.arguments?.[0]
          if (!argument?.properties) {
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
      },
    }
  },
}
