// https://eslint.org/docs/developer-guide/working-with-rules

/**
 * Check if importing is allowed for static or dynamic definition
 *
 * @param {string[]} allowList
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').ImportDeclaration | import('estree').ImportExpression} node
 */
function checkImport(allowList, context, node) {
  const importTarget = node.source?.value
  if (typeof importTarget !== 'string') {
    return
  }

  const gotMatch = allowList.includes(importTarget)

  if (!gotMatch) {
    context.report(node, `Forbidden import source "${importTarget}", update allow list if required in the package.json`)
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
          dynamic: {
            description: 'Allowed modules to import dynamically',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          static: {
            description: 'Allowed modules to import statically',
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    ],
  },
  create(context) {
    /** @type {{dynamic?: string[], static?: string[]}} */
    const options = context.options[0] ?? {}

    const dynamic = options?.dynamic ?? []
    const static = options?.static ?? []

    return {
      ImportDeclaration(node) {
        checkImport(static, context, node)
      },
      ImportExpression(node) {
        checkImport(dynamic, context, node)
      },
    }
  },
}
