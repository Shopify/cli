// https://eslint.org/docs/developer-guide/working-with-rules

/**
 * Check if importing is allowed for static or dynamic definition
 *
 * @param {Record<string, string[]>} allowList
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').ImportDeclaration | import('estree').ImportExpression} node
 */
function checkImport(allowList, context, node) {
  const importTarget = node.source?.value
  if (typeof importTarget !== 'string') {
    return
  }
  const sourceFile = context.getFilename()

  let gotMatch = false
  Object.entries(allowList).forEach(([globPath, allowedImports]) => {
    if (gotMatch) {
      return
    }
    const re = new RegExp(globPath)
    if (sourceFile.match(re)) {
      if (allowedImports.includes(importTarget)) {
        gotMatch = true
      }
    }
  })

  if (!gotMatch) {
    context.report(node, `Forbidden import source "${importTarget}", update allow list if required`)
  }
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "This rule blocks imports that have not been explicitly allowed - it's ideal for bootstrapping code that needs to minimise the number of modules imported (and hence start-up time)",
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: {
            type: 'object',
            patternProperties: {
              '.*': {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
          enableStaticImports: {type: 'boolean'},
        },
      },
    ],
  },
  create(context) {
    /** @type {{enableStaticImports?: boolean, allow?: Record<string, string[]>}} */
    const options = context.options[0] ?? {}

    const allowList = options?.allow ?? {}
    const enableStaticImports = options?.enableStaticImports ?? false

    return {
      ImportDeclaration(node) {
        if (!enableStaticImports) {
          context.report(node, 'Only dynamic imports via `await import(...)` are allowed in bootstrap code')
          return
        }
        checkImport(allowList, context, node)
      },
      ImportExpression(node) {
        checkImport(allowList, context, node)
      },
    }
  },
}
