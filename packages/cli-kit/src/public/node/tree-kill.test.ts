/* eslint-disable no-restricted-imports */
import {treeKill} from './tree-kill.js'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
import {execFile} from 'child_process'

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execFile: vi.fn(),
  spawn: vi.fn(() => ({
    stdout: {on: vi.fn()},
    on: vi.fn(),
  })),
}))

describe('treeKill', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    })
  })

  test('calls taskkill on Windows with numeric PID', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    })

    treeKill(123)

    expect(execFile).toHaveBeenCalledWith('taskkill', ['/pid', '123', '/T', '/F'], expect.any(Function))
  })

  test('throws or calls callback with error for non-numeric PID', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    })

    const callback = vi.fn()

    treeKill('123 & calc', 'SIGTERM', true, callback)

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'pid must be a number',
      }),
    )
    expect(execFile).not.toHaveBeenCalled()
  })

  test('handles string numeric PID', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    })

    treeKill('123')

    expect(execFile).toHaveBeenCalledWith('taskkill', ['/pid', '123', '/T', '/F'], expect.any(Function))
  })
})
