// https://eslint.org/docs/developer-guide/working-with-rules
const VALID_FLAGS = ['SHOPIFY_FLAG_']

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'ensure that the environment variable associated to a follows the naming convention SHOPIFY_FLAG',
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
            const envProperty = argument.properties.find((property) => property.key.name === 'env')?.value?.value
            if (envProperty) {
              if (!VALID_FLAGS.some((flag) => envProperty.startsWith(flag))) {
                context.report(
                  argument,
                  `Flags' environment variable must start with ${new Intl.ListFormat('en', {
                    style: 'long',
                    type: 'disjunction',
                  }).format(VALID_FLAGS)}.`,
                )
              }
            }
          })
        }
      },
    }
  },
}
