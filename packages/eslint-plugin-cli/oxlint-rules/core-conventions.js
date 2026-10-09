function rule(visitor, options = []) {
  return {meta: {type: 'suggestion', schema: options}, create: visitor}
}

module.exports = {
  'no-process-env': rule((context) => ({
    MemberExpression(node) {
      if (
        node.object.type === 'Identifier' &&
        node.object.name === 'process' &&
        (node.computed ? node.property.value : node.property.name) === 'env'
      ) {
        context.report({node, message: 'Read environment variables through the CLI environment helpers.'})
      }
    },
  })),
  'one-var': rule(
    (context) => ({
      VariableDeclaration(node) {
        if (node.declarations.length > 1) context.report({node, message: 'Declare each variable separately.'})
      },
    }),
    [{enum: ['never']}],
  ),
  'no-undef-init': rule((context) => ({
    VariableDeclarator(node) {
      if (node.parent.kind !== 'const' && node.init?.type === 'Identifier' && node.init.name === 'undefined') {
        context.report({node, message: 'Do not initialize a variable to undefined.'})
      }
    },
  })),
  'consistent-this': rule(
    (context) => ({
      VariableDeclarator(node) {
        if (
          node.init?.type === 'ThisExpression' &&
          node.id.type === 'Identifier' &&
          node.id.name !== context.options[0]
        ) {
          context.report({node: node.id, message: `Use ${context.options[0]} when assigning this to a variable.`})
        }
      },
    }),
    [{type: 'string'}],
  ),
  'dot-notation': {
    meta: {type: 'suggestion', fixable: 'code', schema: [{type: 'object'}]},
    create(context) {
      return {
        MemberExpression(node) {
          if (!node.computed || node.property.type !== 'Literal' || typeof node.property.value !== 'string') return
          const name = node.property.value
          if (!/^[$A-Z_a-z][$\w]*$/.test(name)) return
          if (context.options[0]?.allowPattern && new RegExp(context.options[0].allowPattern).test(name)) return
          context.report({
            node: node.property,
            message: 'Use dot notation for this property.',
            fix: (fixer) =>
              fixer.replaceTextRange([node.object.range[1], node.range[1]], `${node.optional ? '?.' : '.'}${name}`),
          })
        },
      }
    },
  },
  'no-return-await': rule((context) => ({
    ReturnStatement(node) {
      if (node.argument?.type !== 'AwaitExpression') return
      // Await inside a try block makes its catch/finally observe rejections.
      let ancestor = node.parent
      while (
        ancestor &&
        !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(ancestor.type)
      ) {
        if (ancestor.type === 'TryStatement' && (ancestor.handler || ancestor.finalizer)) return
        ancestor = ancestor.parent
      }
      context.report({node: node.argument, message: 'Return the promise directly outside try/catch.'})
    },
  })),
  'no-fully-static-classes': rule((context) => ({
    ClassDeclaration(node) {
      const members = node.body.body
      if (members.length && !node.superClass && members.every((member) => member.static)) {
        context.report({node, message: 'Use functions or an object instead of a fully static class.'})
      }
    },
  })),
  'prefer-pascal-case-enums': rule((context) => ({
    TSEnumMember(node) {
      if (node.id.type === 'Identifier' && !/^[A-Z][a-zA-Z0-9]*$/.test(node.id.name)) {
        context.report({node: node.id, message: 'Use PascalCase for enum members.'})
      }
    },
  })),
  'prefer-build-client-schema': rule((context) => ({
    ImportDeclaration(node) {
      if (node.source.value === 'graphql')
        for (const specifier of node.specifiers) {
          if (specifier.imported?.name === 'buildSchema')
            context.report({node: specifier, message: 'Use buildClientSchema for introspection schemas.'})
        }
    },
  })),
}
