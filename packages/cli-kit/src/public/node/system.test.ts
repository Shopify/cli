import * as system from './system.js'
import {execa} from 'execa'
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

describe('convertWslPath', () => {
  test('converts Linux path to Windows path successfully', async () => {
    // Given
    const linuxPath = '/tmp/speedscope-123.html'
    const windowsPath = 'C:\\Users\\developer\\AppData\\Local\\Temp\\speedscope-123.html'
    vi.mocked(which.sync).mockReturnValueOnce('/usr/bin/wslpath')
    vi.mocked(execa).mockResolvedValueOnce({stdout: windowsPath + '\n'} as any)

    // When
    const result = await system.convertWslPath(linuxPath)

    // Then
    expect(result).toBe(windowsPath)
    expect(execa).toHaveBeenCalledWith('wslpath', ['-w', linuxPath], expect.any(Object))
  })

  test('returns original path if wslpath command fails', async () => {
    // Given
    const linuxPath = '/tmp/speedscope-123.html'
    vi.mocked(which.sync).mockReturnValueOnce('/usr/bin/wslpath')
    vi.mocked(execa).mockRejectedValueOnce(new Error('wslpath not found'))

    // When
    const result = await system.convertWslPath(linuxPath)

    // Then
    expect(result).toBe(linuxPath)
  })

  test('trims whitespace from wslpath output', async () => {
    // Given
    const linuxPath = '/tmp/file.html'
    const windowsPath = 'C:\\Temp\\file.html'
    vi.mocked(which.sync).mockReturnValueOnce('/usr/bin/wslpath')
    vi.mocked(execa).mockResolvedValueOnce({stdout: `  ${windowsPath}  \n`} as any)

    // When
    const result = await system.convertWslPath(linuxPath)

    // Then
    expect(result).toBe(windowsPath)
  })
})
