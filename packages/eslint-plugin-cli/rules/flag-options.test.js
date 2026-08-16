const {findFlagOptions} = require('./flag-options')

describe('findFlagOptions', () => {
  test('returns options passed directly to a flag factory', () => {
    const options = {type: 'ObjectExpression'}
    const flagFactory = {type: 'CallExpression', arguments: [options]}

    expect(findFlagOptions(flagFactory)).toBe(options)
  })

  test('recursively finds options inside nested flag wrappers', () => {
    const options = {type: 'ObjectExpression'}
    const flagFactory = {type: 'CallExpression', arguments: [options]}
    const innerWrapper = {type: 'CallExpression', arguments: [flagFactory]}
    const outerWrapper = {type: 'CallExpression', arguments: [innerWrapper]}

    expect(findFlagOptions(outerWrapper)).toBe(options)
  })

  test.each([undefined, {type: 'Identifier'}, {type: 'CallExpression', arguments: [{type: 'Identifier'}]}])(
    'returns undefined when options cannot be found',
    (expression) => {
      expect(findFlagOptions(expression)).toBeUndefined()
    },
  )
})
