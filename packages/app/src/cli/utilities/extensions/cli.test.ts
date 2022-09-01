import {runGoExtensionsCLI, nodeExtensionsCLIPath} from './cli.js'
import {getBinaryPathOrDownload} from './binary.js'
import {describe, test, expect, vi, beforeAll} from 'vitest'
import {system, environment, path} from '@shopify/cli-kit'
import {platform} from 'node:os'
import {Writable} from 'stream'

vi.mock('../../environment')
vi.mock('./binary.js')
vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    system: {
      exec: vi.fn(),
    },
    environment: {
      local: {
        homeDirectory: vi.fn(),
        isDevelopment: vi.fn(),
        isDebugGoBinary: vi.fn(),
      },
    },
    path: {
      ...cliKit.path,
      findUp: vi.fn(),
    },
  }
})

let extensionsBinaryExtension: string | undefined

beforeAll(() => {
  extensionsBinaryExtension = platform() === 'win32' ? '.exe' : ''
})

describe('runGoExtensionsCLI', () => {
  test('runs the CLI through local sources without debug when running it locally', async () => {
    // Given
    const extensionsGoCliDirectory = '/path/to/go/directory'
    vi.mocked(environment.local.isDevelopment).mockReturnValue(true)
    vi.mocked(environment.local.isDebugGoBinary).mockReturnValue(false)
    vi.mocked(path.findUp).mockResolvedValue(extensionsGoCliDirectory)

    // When
    const stdout: any = {write: vi.fn()}
    await runGoExtensionsCLI(['build'], {stdout})

    // Then
    expect(system.exec).toHaveBeenNthCalledWith(
      1,
      path.join(extensionsGoCliDirectory, `shopify-extensions${extensionsBinaryExtension}`),
      ['build'],
      {
        stdout: expect.any(Writable),
      },
    )
  })

  test('runs the CLI through local sources with debug when running it locally', async () => {
    // Given
    const extensionsGoCliDirectory = '/path/to/go/directory'
    vi.mocked(environment.local.isDevelopment).mockReturnValue(true)
    vi.mocked(environment.local.isDebugGoBinary).mockReturnValue(true)
    vi.mocked(path.findUp).mockResolvedValue(extensionsGoCliDirectory)

    // When
    const stdout: any = {write: vi.fn()}
    await runGoExtensionsCLI(['build'], {stdout})

    // Then
    expect(system.exec).toHaveBeenNthCalledWith(
      1,
      'sh',
      [path.join(extensionsGoCliDirectory, 'init-debug-session'), 'build'],
      {
        stdout: expect.any(Writable),
      },
    )
  })

  test('runs the CLI through the downloaded binary when not running it locally', async () => {
    // Given
    const binaryPath = '/path/to/binary'
    vi.mocked(getBinaryPathOrDownload).mockResolvedValue(binaryPath)
    vi.mocked(environment.local.isDevelopment).mockReturnValue(false)

    // When
    const got = await runGoExtensionsCLI(['build'])

    // Then
    expect(system.exec).toHaveBeenCalledWith(binaryPath, ['build'], {})
  })
})

describe('nodeExtensionsCLIPath', () => {
  test('returns the path when running it locally', async () => {
    // Given
    const extensionsGoCliExecutable = '/path/to/go/executable'
    vi.mocked(environment.local.isDevelopment).mockReturnValue(false)
    vi.mocked(path.findUp).mockResolvedValue(extensionsGoCliExecutable)

    // When
    const got = await nodeExtensionsCLIPath()

    // Then
    expect(got).not.toBeUndefined()
  })

  test('returns the path when not running it locally', async () => {
    // Given
    const extensionsGoCliDirectory = '/path/to/go/directory'
    vi.mocked(environment.local.isDevelopment).mockReturnValue(true)
    vi.mocked(path.findUp).mockResolvedValue(extensionsGoCliDirectory)

    // When
    const got = await nodeExtensionsCLIPath()

    // Then
    expect(got).not.toBeUndefined()
  })
})
