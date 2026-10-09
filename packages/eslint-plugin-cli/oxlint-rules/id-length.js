module.exports = {
  meta: {type: 'suggestion', schema: [{type: 'object'}]},
  create(context) {
    const options = context.options[0] ?? {}
    const exceptions = new Set(options.exceptions ?? [])
    const patterns = (options.exceptionPatterns ?? []).map((pattern) => new RegExp(pattern))
    const declarations = new Set([
      'VariableDeclarator',
      'FunctionDeclaration',
      'FunctionExpression',
      'ClassDeclaration',
      'ClassExpression',
      'CatchClause',
      'RestElement',
      'AssignmentPattern',
      'ArrayPattern',
      'ImportSpecifier',
      'ImportDefaultSpecifier',
      'ImportNamespaceSpecifier',
    ])
    return {
      Identifier(node) {
        const parent = node.parent
        if (parent.type === 'ImportSpecifier' && parent.imported.name === parent.local.name) return
        const parameter =
          ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(parent.type) &&
          parent.params.includes(node)
        const property = parent.type === 'Property' && !parent.computed && parent.key === node
        const binding =
          declarations.has(parent.type) &&
          (parent.id === node ||
            parent.param === node ||
            parent.local === node ||
            parent.left === node ||
            parent.argument === node ||
            parent.elements?.includes(node))
        if (!parameter && !binding && !(property && options.properties !== 'never')) return
        if (exceptions.has(node.name) || patterns.some((pattern) => pattern.test(node.name))) return
        if (node.name.length < (options.min ?? 2) || node.name.length > (options.max ?? Infinity)) {
          context.report({node, message: `Identifier "${node.name}" has an invalid length.`})
        }
      },
    }
  },
}
