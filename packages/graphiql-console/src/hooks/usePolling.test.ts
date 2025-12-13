import {usePolling} from './usePolling.ts'
import {renderHook, act} from '@testing-library/react'
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest'

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('calls callback immediately on mount', () => {
    const callback = vi.fn()
    renderHook(() => usePolling(callback, {interval: 1000, enabled: true}))

    expect(callback).toHaveBeenCalledTimes(1)
  })

  test('calls callback at specified interval', () => {
    const callback = vi.fn()
    renderHook(() => usePolling(callback, {interval: 1000, enabled: true}))

    // Initial call
    expect(callback).toHaveBeenCalledTimes(1)

    // After 1 second
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(callback).toHaveBeenCalledTimes(2)

    // After 2 seconds total
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(callback).toHaveBeenCalledTimes(3)
  })

  test('respects enabled=false (no polling)', () => {
    const callback = vi.fn()
    renderHook(() => usePolling(callback, {interval: 1000, enabled: false}))

    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(callback).not.toHaveBeenCalled()
  })

  test('updates when callback reference changes', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    const {rerender} = renderHook(({cb}) => usePolling(cb, {interval: 1000, enabled: true}), {
      initialProps: {cb: callback1},
    })

    // Initial call with callback1
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).not.toHaveBeenCalled()

    // Update callback
    rerender({cb: callback2})

    // Advance time - should call callback2 now
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // callback1 should still be at 1, callback2 should be at 1
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
  })

  test('cleans up interval on unmount', () => {
    const callback = vi.fn()
    const {unmount} = renderHook(() => usePolling(callback, {interval: 1000, enabled: true}))

    expect(callback).toHaveBeenCalledTimes(1)

    unmount()

    // Advance time after unmount
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Should not have been called again
    expect(callback).toHaveBeenCalledTimes(1)
  })

  test('handles async callbacks', async () => {
    const callback = vi.fn().mockResolvedValue(undefined)

    renderHook(() => usePolling(callback, {interval: 1000, enabled: true}))

    // Wait for initial call
    await act(async () => {
      await Promise.resolve()
    })

    expect(callback).toHaveBeenCalledTimes(1)

    // Advance timer and wait for async call
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(callback).toHaveBeenCalledTimes(2)
  })

  test('catches and ignores callback errors', () => {
    // Suppress console.error for this test since React will report the error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const callback = vi.fn().mockImplementation(() => {
      throw new Error('Test error')
    })

    // Render the hook - errors should be caught internally
    renderHook(() => usePolling(callback, {interval: 1000, enabled: true}))

    expect(callback).toHaveBeenCalledTimes(1)

    // Should continue polling despite errors
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(callback).toHaveBeenCalledTimes(2)

    // Restore console.error
    consoleErrorSpy.mockRestore()
  })

  test('changes interval dynamically', () => {
    const callback = vi.fn()

    const {rerender} = renderHook(({interval}) => usePolling(callback, {interval, enabled: true}), {
      initialProps: {interval: 1000},
    })

    // Initial call
    expect(callback).toHaveBeenCalledTimes(1)

    // Advance by 1 second
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(callback).toHaveBeenCalledTimes(2)

    // Change interval to 500ms - this triggers immediate call and restarts interval
    act(() => {
      rerender({interval: 500})
    })
    // Rerender triggers an immediate call due to useEffect re-running
    expect(callback).toHaveBeenCalledTimes(3)

    // Advance by 500ms - should call again
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(callback).toHaveBeenCalledTimes(4)

    // Another 500ms
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(callback).toHaveBeenCalledTimes(5)
  })
})
