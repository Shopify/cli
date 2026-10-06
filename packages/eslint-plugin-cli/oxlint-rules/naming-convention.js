const formats = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  UPPER_CASE: /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/,
}
const typeSelectors = new Set(['interface', 'typeAlias', 'class', 'enum', 'typeParameter'])

module.exports = {
  meta: {type: 'suggestion', schema: {type: 'array', items: {type: 'object'}}},
  create(context) {
    function check(node, selector) {
      if (!node || node.type !== 'Identifier') return
      const matches = context.options
        .filter((option) => {
          const selectors = [].concat(option.selector)
          if (
            !selectors.some(
              (name) => name === selector || name === 'default' || (name === 'typeLike' && typeSelectors.has(selector)),
            )
          )
            return false
          if (!option.filter) return true
          return new RegExp(option.filter.regex).test(node.name) === option.filter.match
        })
        .sort((first, second) => {
          const priority = (option) => {
            if (option.filter) return 4
            if ([].concat(option.selector).includes(selector)) return 3
            if (option.selector === 'typeLike') return 2
            return 1
          }
          return priority(second) - priority(first)
        })
      const option = matches[0]
      if (!option || option.format === null) return
      let name = node.name
      if (option.leadingUnderscore === 'allow' || selector === 'typeParameter') name = name.replace(/^_+/, '')
      if (option.trailingUnderscore === 'allow') name = name.replace(/_+$/, '')
      if (!name) return
      if (option.custom && new RegExp(option.custom.regex).test(name) !== option.custom.match) {
        context.report({node, message: `Name "${node.name}" does not match the ${selector} naming convention.`})
        return
      }
      if (option.prefix) {
        const prefix = option.prefix.find((value) => name.startsWith(value))
        if (!prefix) {
          context.report({node, message: `Name "${node.name}" must start with ${option.prefix.join(' or ')}.`})
          return
        }
        name = name.slice(prefix.length)
        // Numeric suffixes such as T1 remain valid PascalCase type parameters.
        if (/^[0-9]+$/.test(name)) return
      }
      if (name && !option.format.some((format) => formats[format]?.test(name))) {
        context.report({node, message: `Name "${node.name}" must use ${option.format.join(' or ')}.`})
      }
    }
    function pattern(node, selector) {
      if (!node) return
      if (node.type === 'Identifier') check(node, selector)
      else if (node.type === 'AssignmentPattern') pattern(node.left, selector)
      else if (node.type === 'RestElement') pattern(node.argument, selector)
      else if (node.type === 'ObjectPattern')
        for (const property of node.properties) pattern(property.value ?? property.argument, selector)
      else if (node.type === 'ArrayPattern') for (const element of node.elements) pattern(element, selector)
    }
    function callable(node) {
      if (node.id) check(node.id, 'function')
      for (const parameter of node.params)
        pattern(parameter.type === 'TSParameterProperty' ? parameter.parameter : parameter, 'parameter')
    }
    return {
      VariableDeclarator(node) {
        pattern(node.id, 'variable')
      },
      FunctionDeclaration: callable,
      FunctionExpression: callable,
      ArrowFunctionExpression: callable,
      CatchClause(node) {
        pattern(node.param, 'variable')
      },
      ClassDeclaration(node) {
        check(node.id, 'class')
      },
      ClassExpression(node) {
        check(node.id, 'class')
      },
      TSInterfaceDeclaration(node) {
        check(node.id, 'interface')
      },
      TSTypeAliasDeclaration(node) {
        check(node.id, 'typeAlias')
      },
      TSEnumDeclaration(node) {
        check(node.id, 'enum')
      },
      TSTypeParameter(node) {
        // Inferred type bindings are exempt from type-parameter naming requirements.
        if (node.parent.type === 'TSInferType') return
        check(node.name, 'typeParameter')
      },
      Property(node) {
        if (!node.computed) check(node.key, 'objectLiteralProperty')
      },
      TSPropertySignature(node) {
        if (!node.computed) check(node.key, 'typeProperty')
      },
      PropertyDefinition(node) {
        if (!node.computed) check(node.key, 'classProperty')
      },
      MethodDefinition(node) {
        if (!node.computed && node.kind !== 'constructor') check(node.key, 'classMethod')
      },
    }
  },
}
