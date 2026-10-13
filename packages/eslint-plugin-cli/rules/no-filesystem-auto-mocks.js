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
    if (!/\.(test|spec)\.[cm]?[jt]sx?$/.test(context.filename)) return {}

    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression' || node.callee.computed) return
        if (!['mock', 'doMock'].includes(node.callee.property.name)) return
        if (!isVitestVi(context.sourceCode.getScope(node), node.callee.object)) return
        if (node.arguments.length !== 1) return

        const argument = node.arguments[0]
        let moduleName
        if (argument.type === 'Literal') moduleName = argument.value
        else if (argument.type === 'TemplateLiteral' && argument.expressions.length === 0)
          moduleName = argument.quasis[0].value.cooked
        else if (argument.type === 'ImportExpression') moduleName = argument.source.value
        if (typeof moduleName !== 'string') return
        const isFilesystemModule = moduleName.startsWith('.')
          ? /\/packages\/cli-kit\/src\/public\/node\/fs\.[jt]s$/.test(
              path.posix.resolve(path.posix.dirname(context.filename.replaceAll('\\', '/')), moduleName),
            )
          : filesystemModules.has(moduleName.replace(/\.js$/, ''))
        if (!isFilesystemModule) return

        context.report({node, messageId: 'filesystemMock'})
      },
    }
  },
}

// Accepts the global `vi`, any local name bound to `import {vi} from 'vitest'`, and `ns.vi` for `import * as ns from 'vitest'`.
function isVitestVi(scope, object) {
  if (object.type === 'Identifier') {
    const variable = findVariable(scope, object.name)
    if (!variable) return object.name === 'vi'
    return variable.defs.some(
      (definition) =>
        definition.type === 'ImportBinding' &&
        definition.parent.source.value === 'vitest' &&
        definition.node.type === 'ImportSpecifier' &&
        definition.node.imported?.name === 'vi',
    )
  }
  if (object.type !== 'MemberExpression' || object.computed || object.property.name !== 'vi') return false
  if (object.object.type !== 'Identifier') return false
  const namespace = findVariable(scope, object.object.name)
  return Boolean(
    namespace?.defs.some(
      (definition) =>
        definition.type === 'ImportBinding' &&
        definition.parent.source.value === 'vitest' &&
        definition.node.type === 'ImportNamespaceSpecifier',
    ),
  )
}

function findVariable(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name)
    if (variable) return variable
  }
  return undefined
}
