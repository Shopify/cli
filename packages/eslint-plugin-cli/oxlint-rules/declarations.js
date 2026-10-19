function isDeclared(context, node) {
  let scope = context.sourceCode.getScope(node)
  while (scope) {
    if (scope.variables.some((variable) => variable.name === node.name)) return true
    scope = scope.upper
  }
  return false
}

module.exports = {
  'no-implicit-globals': {
    meta: {type: 'problem', schema: [{type: 'object'}]},
    create(context) {
      function check(node) {
        if (node.type === 'Identifier' && !isDeclared(context, node))
          context.report({node, message: 'Do not create an implicit global variable.'})
      }
      return {
        AssignmentExpression(node) {
          check(node.left)
        },
        UpdateExpression(node) {
          check(node.argument)
        },
      }
    },
  },
  'no-redeclare': {
    meta: {type: 'problem', schema: [{type: 'object'}]},
    create(context) {
      function check(scope) {
        for (const variable of scope.variables)
          for (const definition of variable.defs.slice(1)) {
            context.report({
              node: definition.name,
              message: `Variable "${variable.name}" is already declared in this scope.`,
            })
          }
        for (const child of scope.childScopes) check(child)
      }
      return {
        Program(node) {
          check(context.sourceCode.getScope(node))
        },
      }
    },
  },
}
