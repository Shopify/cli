import {runGoExtensionsCLI, nodeExtensionsCLIPath, goLogWritable} from './cli.js'
import {getBinaryPathOrDownload} from './binary.js'
import {describe, test, expect, vi, beforeAll} from 'vitest'
import {system, environment, path} from '@shopify/cli-kit'
import {platform} from 'node:os'
import {Writable} from 'stream'
import {stdout} from 'node:process'

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
        stdout,
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
        stdout,
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

describe('goLogsParser', () => {
  test('parses correctly the json logs', async () => {
    // Given
    const validJsonLog =
      '{"extensionId":"test_id","workflowStep":"serve.build","payload":{"message":"test message"}, "status":"succeed", "level":"info"}###LOG_END###'
    const parsedStream: Writable = goLogWritable(stdout)

    // When
    parsedStream.write(validJsonLog)
    const result = await streamToString(parsedStream)
    // eslint-disable-next-line no-console
    console.log('## Succeed ##')
    expect(result).toBe('test message')
  })
  test('fails to parse the json logs and keeps the log as it is', async () => {
    // Given
    const inValidJsonLog = 'basic simple log'
    const parsedStream: Writable = goLogWritable(stdout)
    const result = streamToString(parsedStream).then((result) => {
      expect(result).toBe(inValidJsonLog)
    })
    // When
    parsedStream.write(`${inValidJsonLog}###LOG_END###`)
  })
})

function streamToString(stream: Writable) {
  const chunks: any[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk))
      stream.end()
    })
    stream.on('error', (err) => reject(err))
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}
