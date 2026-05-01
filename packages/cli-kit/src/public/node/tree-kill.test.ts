import {treeKill} from './tree-kill.js'
import {exec, spawn} from 'child_process'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'

vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(() => {
    const mockProcess: any = {
      stdout: {
        on: vi.fn(),
      },
      on: vi.fn(),
    }
    mockProcess.on.mockReturnValue(mockProcess)
    return mockProcess
  }),
}))

describe('treeKill', () => {
  let originalPlatform: string

  beforeEach(() => {
    originalPlatform = process.platform
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    })
    vi.clearAllMocks()
  })

  test('raises an error if the pid is not a number string', () => {
    // Given
    const pid = '123; calc.exe'
    const callback = vi.fn()

    // When
    treeKill(pid, 'SIGTERM', true, callback)

    // Then
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'pid must be a number',
      }),
    )
    expect(exec).not.toHaveBeenCalled()
    expect(spawn).not.toHaveBeenCalled()
  })

  test('on windows, it calls taskkill with the correct pid', () => {
    // Given
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    })
    const pid = 123
    const callback = vi.fn()

    // When
    treeKill(pid, 'SIGTERM', true, callback)

    // Then
    expect(spawn).toHaveBeenCalledWith('taskkill', ['/pid', '123', '/T', '/F'])
  })
})
