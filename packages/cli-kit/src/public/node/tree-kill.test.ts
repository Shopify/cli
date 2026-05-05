/* eslint-disable no-restricted-imports */
import {treeKill} from './tree-kill.js'
import {vi, describe, test, expect, afterEach} from 'vitest'
import {spawn} from 'child_process'

vi.mock('child_process', async () => {
  const actual: any = await vi.importActual('child_process')
  return {
    ...actual,
    spawn: vi.fn(),
  }
})

describe('treeKill', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('calls the callback with an error if the PID is not a number (string with digits)', async () => {
    const maliciousPid = '1234; calc.exe'

    await new Promise<void>((resolve) => {
      // Correct signature for treeKill is (pid, signal, killRoot, callback)
      treeKill(maliciousPid, 'SIGTERM', true, (err) => {
        expect(err?.message).toBe('pid must be a number')
        resolve()
      })
    })

    expect(spawn).not.toHaveBeenCalled()
  })

  test('works with a valid numeric PID as string', () => {
    const pid = '1234'
    vi.mocked(spawn).mockReturnValue({
      on: vi.fn(),
      stdout: {on: vi.fn()},
    } as any)
    vi.stubGlobal('process', {...process, platform: 'win32'})

    treeKill(pid)

    expect(spawn).toHaveBeenCalledWith('taskkill', ['/pid', '1234', '/T', '/F'])
  })

  test('works with a valid numeric PID as number', () => {
    const pid = 1234
    vi.mocked(spawn).mockReturnValue({
      on: vi.fn(),
      stdout: {on: vi.fn()},
    } as any)
    vi.stubGlobal('process', {...process, platform: 'win32'})

    treeKill(pid)

    expect(spawn).toHaveBeenCalledWith('taskkill', ['/pid', '1234', '/T', '/F'])
  })
})
