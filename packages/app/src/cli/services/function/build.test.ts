import {buildGraphqlTypes, bundleExtension, runFunctionRunner, runJavy, ExportJavyBuilder, jsExports} from './build.js'
import {testApp, testFunctionExtension} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {build as esBuild} from 'esbuild'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('esbuild', async () => {
  const esbuild: any = await vi.importActual('esbuild')
  return {
    ...esbuild,
    build: vi.fn(),
  }
})

let stdout: any
let stderr: any
let signal: any

const app = testApp({dotenv: {variables: {VAR_FROM_ENV_FILE: 'env_file_var'}, path: ''}})

beforeEach(async () => {
  stderr = {write: vi.fn()}
  stdout = {write: vi.fn()}
  signal = vi.fn()
})

describe('buildGraphqlTypes', () => {
  test('generate types', async () => {
    // Given
    const ourFunction = await testFunctionExtension({entryPath: 'src/index.js'})

    // When
    const got = buildGraphqlTypes(ourFunction, {stdout, stderr, signal, app})

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith('npm', ['exec', '--', 'graphql-code-generator', '--config', 'package.json'], {
      cwd: ourFunction.directory,
      stderr,
      signal,
    })
  })

  test('errors if function is not a JS function', async () => {
    // Given
    const ourFunction = await testFunctionExtension()
    ourFunction.entrySourceFilePath = 'src/main.rs'

    // When
    const got = buildGraphqlTypes(ourFunction, {stdout, stderr, signal, app})

    // Then
    await expect(got).rejects.toThrow(/GraphQL types can only be built for JavaScript functions/)
  })
})

async function installShopifyLibrary(tmpDir: string) {
  const shopifyFunctionDir = joinPath(tmpDir, 'node_modules/@shopify/shopify_function')
  const shopifyFunction = joinPath(shopifyFunctionDir, 'index.ts')
  await mkdir(shopifyFunctionDir)
  await writeFile(shopifyFunction, '')
  return shopifyFunction
}

describe('bundleExtension', () => {
  test('bundles extension using esbuild', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const ourFunction = await testFunctionExtension({dir: tmpDir})
      ourFunction.entrySourceFilePath = joinPath(tmpDir, 'src/index.ts')
      const shopifyFunction = await installShopifyLibrary(tmpDir)

      // When
      const got = bundleExtension(
        ourFunction,
        {stdout, stderr, signal, app},
        {VAR_FROM_RUNTIME: 'runtime_var', 'INVALID_(VAR)': 'invalid_var'},
      )

      // Then
      await expect(got).resolves.toBeUndefined()
      expect(esBuild).toHaveBeenCalledWith({
        outfile: joinPath(tmpDir, 'dist/function.js'),
        define: {
          'process.env.VAR_FROM_RUNTIME': JSON.stringify('runtime_var'),
          'process.env.VAR_FROM_ENV_FILE': JSON.stringify('env_file_var'),
        },
        entryPoints: [shopifyFunction],
        alias: {
          'user-function': joinPath(tmpDir, 'src/index.ts'),
        },
        logLevel: 'silent',
        bundle: true,
        legalComments: 'none',
        target: 'es2022',
        format: 'esm',
      })
    })
  })

  test('errors if shopify library is not found', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const ourFunction = await testFunctionExtension({dir: tmpDir})
      ourFunction.entrySourceFilePath = joinPath(tmpDir, 'src/index.ts')

      // When
      const got = bundleExtension(ourFunction, {stdout, stderr, signal, app})

      // Then
      await expect(got).rejects.toThrow(/Could not find the Shopify Function runtime/)
    })
  })

  test('errors if user function not found', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const ourFunction = await testFunctionExtension({dir: tmpDir})
      await installShopifyLibrary(tmpDir)

      // When
      const got = bundleExtension(ourFunction, {stdout, stderr, signal, app})

      // Then
      await expect(got).rejects.toThrow(/Could not find your function entry point./)
    })
  })
})

