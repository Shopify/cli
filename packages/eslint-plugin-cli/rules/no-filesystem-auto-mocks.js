const path = require('node:path')

const filesystemModules = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises', '@shopify/cli-kit/node/fs'])

module.exports = {
  meta: {
    type: 'problem',
    docs: {description: 'use real filesystem fixtures instead of automatic filesystem mocks'},
    schema: [],
    messages: {filesystemMock: 'Use real files in a temporary directory instead of an automatic filesystem mock.'},
  },
  create(context) {
    if (!/\.test\.[jt]sx?$/.test(context.filename)) return {}

    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression' || node.callee.computed) return
        if (node.callee.object.name !== 'vi' || !['mock', 'doMock'].includes(node.callee.property.name)) return
        if (node.arguments.length !== 1) return

        const argument = node.arguments[0]
        let moduleName
        if (argument.type === 'Literal') moduleName = argument.value
        else if (argument.type === 'ImportExpression') moduleName = argument.source.value
        if (typeof moduleName !== 'string') return
        const isFilesystemModule = moduleName.startsWith('.')
          ? /\/packages\/cli-kit\/src\/public\/node\/fs\.[jt]s$/.test(
              path.posix.resolve(path.posix.dirname(context.filename.replaceAll('\\', '/')), moduleName),
            )
          : filesystemModules.has(moduleName.replace(/\.js$/, ''))
        if (!isFilesystemModule) return
        const variable = findVariable(context.sourceCode.getScope(node), 'vi')
        if (
          variable &&
          !variable.defs.some(
            (definition) =>
              definition.type === 'ImportBinding' &&
              definition.parent.source.value === 'vitest' &&
              definition.node.imported?.name === 'vi',
          )
        )
          return

        context.report({node, messageId: 'filesystemMock'})
      },
    }
  },
}

function findVariable(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name)
    if (variable) return variable
  }
  return undefined
}
