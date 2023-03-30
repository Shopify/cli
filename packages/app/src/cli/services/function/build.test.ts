import {buildGraphqlTypes, bundleExtension, runFunctionRunner, runJavy} from './build.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
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

beforeEach(async () => {
  stderr = {write: vi.fn()}
  stdout = {write: vi.fn()}
  signal = vi.fn()
})

describe('buildGraphqlTypes', () => {
  test('generate types', async () => {
    // Given
    const ourFunction = await testFunctionExtension()
    ourFunction.entrySourceFilePath = 'src/index.js'

    // When
    const got = buildGraphqlTypes(ourFunction, {stdout, stderr, signal})

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
    const got = buildGraphqlTypes(ourFunction, {stdout, stderr, signal})

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
      const got = bundleExtension(ourFunction, {stdout, stderr, signal})

      // Then
      await expect(got).resolves.toBeUndefined()
      expect(esBuild).toHaveBeenCalledWith({
        outfile: joinPath(tmpDir, 'dist/function.js'),
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
      const got = bundleExtension(ourFunction, {stdout, stderr, signal})

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
      const got = bundleExtension(ourFunction, {stdout, stderr, signal})

      // Then
      await expect(got).rejects.toThrow(/Could not find your function entry point./)
    })
  })
})

describe('runJavy', () => {
  test('runs javy to compile JS into WASM', async () => {
    // Given
    const ourFunction = await testFunctionExtension()

    // When
    const got = runJavy(ourFunction, {stdout, stderr, signal})

    // Then
    await expect(got).resolves.toBeUndefined()
    expect(exec).toHaveBeenCalledWith(
      'npm',
      [
        'exec',
        '--',
        'javy',
        'compile',
        '-d',
        '-o',
        joinPath(ourFunction.directory, 'dist/index.wasm'),
        'dist/function.js',
      ],
      {
        cwd: ourFunction.directory,
        stderr,
        stdout,
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
})
