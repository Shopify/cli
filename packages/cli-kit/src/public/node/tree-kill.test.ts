import {treeKill} from './tree-kill.js'
import {describe, expect, test, vi} from 'vitest'

describe('treeKill', () => {
  test('rejects non-numeric string PID', () => {
    // Given
    const pid = '123; echo "hello"'
    const callback = vi.fn()

    // When
    treeKill(pid, 'SIGTERM', true, callback)

    // Then
    expect(callback).toHaveBeenCalledWith(expect.any(Error))
    expect((callback.mock.calls[0]![0] as Error).message).toBe('pid must be a number')
  })

  test('accepts numeric string PID', () => {
    // Given
    const pid = '12345'
    const callback = vi.fn()

    // When
    // We expect it to proceed to actual process killing, which we didn't mock yet
    // so it might fail with ESRCH or similar if PID doesn't exist, but it shouldn't
    // fail the initial validation.
    try {
      treeKill(pid, 'SIGTERM', true, callback)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // ignore
    }

    // Then
    // If it passed validation, it would not have called callback with 'pid must be a number'
    if (callback.mock.calls.length > 0) {
      expect((callback.mock.calls[0]![0] as Error).message).not.toBe('pid must be a number')
    }
  })

  test('accepts numeric PID', () => {
    // Given
    const pid = 12345
    const callback = vi.fn()

    // When
    try {
      treeKill(pid, 'SIGTERM', true, callback)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // ignore
    }

    // Then
    if (callback.mock.calls.length > 0) {
      expect((callback.mock.calls[0]![0] as Error).message).not.toBe('pid must be a number')
    }
  })
})
