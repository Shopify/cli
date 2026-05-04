/* eslint-disable no-restricted-imports */
import {treeKill} from './tree-kill.js'
import * as output from './output.js'
import {describe, expect, test, vi, afterEach} from 'vitest'
import {spawn} from 'child_process'

vi.mock('./output.js')
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: {on: vi.fn()},
    on: vi.fn(),
  })),
}))

describe('treeKill', () => {
  const originalPlatform = process.platform

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    })
  })

  test('logs an error if pid is not a number and no callback is provided', () => {
    // When
    treeKill('abc')

    // Then
    expect(output.outputDebug).toHaveBeenCalledWith(
      expect.stringContaining('Failed to kill process abc: Error: pid must be a number'),
    )
  })

  test('calls callback with error if pid is not a number and callback is provided', () => {
    // Given
    const callback = vi.fn()

    // When
    treeKill('abc', 'SIGTERM', true, callback)

    // Then
    expect(callback).toHaveBeenCalledWith(expect.any(Error))
    expect(callback.mock.calls[0]![0].message).toBe('pid must be a number')
  })

  test('calls taskkill on Windows', () => {
    // Given
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    })
    const pid = 1234
    const callback = vi.fn()
    const mockOn = vi.fn()
    vi.mocked(spawn).mockReturnValue({
      on: mockOn.mockReturnValue({
        on: mockOn,
      }),
    } as any)

    // When
    treeKill(pid, 'SIGTERM', true, callback)

    // Then
    expect(spawn).toHaveBeenCalledWith('taskkill', ['/pid', '1234', '/T', '/F'])
    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mockOn).toHaveBeenCalledWith('close', expect.any(Function))
  })

  test('calls callback with error if taskkill fails to spawn', () => {
    // Given
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    })
    const pid = 1234
    const callback = vi.fn()
    const mockOn = vi.fn()
    vi.mocked(spawn).mockReturnValue({
      on: mockOn.mockImplementation((event, cb) => {
        if (event === 'error') {
          cb(new Error('spawn ENOENT'))
        }
        return {on: mockOn}
      }),
    } as any)

    // When
    treeKill(pid, 'SIGTERM', true, callback)

    // Then
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({message: 'spawn ENOENT'}))
  })

  test('calls pgrep on Darwin', () => {
    // Given
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    })
    const pid = 1234
    const mockSpawn = vi.mocked(spawn)
    mockSpawn.mockReturnValue({
      stdout: {on: vi.fn()},
      on: vi.fn(),
    } as any)

    // When
    treeKill(pid)

    // Then
    expect(spawn).toHaveBeenCalledWith('pgrep', ['-lfP', '1234'])
  })

  test('calls ps on other platforms', () => {
    // Given
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    })
    const pid = 1234
    const mockSpawn = vi.mocked(spawn)
    mockSpawn.mockReturnValue({
      stdout: {on: vi.fn()},
      on: vi.fn(),
    } as any)

    // When
    treeKill(pid)

    // Then
    expect(spawn).toHaveBeenCalledWith('ps', ['-o', 'pid command', '--no-headers', '--ppid', '1234'])
  })
})
