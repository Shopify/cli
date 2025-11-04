import {useSelfAdjustingInterval} from './useSelfAdjustingInterval.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import React from 'react'
import {render} from '@shopify/cli-kit/node/testing/ui'

function renderHook<THookResult>(renderHookCallback: () => THookResult) {
  const result: {
    lastResult: THookResult | undefined
    lastError: unknown | undefined
  } = {
    lastResult: undefined,
    lastError: undefined,
  }

  const MockComponent = () => {
    try {
      const hookResult = renderHookCallback()
      result.lastResult = hookResult
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (errorFromHook) {
      result.lastError = errorFromHook
    }

    return null
  }

  const {unmount} = render(<MockComponent />)

  return {
    lastResult: result.lastResult,
    lastError: result.lastError,
    unmount,
  }
}

describe('useSelfAdjustingInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  test('calls callback immediately and sets up next interval', async () => {
    const callback = vi.fn(() => Promise.resolve({retryIntervalMs: 1000}))

    renderHook(() => useSelfAdjustingInterval(callback))

    // Initial call at t=0
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toHaveBeenCalledTimes(1)

    // Next call after retryIntervalMs
    await vi.advanceTimersByTimeAsync(1000)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  test('adjusts interval based on callback return value', async () => {
    const callback = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve({retryIntervalMs: 1000}))
      .mockImplementationOnce(() => Promise.resolve({retryIntervalMs: 2000}))
      .mockImplementationOnce(() => Promise.resolve({retryIntervalMs: null}))
    renderHook(() => useSelfAdjustingInterval(callback))

    // Initial call
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toHaveBeenCalledTimes(1)

    // Next call after 1000ms
    await vi.advanceTimersByTimeAsync(1000)
    expect(callback).toHaveBeenCalledTimes(2)

    // Next call after 2000ms
    await vi.advanceTimersByTimeAsync(2000)
    expect(callback).toHaveBeenCalledTimes(3)

    // Doesn't get called again because retryIntervalMs is null
    await vi.advanceTimersByTimeAsync(2000)
    expect(callback).toHaveBeenCalledTimes(3)
  })

  test('deals with the callback throwing an error', async () => {
    const callback = vi.fn(() => Promise.reject(new Error('test error')))
    const {lastResult} = renderHook(() => useSelfAdjustingInterval(callback))

    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(lastResult).toBeUndefined()
  })

  test('cleans up timeout on unmount', async () => {
    const callback = vi.fn(() => Promise.resolve({retryIntervalMs: 1000}))

    const {unmount} = renderHook(() => useSelfAdjustingInterval(callback))

    // give it a moment to set up the interval
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(1)

    // unmount and give it a moment to clean up the interval
    unmount()
    await vi.advanceTimersByTimeAsync(0)

    expect(vi.getTimerCount()).toBe(0)
  })
})
