function commentFor(source, node) {
  const owner =
    node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration'
      ? node.parent
      : node
  const comment = source
    .getCommentsBefore(owner)
    .filter((candidate) => candidate.type === 'Block' && candidate.value.startsWith('*'))
    .at(-1)
  return comment?.type === 'Block' && comment.value.startsWith('*') ? comment : undefined
}
function description(comment) {
  return comment.value
    .replace(/^\*/, '')
    .split(/\n/)
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .join('\n')
    .replace(/```[\s\S]*?```/g, '')
    .split(/(?:^|\n)@/)[0]
    .trim()
}
function commentRule(check) {
  return {
    meta: {type: 'suggestion', schema: []},
    create(context) {
      return {
        Program() {
          for (const comment of context.sourceCode.getAllComments()) {
            if (comment.type === 'Block' && comment.value.startsWith('*')) check(context, comment)
          }
        },
      }
    },
  }
}
function exportedFunctionRule(check) {
  return {
    meta: {type: 'suggestion', schema: [{type: 'object'}]},
    create(context) {
      return {
        FunctionDeclaration(node) {
          if (!['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(node.parent.type)) return
          const comment = commentFor(context.sourceCode, node)
          if (comment && !/@(?:inheritDoc|inheritdoc|override|abstract|virtual)/.test(comment.value))
            check(context, node, comment)
        },
      }
    },
  }
}
function hasReturnedValue(node) {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'ReturnStatement') return Boolean(node.argument)
  if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) return false
  return Object.entries(node).some(
    ([name, value]) =>
      name !== 'parent' && (Array.isArray(value) ? value.some(hasReturnedValue) : hasReturnedValue(value)),
  )
}
module.exports = {
  'jsdoc-require-param': exportedFunctionRule((context, node, comment) => {
    const documented = new Set(
      [...comment.value.matchAll(/@param\s+(?:\{[^}]*\}\s*)?([^\s]+)/g)].map(
        (match) => match[1].replace(/^\[|\]$/g, '').split('=')[0],
      ),
    )
    for (let parameter of node.params) {
      if (parameter.type === 'AssignmentPattern') parameter = parameter.left
      if (parameter.type === 'RestElement') parameter = parameter.argument
      if (parameter.type === 'Identifier' && !documented.has(parameter.name)) {
        context.report({node: parameter, message: `Missing JSDoc @param "${parameter.name}" declaration.`})
      }
    }
  }),
  'jsdoc-require-returns': exportedFunctionRule((context, node, comment) => {
    const annotation = node.returnType?.typeAnnotation
    const result =
      annotation?.type === 'TSTypeReference' && annotation.typeName.name === 'Promise'
        ? (annotation.typeArguments ?? annotation.typeParameters)?.params[0]
        : annotation
    if (['TSVoidKeyword', 'TSNeverKeyword'].includes(result?.type)) return
    if (!node.generator && hasReturnedValue(node.body) && !/@returns?\b/.test(comment.value)) {
      context.report({node, message: 'Missing JSDoc @returns declaration.'})
    }
  }),
  'jsdoc-require-jsdoc': {
    meta: {type: 'suggestion', schema: [{type: 'object'}]},
    create(context) {
      return {
        FunctionDeclaration(node) {
          if (!['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(node.parent.type)) return
          if (!commentFor(context.sourceCode, node))
            context.report({node, message: 'Document exported public functions with JSDoc.'})
        },
      }
    },
  },
  'jsdoc-require-description': commentRule((context, comment) => {
    if (!description(comment) && !/@(?:inheritDoc|inheritdoc|override|param)/.test(comment.value))
      context.report({loc: comment.loc, message: 'JSDoc requires a description.'})
  }),
  'jsdoc-require-description-complete-sentence': commentRule((context, comment) => {
    const text = description(comment)
    if (text && (!/^[A-Z`]/.test(text) || !/[.!?]$/.test(text)))
      context.report({loc: comment.loc, message: 'Use a complete sentence for the JSDoc description.'})
  }),
  'jsdoc-require-hyphen-before-param-description': commentRule((context, comment) => {
    for (const match of comment.value.matchAll(/@param\s+(?:\{[^}]*\}\s*)?(\S+)\s+([^\n]*)/g)) {
      if (match[2].trim() && !match[2].trim().startsWith('-'))
        context.report({loc: comment.loc, message: `Use a hyphen before the description of @param ${match[1]}.`})
    }
  }),
  'jsdoc-no-types': commentRule((context, comment) => {
    if (/@(?:param|returns?)\s+\{/.test(comment.value))
      context.report({
        loc: comment.loc,
        message: 'Use TypeScript annotations instead of JSDoc parameter and return types.',
      })
  }),
}
