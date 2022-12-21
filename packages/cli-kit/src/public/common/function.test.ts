import {memoize} from './function.js'
import {describe, test, expect} from 'vitest'

describe('memoize', () => {
  test('memoizes the function value', () => {
    // Given
    let value = 0
    function functionToMemoize() {
      value += 1
      return value
    }
    const memoizedFunction = memoize(functionToMemoize)

    // When/Then
    expect(memoizedFunction()).toEqual(1)
    expect(memoizedFunction()).toEqual(1)
  })
})
