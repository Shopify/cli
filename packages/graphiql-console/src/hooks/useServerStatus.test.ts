import {useServerStatus} from './useServerStatus.ts'
import {renderHook, act} from '@testing-library/react'
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest'

describe('useServerStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('has initial state with serverIsLive=true and appIsInstalled=true', () => {
    const {result} = renderHook(() =>
      useServerStatus({
        baseUrl: 'http://localhost:3457',
        pingInterval: 2000,
        statusInterval: 5000,
        pingTimeout: 3000,
      }),
    )

    expect(result.current.serverIsLive).toBe(true)
    expect(result.current.appIsInstalled).toBe(true)
  })

  test('successful ping response sets serverIsLive=true', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      status: 200,
    })

    const {result} = renderHook(() =>
      useServerStatus({
        baseUrl: 'http://localhost:3457',
        pingInterval: 2000,
        pingTimeout: 3000,
      }),
    )

    // Wait for the initial ping to complete
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.serverIsLive).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3457/graphiql/ping', {
      method: 'GET',
    })
  })

  test('failed ping sets serverIsLive=false', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const {result} = renderHook(() =>
      useServerStatus({
        baseUrl: 'http://localhost:3457',
        pingInterval: 2000,
        pingTimeout: 3000,
      }),
    )

    // Wait for the initial ping to complete
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.serverIsLive).toBe(false)
  })

  test('successful status check updates app info', async () => {
    // Mock ping response (first call)
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        status: 200,
      })
      // Mock status response (second call)
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          status: 'OK',
          storeFqdn: 'test-store.myshopify.com',
          appName: 'Test App',
          appUrl: 'http://localhost:3000',
        }),
      })

    const {result} = renderHook(() =>
      useServerStatus({
        baseUrl: 'http://localhost:3457',
        pingInterval: 2000,
        statusInterval: 5000,
      }),
    )

    // Wait for both initial calls
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.appIsInstalled).toBe(true)
    expect(result.current.storeFqdn).toBe('test-store.myshopify.com')
    expect(result.current.appName).toBe('Test App')
    expect(result.current.appUrl).toBe('http://localhost:3000')
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3457/graphiql/status', {
      method: 'GET',
    })
  })

  test('failed status check sets appIsInstalled=false', async () => {
    // Mock ping response (first call)
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        status: 200,
      })
      // Mock failed status response (second call)
      .mockRejectedValueOnce(new Error('Status check failed'))

    const {result} = renderHook(() =>
      useServerStatus({
        baseUrl: 'http://localhost:3457',
        pingInterval: 2000,
        statusInterval: 5000,
      }),
    )

    // Wait for both initial calls
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.appIsInstalled).toBe(false)
  })

  test('polling intervals are respected', async () => {
    ;(global.fetch as any).mockResolvedValue({
      status: 200,
      json: async () => ({status: 'OK'}),
    })

    renderHook(() =>
      useServerStatus({
        baseUrl: 'http://localhost:3457',
        pingInterval: 2000,
        statusInterval: 5000,
      }),
    )

    // Initial calls (2 - ping and status)
    await act(async () => {
      await Promise.resolve()
    })

    const initialCallCount = (global.fetch as any).mock.calls.length
    expect(initialCallCount).toBe(2)

    // Advance by ping interval (2 seconds)
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    // Should have one more ping call
    expect((global.fetch as any).mock.calls.length).toBe(initialCallCount + 1)

    // Advance by status interval (5 seconds total)
    await act(async () => {
      vi.advanceTimersByTime(3000)
      await Promise.resolve()
    })

    // Should have another ping call and a status call
    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(initialCallCount + 1)
  })

  test('cleanup of resources on unmount', async () => {
    ;(global.fetch as any).mockResolvedValue({
      status: 200,
    })

    const {unmount} = renderHook(() =>
      useServerStatus({
        baseUrl: 'http://localhost:3457',
        pingInterval: 2000,
        statusInterval: 5000,
      }),
    )

    // Wait for initial calls
    await act(async () => {
      await Promise.resolve()
    })

    const callCountBeforeUnmount = (global.fetch as any).mock.calls.length

    unmount()

    // Advance time after unmount
    await act(async () => {
      vi.advanceTimersByTime(10000)
      await Promise.resolve()
    })

    // Should not have made any more calls
    expect((global.fetch as any).mock.calls.length).toBe(callCountBeforeUnmount)
  })
})
