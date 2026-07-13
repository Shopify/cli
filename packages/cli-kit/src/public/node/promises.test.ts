import {flushPromises} from './promises.js'
import {describe, expect, test} from 'vitest'

describe('flushPromises', () => {
  test('waits for microtasks to complete', async () => {
    // Given
    let result = ''
    const _promise = Promise.resolve().then(() => {
      result += 'microtask'
    })

    // When
    await flushPromises()
    result += ' flushed'

    // Then
    expect(result).toBe('microtask flushed')
  })

  test('waits for multiple nested microtasks', async () => {
    // Given
    let result = ''
    const _promise = Promise.resolve()
      .then(() => {
        result += '1'
        return 'intermediate'
      })
      .then(() => {
        result += '2'
      })

    // When
    await flushPromises()
    result += ' flushed'

    // Then
    expect(result).toBe('12 flushed')
  })

  test('waits for macrotasks scheduled with setImmediate', async () => {
    // Given
    let result = ''
    setImmediate(() => {
      result += 'macrotask'
    })

    // When
    await flushPromises()
    result += ' flushed'

    // Then
    expect(result).toBe('macrotask flushed')
  })
})
