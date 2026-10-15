module.exports = {
  meta: {type: 'problem', schema: []},
  create(context) {
    return {
      ImportDeclaration(node) {
        for (const variable of context.sourceCode.getDeclaredVariables(node)) {
          if (!variable.references.length) {
            const definition = variable.defs[0]
            context.report({node: definition.name, message: `Imported binding "${variable.name}" is never used.`})
          }
        }
      },
    }
  },
}