describe('runJavy', () => {
  test('runs javy to compile JS into Wasm', async () => {
    // Given
    const ourFunction = await testFunctionExtension()

    // When
    const got = runJavy(ourFunction, {stdout, stderr, signal, app})

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith(
      'npm',
      [
        'exec',
        '--',
        'javy-cli',
        'compile',
        '-d',
        '-o',
        joinPath(ourFunction.directory, 'dist/index.wasm'),
        'dist/function.js',
      ],
      {
        cwd: ourFunction.directory,
        stderr: 'inherit',
        stdout: 'inherit',
        signal,
      },
    )
  })
})

describe('runFunctionRunner', () => {
  test('calls function runner to execute function locally', async () => {
    // Given
    const ourFunction = await testFunctionExtension()

    // When
    const got = runFunctionRunner(ourFunction, {json: false})

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith(
      'npm',
      ['exec', '--', 'function-runner', '-f', joinPath(ourFunction.directory, 'dist/index.wasm')],
      {
        cwd: ourFunction.directory,
        stderr: 'inherit',
        stdin: 'inherit',
        stdout: 'inherit',
      },
    )
  })

  test('calls function runner to execute function locally and return json', async () => {
    // Given
    const ourFunction = await testFunctionExtension()

    // When
    const got = runFunctionRunner(ourFunction, {json: true})

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith(
      'npm',
      ['exec', '--', 'function-runner', '-f', joinPath(ourFunction.directory, 'dist/index.wasm'), '--json'],
      {
        cwd: ourFunction.directory,
        stderr: 'inherit',
        stdin: 'inherit',
        stdout: 'inherit',
      },
    )
  })

  test('it supports receiving an input on the command line', async () => {
    // Given
    const ourFunction = await testFunctionExtension()

    // When
    const got = runFunctionRunner(ourFunction, {input: 'input.json', json: false})

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith(
      'npm',
      [
        'exec',
        '--',
        'function-runner',
        '-f',
        joinPath(ourFunction.directory, 'dist/index.wasm'),
        '--input',
        'input.json',
      ],
      {
        cwd: ourFunction.directory,
        stderr: 'inherit',
        stdin: 'inherit',
        stdout: 'inherit',
      },
    )
  })

  test('calls function runner to execute function locally with wasm export name', async () => {
    // Given
    const ourFunction = await testFunctionExtension()

    // When
    const got = runFunctionRunner(ourFunction, {json: false, export: 'foo'})

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith(
      'npm',
      ['exec', '--', 'function-runner', '-f', joinPath(ourFunction.directory, 'dist/index.wasm'), '--export', 'foo'],
      {
        cwd: ourFunction.directory,
        stderr: 'inherit',
        stdin: 'inherit',
        stdout: 'inherit',
      },
    )
  })
})

