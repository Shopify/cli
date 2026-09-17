import {throttle} from './throttle.js'
import {describe, expect, test, vi} from 'vitest'

describe('throttle', () => {
  test('executes immediately on leading edge by default', () => {
    vi.useFakeTimers()
    try {
      const func = vi.fn((...args: unknown[]) => (args[0] as number) * 2)
      const throttled = throttle(func, 100)

      const result = throttled(5)
      expect(func).toHaveBeenCalledTimes(1)
      expect(func).toHaveBeenCalledWith(5)
      expect(result).toBe(10)
    } finally {
      vi.useRealTimers()
    }
  })

  test('throttles calls within wait period and executes latest call on trailing edge', () => {
    vi.useFakeTimers()
    try {
      const func = vi.fn((...args: unknown[]) => (args[0] as number) * 2)
      const throttled = throttle(func, 100)

      throttled(1)
      expect(func).toHaveBeenCalledTimes(1)
      expect(func).toHaveBeenCalledWith(1)

      throttled(2)
      throttled(3)
      expect(func).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      expect(func).toHaveBeenCalledTimes(2)
      expect(func).toHaveBeenCalledWith(3)
    } finally {
      vi.useRealTimers()
    }
  })

  test('respects leading: false option by suppressing immediate execution', () => {
    vi.useFakeTimers()
    try {
      const func = vi.fn((...args: unknown[]) => (args[0] as number) * 2)
      const throttled = throttle(func, 100, {leading: false})

      throttled(1)
      expect(func).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(func).toHaveBeenCalledTimes(1)
      expect(func).toHaveBeenCalledWith(1)
    } finally {
      vi.useRealTimers()
    }
  })

  test('respects trailing: false option by disabling trailing edge execution', () => {
    vi.useFakeTimers()
    try {
      const func = vi.fn((...args: unknown[]) => (args[0] as number) * 2)
      const throttled = throttle(func, 100, {trailing: false})

      throttled(1)
      expect(func).toHaveBeenCalledTimes(1)
      expect(func).toHaveBeenCalledWith(1)

      throttled(2)
      vi.advanceTimersByTime(100)
      expect(func).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  test('swallows rejected promise errors on trailing edge execution to prevent unhandled rejections', async () => {
    vi.useFakeTimers()
    try {
      const func = vi.fn((...args: unknown[]) => Promise.reject(new Error(`Failed ${args[0] as number}`)))
      const throttled = throttle(func, 100)

      // Leading call - catch its rejection
      const p1 = throttled(1)
      await expect(p1).rejects.toThrow('Failed 1')

      // Trailing call
      throttled(2)

      // Advance timers to trigger trailing execution
      vi.advanceTimersByTime(100)

      // Expect function called for trailing execution without unhandled promise rejection
      expect(func).toHaveBeenCalledTimes(2)
      expect(func).toHaveBeenCalledWith(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
