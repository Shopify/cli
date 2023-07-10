module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require config name to be passed when loading an app',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },

  create: function (context) {
    const loadFunctions = ['loadApp', 'loadAppConfiguration', 'inFunctionContext']

    return {
      CallExpression: function (node) {
        const {callee, arguments: args} = node

        if (callee.type === 'Identifier' && loadFunctions.includes(callee.name) && args.length == 1) {
          if (args[0].type === 'ObjectExpression') {
            const properties = args[0].properties
            if (!properties.some((prop) => prop.key.name === 'configName')) {
              context.report({
                node: node,
                message: `Missing 'configName' property when calling '${callee.name}' function.`,
              })
            }
          }
        }
      },
    }
  },
}
