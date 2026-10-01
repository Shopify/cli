const {isBuiltin} = require('node:module')

function groupFor(node) {
  if (node.importKind === 'type') return 'type'
  const source = node.source.value
  if (isBuiltin(source)) return 'builtin'
  if (/^\.\.?\/(?:index(?:\.[a-z]+)?)?$/.test(source)) return 'index'
  if (source.startsWith('../')) return 'parent'
  if (source.startsWith('./')) return 'sibling'
  return 'external'
}

module.exports = {
  meta: {type: 'suggestion', fixable: 'code', schema: [{type: 'object'}]},
  create(context) {
    return {
      Program(node) {
        const options = context.options[0] ?? {}
        const groups = options.groups ?? ['builtin', 'external', 'parent', 'sibling', 'index']
        const imports = node.body.filter(
          (statement) => statement.type === 'ImportDeclaration' && statement.specifiers.length,
        )
        const rank = (statement) => {
          const index = groups.findIndex((group) => [].concat(group).includes(groupFor(statement)))
          return index < 0 ? groups.length : index
        }
        const sorted = [...imports].sort((first, second) => rank(first) - rank(second))
        const wrongOrder = imports.some((statement, index) => sorted[index] !== statement)
        const missingLine =
          options['newlines-between'] === 'always' &&
          imports.some(
            (statement, index) =>
              index > 0 &&
              rank(statement) !== rank(imports[index - 1]) &&
              statement.loc.start.line === imports[index - 1].loc.end.line + 1,
          )
        if (!wrongOrder && !missingLine) return
        const first = imports[0]
        const last = imports.at(-1)
        // Move only a contiguous block without comments or side-effect imports.
        // Those can change execution order or belong to the following declaration.
        const block = node.body.filter(
          (statement) => statement.range[0] >= first.range[0] && statement.range[1] <= last.range[1],
        )
        const movable =
          block.length === imports.length &&
          !context.sourceCode
            .getAllComments()
            .some((comment) => comment.range[0] >= first.range[0] && comment.range[1] <= last.range[1])
        context.report({
          node: first,
          message: 'Keep imports in the configured group order.',
          fix: movable
            ? (fixer) =>
                fixer.replaceTextRange(
                  [first.range[0], last.range[1]],
                  sorted
                    .map(
                      (statement, index) =>
                        (index > 0 &&
                        options['newlines-between'] === 'always' &&
                        rank(statement) !== rank(sorted[index - 1])
                          ? '\n'
                          : '') + context.sourceCode.getText(statement),
                    )
                    .join('\n'),
                )
            : undefined,
        })
      },
    }
  },
}
