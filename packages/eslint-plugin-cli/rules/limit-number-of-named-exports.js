const DEFAULT_MAX_EXPORTS = 3

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'limit how many named export statements a module can have',
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxEports: {
            description: 'Allowed modules to import dynamically',
            type: 'number',
          },
        },
      },
    ],
  },
  create(context) {
    const options = context.options[0] ?? {}
    const maxExports = options?.maxExports ?? DEFAULT_MAX_EXPORTS

    let exportsCount = 0
    let reported = false
    return {
      ExportNamedDeclaration(node) {
        if (reported) {
          return
        }
        if (node.exportKind === 'type') {
          return
        }
        exportsCount += Math.max(1, node.specifiers.length)
        if (exportsCount > maxExports) {
          context.report({
            node,
            message: `Module should not export more than ${maxExports} items`,
          })
          reported = true
        }
      },
    }
  },
}
