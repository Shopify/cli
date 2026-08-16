import {runFunction} from './runner.js'
import {functionRunnerBinary, downloadBinary} from './binaries.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {describe, test, vi, expect} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {Readable, Writable} from 'stream'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/ui')
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
      profile: true,
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
        '--profile',
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

  test('warns when profiling a non-JavaScript function without function names', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const functionExtension = await testFunctionExtension({dir: tmpDir})
      await mkdir(dirname(functionExtension.outputPath))
      await writeFile(functionExtension.outputPath, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]))

      // When
      await runFunction({functionExtension, profile: true})

      // Then
      expect(renderWarning).toHaveBeenCalledWith({
        headline: "The profile won't contain names for your function.",
        body: [
          "The built WebAssembly module doesn't contain a function name section. The default wasm-opt step removes this section, and the function compiler can also omit it. To preserve function names, set ",
          {userInput: 'wasm_opt = false'},
          ' under ',
          {userInput: '[extensions.build]'},
          ' in shopify.extension.toml, configure the compiler to emit function names, and rebuild the function.',
        ],
      })
    })
  })

  test('warns that JavaScript function names are unavailable regardless of wasm-opt', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const functionExtension = await testFunctionExtension({
        dir: tmpDir,
        entryPath: joinPath(tmpDir, 'src/index.ts'),
      })
      const shopifyFunctionDirectory = joinPath(tmpDir, 'node_modules/@shopify/shopify_function')
      await mkdir(shopifyFunctionDirectory)
      await writeFile(joinPath(shopifyFunctionDirectory, 'package.json'), JSON.stringify({version: '2.0.0'}))
      await mkdir(dirname(functionExtension.outputPath))
      await writeFile(functionExtension.outputPath, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]))

      // When
      await runFunction({functionExtension, profile: true})

      // Then
      expect(renderWarning).toHaveBeenCalledWith({
        headline: "The profile won't contain names for your function.",
        body: "JavaScript functions built with Javy don't include a WebAssembly function name section, regardless of the wasm_opt setting. Function names will appear as <unknown> in the profile.",
      })
    })
  })

  test('does not warn when profiling a function with function names', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const functionExtension = await testFunctionExtension({dir: tmpDir})
      await mkdir(dirname(functionExtension.outputPath))
      // This is the binary form of `(module (func $test))`, including its optional name section.
      const moduleWithNamedFunction = Buffer.from([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03, 0x02, 0x01, 0x00,
        0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b, 0x00, 0x0e, 0x04, 0x6e, 0x61, 0x6d, 0x65, 0x01, 0x07, 0x01, 0x00, 0x04,
        0x74, 0x65, 0x73, 0x74,
      ])
      await writeFile(functionExtension.outputPath, moduleWithNamedFunction)

      // When
      await runFunction({functionExtension, profile: true})

      // Then
      expect(renderWarning).not.toHaveBeenCalled()
    })
  })

  test('runs the function when inspecting function names fails', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const functionExtension = await testFunctionExtension({dir: tmpDir})
      await mkdir(dirname(functionExtension.outputPath))
      await writeFile(functionExtension.outputPath, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]))
      vi.spyOn(WebAssembly, 'validate').mockImplementationOnce(() => {
        throw new Error('Could not inspect module')
      })

      // When
      await runFunction({functionExtension, profile: true})

      // Then
      expect(exec).toHaveBeenCalled()
      expect(renderWarning).not.toHaveBeenCalled()
    })
  })
})
