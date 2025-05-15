import {
  buildGraphqlTypes,
  bundleExtension,
  runJavy,
  ExportJavyBuilder,
  jsExports,
  runWasmOpt,
  runTrampoline,
  buildJSFunction,
} from './build.js'
import {
  javyBinary,
  javyPluginBinary,
  wasmOptBinary,
  trampolineBinary,
  PREFERRED_FUNCTION_RUNNER_VERSION,
  PREFERRED_JAVY_VERSION,
  PREFERRED_JAVY_PLUGIN_VERSION,
} from './binaries.js'
import {testApp, testFunctionExtension} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {exec} from '@shopify/cli-kit/node/system'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {inTemporaryDirectory, mkdir, writeFile, removeFile} from '@shopify/cli-kit/node/fs'
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

const derivedDeps = {
  functionRunner: PREFERRED_FUNCTION_RUNNER_VERSION,
  javy: PREFERRED_JAVY_VERSION,
  javyPlugin: PREFERRED_JAVY_PLUGIN_VERSION,
}

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

  const runModule = joinPath(shopifyFunctionDir, 'run.ts')
  await writeFile(runModule, '')

  const packageJson = joinPath(shopifyFunctionDir, 'package.json')
  await writeFile(packageJson, JSON.stringify({version: '1.0.0'}))

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
        {
          VAR_FROM_RUNTIME: 'runtime_var',
          'INVALID_(VAR)': 'invalid_var',
        },
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
      await expect(got).rejects.toThrow(/Could not find the Shopify Functions JavaScript library/)
    })
  })

  test('errors if shopify library lacks the run module', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const ourFunction = await testFunctionExtension({dir: tmpDir})
      ourFunction.entrySourceFilePath = joinPath(tmpDir, 'src/index.ts')
      const shopifyFunction = await installShopifyLibrary(tmpDir)
      await removeFile(joinPath(shopifyFunction, '..', 'run.ts'))

      // When
      const got = bundleExtension(ourFunction, {stdout, stderr, signal, app})

      // Then
      await expect(got).rejects.toThrow(/Could not find the Shopify Functions JavaScript library/)
    })
  })

  test('errors if shopify function library is not on a compatible version when building a JS function', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const incompatibleVersion = '999.0.0'
      const ourFunction = await testFunctionExtension({dir: tmpDir})
      ourFunction.entrySourceFilePath = joinPath(tmpDir, 'src/index.ts')
      await installShopifyLibrary(tmpDir)
      await writeFile(
        joinPath(tmpDir, 'node_modules/@shopify/shopify_function/package.json'),
        JSON.stringify({version: incompatibleVersion}),
      )

      // When
      const got = buildJSFunction(ourFunction, {stdout, stderr, signal, app})

      // Then
      await expect(got).rejects.toThrow(
        /The installed version of the Shopify Functions JavaScript library is not compatible with this version of Shopify CLI./,
      )
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
  test('runs javy to compile JS into Wasm', {timeout: 20000}, async () => {
    // Given
    const ourFunction = await testFunctionExtension()

    // When
    const got = runJavy(ourFunction, {stdout, stderr, signal, app}, derivedDeps)

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith(
      javyBinary(derivedDeps.javy).path,
      [
        'build',
        '-C',
        'dynamic',
        '-C',
        `plugin=${javyPluginBinary(derivedDeps.javyPlugin).path}`,
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

describe('runWasmOpt', () => {
  test('runs wasm-opt on the module', async () => {
    // Given
    const ourFunction = await testFunctionExtension()
    const modulePath = ourFunction.outputPath

    // When
    const got = runWasmOpt(modulePath)

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith(
      'node',
      [
        wasmOptBinary().name,
        modulePath,
        '-Oz',
        '--enable-bulk-memory',
        '--enable-multimemory',
        '--strip-debug',
        '-o',
        modulePath,
      ],
      {
        cwd: dirname(wasmOptBinary().path),
      },
    )
  })
})

describe('runTrampoline', () => {
  test('runs trampoline on the module', async () => {
    // Given
    const ourFunction = await testFunctionExtension()
    const modulePath = ourFunction.outputPath

    // When
    const got = runTrampoline(modulePath)

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith(trampolineBinary().path, ['-i', modulePath, '-o', modulePath])
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
        const shopifyFunction = await installShopifyLibrary(tmpDir)

        // When
        const got = builder.bundle(
          ourFunction,
          {stdout, stderr, signal, app},
          {
            VAR_FROM_RUNTIME: 'runtime_var',
            'INVALID_(VAR)': 'invalid_var',
          },
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
        const shopifyFunction = await installShopifyLibrary(tmpDir)

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
        const got = builder.compile(ourFunction, {stdout, stderr, signal, app}, derivedDeps)

        // Then
        await expect(got).resolves.toBeUndefined()

        expect(exec).toHaveBeenCalledWith(
          javyBinary(derivedDeps.javy).path,
          [
            'build',
            '-C',
            'dynamic',
            '-C',
            `plugin=${javyPluginBinary(derivedDeps.javyPlugin).path}`,
            '-C',
            expect.stringContaining('wit='),
            '-C',
            'wit-world=shopify-function',
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
