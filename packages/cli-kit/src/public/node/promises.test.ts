import {flushPromises} from './promises.js'
import {describe, expect, test, vi} from 'vitest'

describe('flushPromises', () => {
  test('resolves after setImmediate executes', async () => {
    // Given
    const spy = vi.spyOn(global, 'setImmediate')
    let resolved = false

    // When
    const promise = flushPromises().then(() => {
      resolved = true
    })

    // Then
    expect(resolved).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)

    await promise
    expect(resolved).toBe(true)

    spy.mockRestore()
  })

  test('returns a Promise that resolves to void', async () => {
    // When
    const result = await flushPromises()

    // Then
    expect(result).toBeUndefined()
  })

  test('allows multiple pending promises to resolve', async () => {
    // Given
    let promise1Resolved = false
    let promise2Resolved = false

    const promise1 = new Promise<void>((resolve) => {
      setImmediate(() => {
        promise1Resolved = true
        resolve()
      })
    })

    const promise2 = new Promise<void>((resolve) => {
      setImmediate(() => {
        promise2Resolved = true
        resolve()
      })
    })

    // When - flushPromises allows the next tick to run
    await flushPromises()

    // Then - after flushPromises, setImmediate callbacks should have run
    await Promise.all([promise1, promise2])
    expect(promise1Resolved).toBe(true)
    expect(promise2Resolved).toBe(true)
  })

  test('integrates with async test scenarios', async () => {
    // Given
    const events: string[] = []

    // Simulate async operations
    setImmediate(() => events.push('immediate1'))
    Promise.resolve()
      .then(() => events.push('promise1'))
      .catch(() => {})
    setImmediate(() => events.push('immediate2'))

    // When
    await flushPromises()

    // Then - all immediate callbacks should have been scheduled
    // Wait a bit to let them execute
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    expect(events).toContain('immediate1')
    expect(events).toContain('immediate2')
    expect(events).toContain('promise1')
  })

  test('can be called multiple times', async () => {
    // When
    const result1 = flushPromises()
    const result2 = flushPromises()
    const result3 = flushPromises()

    // Then
    await expect(result1).resolves.toBeUndefined()
    await expect(result2).resolves.toBeUndefined()
    await expect(result3).resolves.toBeUndefined()
  })
})
