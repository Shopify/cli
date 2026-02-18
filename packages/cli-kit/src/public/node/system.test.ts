import * as system from './system.js'
import {execa, execaCommand} from 'execa'
import {describe, expect, test, vi} from 'vitest'
import which from 'which'
import {Readable} from 'stream'

import * as fs from 'fs'

vi.mock('which')
vi.mock('execa')
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>()
  return {
    ...actual,
    fstatSync: vi.fn(),
  }
})

describe('captureOutput', () => {
  test('runs the command when it is not found in the current directory', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/command')
    vi.mocked(execa).mockResolvedValueOnce({stdout: undefined} as any)

    // When
    const got = await system.captureOutput('command', [], {cwd: '/currentDirectory'})

    // Then
    expect(got).toEqual(undefined)
  })

  test('raises an error if the command to run is found in the current directory', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/currentDirectory/command')

    // When
    const got = system.captureOutput('command', [], {cwd: '/currentDirectory'})

    // Then
    await expect(got).rejects.toThrowError('Skipped run of unsecure binary command found in the current directory.')
  })
})

describe('captureOutputWithExitCode', () => {
  test('returns stdout, stderr, and exitCode on success', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/command')
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'output', stderr: '', exitCode: 0} as any)

    // When
    const got = await system.captureOutputWithExitCode('command', [], {cwd: '/currentDirectory'})

    // Then
    expect(got).toEqual({stdout: 'output', stderr: '', exitCode: 0})
  })

  test('returns non-zero exit code without throwing', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/command')
    vi.mocked(execa).mockResolvedValueOnce({stdout: '', stderr: 'error message', exitCode: 1} as any)

    // When
    const got = await system.captureOutputWithExitCode('command', [], {cwd: '/currentDirectory'})

    // Then
    expect(got).toEqual({stdout: '', stderr: 'error message', exitCode: 1})
  })

  test('raises an error if the command to run is found in the current directory', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/currentDirectory/command')

    // When
    const got = system.captureOutputWithExitCode('command', [], {cwd: '/currentDirectory'})

    // Then
    await expect(got).rejects.toThrowError('Skipped run of unsecure binary command found in the current directory.')
  })
})

describe('captureCommandWithExitCode', () => {
  test('returns stdout, stderr, and exitCode on success', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/echo')
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'hello', stderr: '', exitCode: 0} as any)

    // When
    const got = await system.captureCommandWithExitCode('echo hello')

    // Then
    expect(got).toEqual({stdout: 'hello', stderr: '', exitCode: 0})
    expect(execa).toHaveBeenCalledWith('echo', ['hello'], expect.objectContaining({reject: false}))
  })

  test('returns non-zero exit code without throwing', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/exit')
    vi.mocked(execa).mockResolvedValueOnce({stdout: '', stderr: 'command failed', exitCode: 1} as any)

    // When
    const got = await system.captureCommandWithExitCode('exit 1')

    // Then
    expect(got).toEqual({stdout: '', stderr: 'command failed', exitCode: 1})
  })

  test('handles command with spaces in arguments (quoted strings)', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/ls')
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'found', stderr: '', exitCode: 0} as any)

    // When
    const got = await system.captureCommandWithExitCode('ls "my folder"')

    // Then
    expect(got).toEqual({stdout: 'found', stderr: '', exitCode: 0})
    // The quoted argument should be parsed into a single argument without quotes
    expect(execa).toHaveBeenCalledWith('ls', ['my folder'], expect.objectContaining({reject: false}))
  })

  test('handles shopify theme push with quoted theme name', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/shopify')
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'success', stderr: '', exitCode: 0} as any)

    // When
    const got = await system.captureCommandWithExitCode('shopify theme push --theme "My Theme Name"')

    // Then
    expect(got).toEqual({stdout: 'success', stderr: '', exitCode: 0})
    // The quoted theme name should be parsed as a single argument
    expect(execa).toHaveBeenCalledWith(
      'shopify',
      ['theme', 'push', '--theme', 'My Theme Name'],
      expect.objectContaining({reject: false}),
    )
  })

  test('handles single-quoted strings', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/echo')
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'hello world', stderr: '', exitCode: 0} as any)

    // When
    const got = await system.captureCommandWithExitCode("echo 'hello world'")

    // Then
    expect(got).toEqual({stdout: 'hello world', stderr: '', exitCode: 0})
    expect(execa).toHaveBeenCalledWith('echo', ['hello world'], expect.objectContaining({reject: false}))
  })

  test('uses provided cwd option', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/ls')
    vi.mocked(execa).mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0} as any)

    // When
    await system.captureCommandWithExitCode('ls', {cwd: '/custom/path'})

    // Then
    expect(execa).toHaveBeenCalledWith('ls', [], expect.objectContaining({cwd: '/custom/path'}))
  })

  test('merges custom env with process.env', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/env')
    vi.mocked(execa).mockResolvedValueOnce({stdout: '', stderr: '', exitCode: 0} as any)

    // When
    await system.captureCommandWithExitCode('env', {env: {MY_VAR: 'value'}})

    // Then
    expect(execa).toHaveBeenCalledWith(
      'env',
      [],
      expect.objectContaining({
        env: expect.objectContaining({MY_VAR: 'value'}),
      }),
    )
  })

  test('defaults exitCode to 0 when undefined', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/system/cmd')
    vi.mocked(execa).mockResolvedValueOnce({stdout: 'out', stderr: '', exitCode: undefined} as any)

    // When
    const got = await system.captureCommandWithExitCode('cmd')

    // Then
    expect(got.exitCode).toBe(0)
  })

  test('raises an error if the command to run is found in the current directory', async () => {
    // Given
    vi.mocked(which.sync).mockReturnValueOnce('/currentDirectory/command')

    // When
    const got = system.captureCommandWithExitCode('command', {cwd: '/currentDirectory'})

    // Then
    await expect(got).rejects.toThrowError('Skipped run of unsecure binary command found in the current directory.')
  })
})

