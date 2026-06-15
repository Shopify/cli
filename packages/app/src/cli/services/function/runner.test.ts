import {runFunction} from './runner.js'
import {functionRunnerBinary, downloadBinary} from './binaries.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {describe, test, vi, expect} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Readable, Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('./binaries.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./binaries.js')>()
  return {
    ...original,
    downloadBinary: vi.fn().mockResolvedValue(undefined),
  }
})

describe('runFunction', () => {
  test('downloads binary', async () => {
    // Given
    const functionExtension = await testFunctionExtension()

    // When
    await runFunction({functionExtension})

    // Then
    expect(downloadBinary).toHaveBeenCalledOnce()
  })

  test('runs function with options', async () => {
    // Given
    vi.mocked(exec).mockResolvedValue()
    const functionExtension = await testFunctionExtension()
    const options = {
      functionExtension,
      inputPath: 'inputPath',
      input: 'input',
      export: 'export',
      json: true,
      stdin: new Readable(),
      stdout: new Writable(),
      stderr: new Writable(),
      schemaPath: 'schemaPath',
      queryPath: 'src/queryPath',
    }

    // When
    await runFunction(options)

    // Then
    expect(exec).toHaveBeenCalledWith(
      functionRunnerBinary().path,
      [
        '-f',
        functionExtension.outputPath,
        '--input',
        options.inputPath,
        '--export',
        options.export,
        '--json',
        '--schema-path',
        options.schemaPath,
        '--query-path',
        options.queryPath,
      ],
      {
        cwd: functionExtension.directory,
        stdin: options.stdin,
        stdout: options.stdout,
        stderr: options.stderr,
        input: options.input,
      },
    )
  })

  test('uses build.path when configured', async () => {
    // Given
    vi.mocked(exec).mockResolvedValue()
    const functionExtension = await testFunctionExtension()
    functionExtension.configuration.build!.path = 'dist/custom.wasm'

    // When
    await runFunction({functionExtension})

    // Then
    expect(exec).toHaveBeenCalledWith(
      functionRunnerBinary().path,
      ['-f', joinPath(functionExtension.directory, 'dist/custom.wasm')],
      expect.objectContaining({cwd: functionExtension.directory}),
    )
  })
})