describe('ExportJavyBuilder', () => {
  const exports = ['foo-bar', 'foo-baz']
  const builder = new ExportJavyBuilder(exports)

  describe('bundle', () => {
    test('bundles extension with esbuild', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const ourFunction = await testFunctionExtension({dir: tmpDir})
        ourFunction.entrySourceFilePath = joinPath(tmpDir, 'src/index.ts')

        // When
        const got = builder.bundle(
          ourFunction,
          {stdout, stderr, signal, app},
          {VAR_FROM_RUNTIME: 'runtime_var', 'INVALID_(VAR)': 'invalid_var'},
        )

        // Then
        await expect(got).resolves.toBeUndefined()
        expect(esBuild).toHaveBeenCalledWith({
          outfile: joinPath(tmpDir, 'dist/function.js'),
          define: {
            'process.env.VAR_FROM_RUNTIME': JSON.stringify('runtime_var'),
            'process.env.VAR_FROM_ENV_FILE': JSON.stringify('env_file_var'),
          },
          stdin: {
            contents: builder.entrypointContents,
            loader: 'ts',
            resolveDir: tmpDir,
          },
          alias: {
            'user-function': joinPath(tmpDir, 'src/index.ts'),
          },
          logLevel: 'silent',
          bundle: true,
          legalComments: 'none',
          target: 'es2022',
          format: 'esm',
        })
      })
    })

    test('errors if user function not found', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const ourFunction = await testFunctionExtension({dir: tmpDir})

        // When
        const got = builder.bundle(ourFunction, {stdout, stderr, signal, app})

        // Then
        await expect(got).rejects.toThrow(/Could not find your function entry point./)
      })
    })
  })

  describe('compile', () => {
    test('runs javy with wit', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const ourFunction = await testFunctionExtension()

        // When
        const got = builder.compile(ourFunction, {stdout, stderr, signal, app})

        // Then
        await expect(got).resolves.toBeUndefined()
        expect(exec).toHaveBeenCalledWith(
          'npm',
          [
            'exec',
            '--',
            'javy-cli',
            'compile',
            '-d',
            '-o',
            joinPath(ourFunction.directory, 'dist/index.wasm'),
            'dist/function.js',
            '--wit',
            expect.stringContaining('javy-world.wit'),
            '-n',
            'shopify-function',
          ],
          {
            cwd: ourFunction.directory,
            stderr: 'inherit',
            stdout: 'inherit',
            signal,
          },
        )
      })
    })
  })

  test('wit', () => {
    // When
    const got = builder.wit

    // Then
    expect(got).toContain('package function:impl;')
    expect(got).toContain('world shopify-function')
    expect(got).toContain('export %foo-bar: func();')
    expect(got).toContain('export %foo-baz: func();')
  })

  test('entrypointContents', () => {
    // When
    const got = builder.entrypointContents

    // Then
    expect(got).toContain('import __runFunction from "@shopify/shopify_function/run"')
    expect(got).toContain('import { fooBar as runFooBar } from "user-function"')
    expect(got).toContain('export function fooBar() { return __runFunction(runFooBar) }')
    expect(got).toContain('import { fooBaz as runFooBaz } from "user-function"')
    expect(got).toContain('export function fooBaz() { return __runFunction(runFooBaz) }')
  })
})

describe('jsExports', () => {
  test('is empty when function does not have targets', async () => {
    // Given
    const ourFunction = await testFunctionExtension()
    ourFunction.configuration.targeting = undefined

    // When
    const got = jsExports(ourFunction)

    // Then
    expect(got).toEqual([])
  })

  test('is empty when single target export is undefined', async () => {
    // Given
    const ourFunction = await testFunctionExtension()
    ourFunction.configuration.targeting = [{target: 'foo.bar'}]

    // When
    const got = jsExports(ourFunction)

    // Then
    expect(got).toEqual([])
  })

  test('returns the exports when all target exports are defined', async () => {
    // Given
    const ourFunction = await testFunctionExtension()
    ourFunction.configuration.targeting = [
      {target: 'foo.bar', export: 'foo-bar'},
      {target: 'foo.baz', export: 'foo-baz'},
    ]

    // When
    const got = jsExports(ourFunction)

    // Then
    expect(got).toEqual(['foo-bar', 'foo-baz'])
  })

  test('errors when multiple targets present without explicit exports', async () => {
    // Given
    const ourFunction = await testFunctionExtension()
    ourFunction.configuration.targeting = [
      {target: 'foo.bar', export: 'foo-bar'},
      {target: 'foo.baz'},
      {target: 'foo.biz'},
    ]

    // When & Then
    expect(() => {
      jsExports(ourFunction)
    }).toThrow(/Can't infer export name for targets:\n- 'foo\.baz'\n- 'foo\.biz'/)
  })

  test('errors when exports are not kebab-case', async () => {
    // Given
    const ourFunction = await testFunctionExtension()
    ourFunction.configuration.targeting = [
      {target: 'foo.bar', export: 'fooBar'},
      {target: 'foo.baz', export: 'foo*baz'},
    ]

    // When & Then
    expect(() => {
      jsExports(ourFunction)
    }).toThrow(/Invalid export names: 'fooBar', 'foo\*baz'[.\n]*The TOML's exports must be kebab-case/)
  })
})
