const globalModules = {
  buffer: ['Buffer'],
  console: ['console'],
  process: ['process'],
  util: ['TextDecoder', 'TextEncoder'],
  url: ['URL', 'URLSearchParams'],
}
const globalNames = {
  Buffer: 'buffer',
  console: 'console',
  process: 'process',
  TextDecoder: 'text-decoder',
  TextEncoder: 'text-encoder',
  URL: 'url',
  URLSearchParams: 'url-search-params',
}
function globalRule(global) {
  return {
    meta: {type: 'suggestion', schema: []},
    create(context) {
      return {
        ImportDeclaration(node) {
          const source = node.source.value.replace(/^node:/, '')
          for (const specifier of node.specifiers) {
            const imported = specifier.imported?.name ?? (source === global.toLowerCase() ? global : undefined)
            if (imported === global && globalModules[source]?.includes(global)) {
              context.report({node: specifier, message: `Use the global ${global} instead of importing it.`})
            }
          }
        },
      }
    },
  }
}

module.exports = {
  ...Object.fromEntries(
    Object.entries(globalNames).map(([name, suffix]) => [`prefer-global-${suffix}`, globalRule(name)]),
  ),
  'exports-style': {
    meta: {type: 'suggestion', schema: [{enum: ['module.exports']}]},
    create(context) {
      return {
        AssignmentExpression(node) {
          if (
            node.left.type === 'MemberExpression' &&
            node.left.object.type === 'Identifier' &&
            node.left.object.name === 'exports'
          ) {
            context.report({node, message: 'Use module.exports instead of assigning properties of exports.'})
          }
        },
      }
    },
  },
}
