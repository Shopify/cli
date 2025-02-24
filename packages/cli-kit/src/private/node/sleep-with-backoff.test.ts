import {sleepWithBackoffUntil} from './sleep-with-backoff.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'

describe('sleepWithBackoffUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('yields immediately on first attempt', async () => {
    const generator = sleepWithBackoffUntil(5000, 1000)
    const start = Date.now()

    const result = generator.next()
    vi.runAllTimers()

    expect(Date.now() - start).toBe(0)
    await expect(result).resolves.toEqual({value: 0, done: false})
  })

  test('stops before exceeding time limit', async () => {
    const generator = sleepWithBackoffUntil(5000, 1000)
    const delays: number[] = []

    // First attempt
    let result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toEqual({value: 0, done: false})
    delays.push(0)

    // Second attempt
    result = generator.next()
    vi.advanceTimersByTime(1000)
    await expect(result).resolves.toEqual({value: 1000, done: false})
    delays.push(1000)

    // Third attempt
    result = generator.next()
    vi.advanceTimersByTime(3000)
    await expect(result).resolves.toEqual({value: 2000, done: false})
    delays.push(2000)

    // Should stop before next attempt (would be 7000ms)
    result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toMatchObject({
      done: true,
      value: {iterations: 3},
    })

    expect(delays).toEqual([0, 1000, 2000])

    result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toEqual({done: true})
  })

  test('uses default values when not specified', async () => {
    const generator = sleepWithBackoffUntil()
    const start = Date.now()

    let result = generator.next()
    vi.runAllTimers()
    expect(Date.now() - start).toBe(0)
    await expect(result).resolves.toEqual({value: 0, done: false})

    result = generator.next()
    vi.advanceTimersByTime(300)
    expect(Date.now() - start).toBe(300)
    await expect(result).resolves.toEqual({value: 300, done: false})
  })

  test('stops immediately if maxTimeMs is 0', async () => {
    const generator = sleepWithBackoffUntil(0, 1000)
    const result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toMatchObject({
      done: true,
      value: {
        remainingMs: 0,
        iterations: 0,
      },
    })
  })

  test('respects wall clock time including caller delays', async () => {
    const generator = sleepWithBackoffUntil(5000, 1000)
    const delays: number[] = []

    // First attempt
    let result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toEqual({value: 0, done: false})
    delays.push(0)
    // caller delay
    vi.advanceTimersByTime(2000)

    // Second attempt
    result = generator.next()
    vi.advanceTimersByTime(1000)
    await expect(result).resolves.toEqual({value: 1000, done: false})
    delays.push(1000)
    // caller delay
    vi.advanceTimersByTime(2000)

    // Should stop due to elapsed time
    result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toMatchObject({done: true})

    expect(delays).toEqual([0, 1000])
  })

  test('returns remaining time and iteration count', async () => {
    const generator = sleepWithBackoffUntil(5000, 1000)
    const delays: number[] = []

    // First attempt
    let result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toEqual({value: 0, done: false})
    delays.push(0)

    // Second attempt
    result = generator.next()
    vi.advanceTimersByTime(1000)
    await expect(result).resolves.toEqual({value: 1000, done: false})
    delays.push(1000)

    // Third attempt
    result = generator.next()
    vi.advanceTimersByTime(3000)
    await expect(result).resolves.toEqual({value: 2000, done: false})
    delays.push(2000)

    // Should stop and return stats
    result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toMatchObject({
      done: true,
      value: {
        remainingMs: expect.any(Number),
        iterations: 3,
      },
    })

    const {value} = await result
    expect((value as any).remainingMs).toBeGreaterThan(0)
    expect((value as any).remainingMs).toBeLessThan(5000)
  })

  test('includes caller delays in remaining time calculation', async () => {
    const generator = sleepWithBackoffUntil(5000, 1000)
    const delays: number[] = []

    // First attempt
    let result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toEqual({value: 0, done: false})
    delays.push(0)
    // caller delay
    vi.advanceTimersByTime(2000)

    // Second attempt
    result = generator.next()
    vi.advanceTimersByTime(1000)
    await expect(result).resolves.toEqual({value: 1000, done: false})
    delays.push(1000)
    // caller delay
    vi.advanceTimersByTime(2000)

    // Should stop and include caller delays in calculation
    result = generator.next()
    vi.runAllTimers()
    await expect(result).resolves.toMatchObject({
      done: true,
      value: {iterations: 2},
    })

    expect(delays).toEqual([0, 1000])
  })
})