describe('execCommand', () => {
  test('runs command successfully without throwing', async () => {
    // Given
    vi.mocked(execaCommand).mockResolvedValueOnce({} as any)

    // When/Then
    await expect(system.execCommand('echo hello')).resolves.toBeUndefined()
  })

  test('throws ExternalError on command failure', async () => {
    // Given
    const error = new Error('command not found')
    vi.mocked(execaCommand).mockRejectedValueOnce(error)

    // When/Then
    await expect(system.execCommand('nonexistent')).rejects.toThrow('command not found')
  })

  test('calls custom error handler when provided', async () => {
    // Given
    const error = new Error('custom error')
    vi.mocked(execaCommand).mockRejectedValueOnce(error)
    const customHandler = vi.fn()

    // When
    await system.execCommand('failing', {externalErrorHandler: customHandler})

    // Then
    expect(customHandler).toHaveBeenCalledWith(error)
  })

  test('handles command with spaces in arguments', async () => {
    // Given
    vi.mocked(execaCommand).mockResolvedValueOnce({} as any)

    // When
    await system.execCommand('touch "my file.txt"')

    // Then
    expect(execaCommand).toHaveBeenCalledWith('touch "my file.txt"', expect.anything())
  })

  test('uses provided cwd option', async () => {
    // Given
    vi.mocked(execaCommand).mockResolvedValueOnce({} as any)

    // When
    await system.execCommand('pwd', {cwd: '/some/dir'})

    // Then
    expect(execaCommand).toHaveBeenCalledWith('pwd', expect.objectContaining({cwd: '/some/dir'}))
  })

  test('passes stdin option to execaCommand', async () => {
    // Given
    vi.mocked(execaCommand).mockResolvedValueOnce({} as any)

    // When
    await system.execCommand('cat', {stdin: 'inherit'})

    // Then
    expect(execaCommand).toHaveBeenCalledWith('cat', expect.objectContaining({stdin: 'inherit'}))
  })
})

describe('isStdinPiped', () => {
  test('returns true when stdin is a FIFO (pipe)', () => {
    // Given
    vi.mocked(fs.fstatSync).mockReturnValue({isFIFO: () => true, isFile: () => false} as fs.Stats)

    // When
    const got = system.isStdinPiped()

    // Then
    expect(got).toBe(true)
  })

  test('returns true when stdin is a file redirect', () => {
    // Given
    vi.mocked(fs.fstatSync).mockReturnValue({isFIFO: () => false, isFile: () => true} as fs.Stats)

    // When
    const got = system.isStdinPiped()

    // Then
    expect(got).toBe(true)
  })

  test('returns false when stdin is a TTY (interactive)', () => {
    // Given
    vi.mocked(fs.fstatSync).mockReturnValue({isFIFO: () => false, isFile: () => false} as fs.Stats)

    // When
    const got = system.isStdinPiped()

    // Then
    expect(got).toBe(false)
  })

  test('returns false when fstatSync throws (e.g., CI with no stdin)', () => {
    // Given
    vi.mocked(fs.fstatSync).mockImplementation(() => {
      throw new Error('EBADF')
    })

    // When
    const got = system.isStdinPiped()

    // Then
    expect(got).toBe(false)
  })
})

describe('readStdinString', () => {
  test('returns undefined when stdin is not piped', async () => {
    // Given
    vi.mocked(fs.fstatSync).mockReturnValue({isFIFO: () => false, isFile: () => false} as fs.Stats)

    // When
    const got = await system.readStdinString()

    // Then
    expect(got).toBeUndefined()
  })

  test('returns trimmed content when stdin is piped', async () => {
    // Given
    vi.mocked(fs.fstatSync).mockReturnValue({isFIFO: () => true, isFile: () => false} as fs.Stats)
    const mockStdin = Readable.from(['  hello world  '])
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(mockStdin as unknown as typeof process.stdin)

    // When
    const got = await system.readStdinString()

    // Then
    expect(got).toBe('hello world')
  })
})
