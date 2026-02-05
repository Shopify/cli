import * as system from './system.js'
import {execa} from 'execa'
import {afterEach, describe, expect, test, vi} from 'vitest'
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

describe('getWslDistroName', () => {
  test('returns the WSL_DISTRO_NAME environment variable when set', () => {
    // Given
    const originalEnv = process.env.WSL_DISTRO_NAME
    process.env.WSL_DISTRO_NAME = 'Ubuntu'

    // When
    const got = system.getWslDistroName()

    // Then
    expect(got).toBe('Ubuntu')

    // Cleanup
    process.env.WSL_DISTRO_NAME = originalEnv
  })

  test('returns undefined when WSL_DISTRO_NAME is not set', () => {
    // Given
    const originalEnv = process.env.WSL_DISTRO_NAME
    delete process.env.WSL_DISTRO_NAME

    // When
    const got = system.getWslDistroName()

    // Then
    expect(got).toBeUndefined()

    // Cleanup
    process.env.WSL_DISTRO_NAME = originalEnv
  })
})

describe('convertToWslFileUrl', () => {
  afterEach(() => {
    vi.resetModules()
  })

  test('converts path to WSL file URL when in WSL environment', async () => {
    // Given
    const originalEnv = process.env.WSL_DISTRO_NAME
    process.env.WSL_DISTRO_NAME = 'Ubuntu'

    // Reset modules and mock is-wsl module
    vi.resetModules()
    vi.doMock('is-wsl', () => ({default: true}))

    // Re-import to get fresh module with mocked dependency
    const {convertToWslFileUrl} = await import('./system.js')

    // When
    const got = await convertToWslFileUrl('/tmp/test-file.html')

    // Then
    expect(got).toBe('file://wsl.localhost/Ubuntu/tmp/test-file.html')

    // Cleanup
    process.env.WSL_DISTRO_NAME = originalEnv
  })

  test('converts home directory path to WSL file URL', async () => {
    // Given
    const originalEnv = process.env.WSL_DISTRO_NAME
    process.env.WSL_DISTRO_NAME = 'Ubuntu-22.04'

    // Reset modules and mock is-wsl module
    vi.resetModules()
    vi.doMock('is-wsl', () => ({default: true}))

    // Re-import to get fresh module with mocked dependency
    const {convertToWslFileUrl} = await import('./system.js')

    // When
    const got = await convertToWslFileUrl('/home/user/.nvm/versions/node/v20/lib/file.js')

    // Then
    expect(got).toBe('file://wsl.localhost/Ubuntu-22.04/home/user/.nvm/versions/node/v20/lib/file.js')

    // Cleanup
    process.env.WSL_DISTRO_NAME = originalEnv
  })

  test('returns standard file URL when not in WSL', async () => {
    // Given
    vi.resetModules()
    vi.doMock('is-wsl', () => ({default: false}))

    // Re-import to get fresh module with mocked dependency
    const {convertToWslFileUrl} = await import('./system.js')

    // When
    const got = await convertToWslFileUrl('/tmp/test-file.html')

    // Then
    expect(got).toBe('file:///tmp/test-file.html')
  })

  test('returns standard file URL when WSL_DISTRO_NAME is not set', async () => {
    // Given
    const originalEnv = process.env.WSL_DISTRO_NAME
    delete process.env.WSL_DISTRO_NAME

    // Reset modules and mock is-wsl to return true, but distro name is not set
    vi.resetModules()
    vi.doMock('is-wsl', () => ({default: true}))

    // Re-import to get fresh module with mocked dependency
    const {convertToWslFileUrl} = await import('./system.js')

    // When
    const got = await convertToWslFileUrl('/tmp/test-file.html')

    // Then
    expect(got).toBe('file:///tmp/test-file.html')

    // Cleanup
    process.env.WSL_DISTRO_NAME = originalEnv
  })
})
