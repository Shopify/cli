import {debounce, memoize, throttle} from './function.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

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

describe('debounce', () => {
  test('debounces the function', async () => {
    // Given
    let value = 0
    await new Promise<void>((resolve, reject) => {
      const debounced = debounce(() => {
        value += 1
        resolve()
      }, 200)
      debounced()
      debounced()
      debounced()
    })

    // Then
    expect(value).toEqual(1)
  })
})

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('throttles function executions over time', () => {
    // Given
    let count = 0
    const throttled = throttle(() => {
      count += 1
    }, 100)

    // When
    throttled()
    throttled()
    throttled()

    // Then
    expect(count).toBe(1)

    // Advance time past the wait interval
    vi.advanceTimersByTime(100)
    expect(count).toBe(2)
  })
})
