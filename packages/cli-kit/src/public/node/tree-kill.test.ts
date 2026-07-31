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

interface SpawnMockOptions {
  stdoutData?: string
  exitCode?: number
}

function createMockProcess(options: SpawnMockOptions) {
  return {
    stdout: {
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'data' && options.stdoutData !== undefined) {
          cb(Buffer.from(options.stdoutData))
        }
      }),
    },
    on: vi.fn((event: string, cb: Function) => {
      if (event === 'close') {
        cb(options.exitCode ?? 0)
      }
    }),
  }
}

describe('treeKill', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    // eslint-disable-next-line @shopify/cli/no-vi-manual-mock-clear
    vi.restoreAllMocks()
  })

  test('calls the callback with an error if the PID is not a number (string with digits)', async () => {
    const maliciousPid = '1234; calc.exe'

    await new Promise<void>((resolve) => {
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

  test('win32: calls callback with error if taskkill exits with non-zero code', async () => {
    vi.stubGlobal('process', {...process, platform: 'win32'})
    const mockTaskkill = createMockProcess({exitCode: 1})
    vi.mocked(spawn).mockReturnValue(mockTaskkill as any)

    await new Promise<void>((resolve) => {
      treeKill('1234', 'SIGTERM', true, (err) => {
        expect(err?.message).toBe('taskkill exited with code 1')
        resolve()
      })
    })
  })

  test('darwin: recursively builds process tree and kills all processes', async () => {
    vi.stubGlobal('process', {...process, platform: 'darwin'})
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    vi.mocked(spawn).mockImplementation((cmd, args) => {
      const parentPid = args ? args[args.length - 1] : ''
      if (parentPid === '1234') {
        return createMockProcess({stdoutData: '1235 child_cmd\n', exitCode: 0}) as any
      }
      return createMockProcess({stdoutData: '', exitCode: 1}) as any
    })

    await new Promise<void>((resolve) => {
      treeKill('1234', 'SIGTERM', true, (err) => {
        expect(err).toBeUndefined()
        resolve()
      })
    })

    expect(spawn).toHaveBeenCalledWith('pgrep', ['-lfP', '1234'])
    expect(spawn).toHaveBeenCalledWith('pgrep', ['-lfP', '1235'])
    expect(killSpy).toHaveBeenCalledWith(1235, 'SIGTERM')
    expect(killSpy).toHaveBeenCalledWith(1234, 'SIGTERM')
  })

  test('linux (default): recursively builds process tree and kills all processes', async () => {
    vi.stubGlobal('process', {...process, platform: 'linux'})
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    vi.mocked(spawn).mockImplementation((cmd, args) => {
      const parentPid = args ? args[args.length - 1] : ''
      if (parentPid === '1234') {
        return createMockProcess({stdoutData: '1235 child_cmd\n', exitCode: 0}) as any
      }
      return createMockProcess({stdoutData: '', exitCode: 1}) as any
    })

    await new Promise<void>((resolve) => {
      treeKill('1234', 'SIGINT', true, (err) => {
        expect(err).toBeUndefined()
        resolve()
      })
    })

    expect(spawn).toHaveBeenCalledWith('ps', ['-o', 'pid command', '--no-headers', '--ppid', '1234'])
    expect(spawn).toHaveBeenCalledWith('ps', ['-o', 'pid command', '--no-headers', '--ppid', '1235'])
    expect(killSpy).toHaveBeenCalledWith(1235, 'SIGINT')
    expect(killSpy).toHaveBeenCalledWith(1234, 'SIGINT')
  })

  test('darwin: does not kill the root process when killRoot is false', async () => {
    vi.stubGlobal('process', {...process, platform: 'darwin'})
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    vi.mocked(spawn).mockImplementation((cmd, args) => {
      const parentPid = args ? args[args.length - 1] : ''
      if (parentPid === '1234') {
        return createMockProcess({stdoutData: '1235 child_cmd\n', exitCode: 0}) as any
      }
      return createMockProcess({stdoutData: '', exitCode: 1}) as any
    })

    await new Promise<void>((resolve) => {
      treeKill('1234', 'SIGTERM', false, (err) => {
        expect(err).toBeUndefined()
        resolve()
      })
    })

    expect(killSpy).toHaveBeenCalledWith(1235, 'SIGTERM')
    expect(killSpy).not.toHaveBeenCalledWith(1234, 'SIGTERM')
  })

  test('darwin: passes error to callback if process.kill throws a non-ESRCH error', async () => {
    vi.stubGlobal('process', {...process, platform: 'darwin'})
    const error = new Error('EPERM') as Error & {code?: string}
    error.code = 'EPERM'
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw error
    })

    vi.mocked(spawn).mockImplementation((cmd, args) => {
      const parentPid = args ? args[args.length - 1] : ''
      if (parentPid === '1234') {
        return createMockProcess({stdoutData: '1235 child_cmd\n', exitCode: 0}) as any
      }
      return createMockProcess({stdoutData: '', exitCode: 1}) as any
    })

    await new Promise<void>((resolve) => {
      treeKill('1234', 'SIGTERM', true, (err) => {
        expect(err).toBe(error)
        resolve()
      })
    })
  })

  test('darwin: ignores ESRCH errors from process.kill', async () => {
    vi.stubGlobal('process', {...process, platform: 'darwin'})
    const error = new Error('ESRCH') as Error & {code?: string}
    error.code = 'ESRCH'
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw error
    })

    vi.mocked(spawn).mockImplementation((cmd, args) => {
      const parentPid = args ? args[args.length - 1] : ''
      if (parentPid === '1234') {
        return createMockProcess({stdoutData: '1235 child_cmd\n', exitCode: 0}) as any
      }
      return createMockProcess({stdoutData: '', exitCode: 1}) as any
    })

    await new Promise<void>((resolve) => {
      treeKill('1234', 'SIGTERM', true, (err) => {
        expect(err).toBeUndefined()
        resolve()
      })
    })
  })

  test('uses default callback if none is provided', async () => {
    vi.stubGlobal('process', {...process, platform: 'win32'})
    const mockTaskkill = createMockProcess({exitCode: 1})
    vi.mocked(spawn).mockReturnValue(mockTaskkill as any)

    expect(() => treeKill('1234', 'SIGTERM', true)).not.toThrow()
  })
})
