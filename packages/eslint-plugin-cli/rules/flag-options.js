function findFlagOptions(expression) {
  if (expression?.type !== 'CallExpression') return undefined

  const firstArgument = expression.arguments[0]
  if (firstArgument?.type === 'ObjectExpression') return firstArgument

  return findFlagOptions(firstArgument)
}

module.exports = {findFlagOptions}
