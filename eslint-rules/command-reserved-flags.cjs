// https://eslint.org/docs/developer-guide/working-with-rules
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'ensure that the environment variable associated to a follows the naming convention SHOPIFY_FLAG',
    },
    schema: [],
  },
  create(context) {
    const reservedFlags = {
      path: 'SHOPIFY_FLAG_PATH',
      'dry-run': 'SHOPIFY_FLAG_DRY_RUN',
      quiet: 'SHOPIFY_FLAG_QUIET',
      verbose: 'SHOPIFY_FLAG_VERBOSE',
      ci: 'SHOPIFY_FLAG_CI',
      debug: 'SHOPIFY_FLAG_DEBUG',
      port: 'SHOPIFY_FLAG_PORT',
      json: 'SHOPIFY_FLAG_JSON',
      store: 'SHOPIFY_FLAG_STORE',
      'no-color': 'SHOPIFY_FLAG_NO_COLOR',
    }
    return {
      PropertyDefinition(node) {
        if (node.key.name === 'flags') {
          node.value.properties.forEach((flag) => {
            const flagName = flag.key?.name
            if (!flagName) {
              return
            }
            if (!reservedFlags.hasOwnProperty(flagName)) {
              return
            }
            const arguments = flag.value?.arguments ?? []
            const argument = arguments[0]
            if (!argument) {
              return
            }
            const envProperty = argument.properties.find((property) => property.key.name === 'env')?.value?.value
            if (envProperty) {
              if (envProperty !== reservedFlags[flagName]) {
                context.report(
                  argument,
                  `${flagName} is a reserved flags and its environment variable must be ${reservedFlags[flagName]}`,
                )
              }
            }
          })
        }
      },
    }
  },
}
