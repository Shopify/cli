import {
  testApp,
  testFunctionExtension,
  testTaxCalculationExtension,
  testThemeExtensions,
  testUIExtension,
  testWebPixelExtension,
} from '../app/app.test-data.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {ExtensionBuildOptions} from '../../services/build/extension.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {Writable} from 'stream'

function functionConfiguration(): FunctionConfigType {
  return {
    name: 'foo',
    type: 'function',
    api_version: '2023-07',
    configuration_ui: true,
    metafields: [],
    build: {},
  }
}

describe('watchPaths', async () => {
  test('returns an array for a single path', async () => {
    const config = functionConfiguration()
    config.build = {
      watch: 'src/single-path.foo',
    }
    const extensionInstance = await testFunctionExtension({
      config,
      dir: 'foo',
    })

    const got = extensionInstance.watchPaths

    expect(got).toEqual([joinPath('foo', 'src', 'single-path.foo'), joinPath('foo', '**', '!(.)*.graphql')])
  })

  test('returns default paths for javascript', async () => {
    const config = functionConfiguration()
    config.build = {}
    const extensionInstance = await testFunctionExtension({
      config,
      entryPath: 'src/index.js',
      dir: 'foo',
    })

    const got = extensionInstance.watchPaths

    expect(got).toEqual([joinPath('foo', 'src', '**', '*.{js,ts}'), joinPath('foo', '**', '!(.)*.graphql')])
  })

  test('returns js and ts paths for esbuild extensions', async () => {
    const extensionInstance = await testUIExtension({directory: 'foo'})

    const got = extensionInstance.watchPaths

    expect(got).toEqual([joinPath('foo', '**', '*.{ts,tsx,js,jsx}')])
  })

  test('return empty array for non-function non-esbuild extensions', async () => {
    const extensionInstance = await testTaxCalculationExtension('foo')

    const got = extensionInstance.watchPaths

    expect(got).toEqual([])
  })

  test('returns configured paths and input query', async () => {
    const config = functionConfiguration()
    config.build = {
      watch: ['src/**/*.rs', 'src/**/*.foo'],
    }
    const extensionInstance = await testFunctionExtension({
      config,
      dir: 'foo',
    })

    const got = extensionInstance.watchPaths

    expect(got).toEqual([
      joinPath('foo', 'src/**/*.rs'),
      joinPath('foo', 'src/**/*.foo'),
      joinPath('foo', '**', '!(.)*.graphql'),
    ])
  })

  test('returns null if not javascript and not configured', async () => {
    const config = functionConfiguration()
    config.build = {}
    const extensionInstance = await testFunctionExtension({
      config,
    })

    const got = extensionInstance.watchPaths

    expect(got).toBeNull()
  })
})

describe('isDraftable', () => {
  test('returns false for theme extensions', async () => {
    const extensionInstance = await testThemeExtensions()

    const got1 = extensionInstance.isDraftable()

    expect(got1).toBe(false)
  })

  test('returns true for web pixel extensions', async () => {
    const extensionInstance = await testWebPixelExtension()

    const got = extensionInstance.isDraftable()

    expect(got).toBe(true)
  })

  test('returns true for ui extensions', async () => {
    const extensionInstance = await testUIExtension()

    const got = extensionInstance.isDraftable()

    expect(got).toBe(true)
  })

  test('returns true for functions', async () => {
    const extensionInstance = await testFunctionExtension()

    const got = extensionInstance.isDraftable()

    expect(got).toBe(true)
  })
})

describe('build', async () => {
  test('creates a valid JS file for tax calculation extensions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionInstance = await testTaxCalculationExtension(tmpDir)
      const options: ExtensionBuildOptions = {
        stdout: new Writable(),
        stderr: new Writable(),
        app: testApp(),
        environment: 'production',
      }

      const outputFilePath = joinPath(tmpDir, `dist/${extensionInstance.outputFileName}`)

      // When
      await extensionInstance.build(options)

      // Then
      const outputFileContent = await readFile(outputFilePath)
      expect(outputFileContent).toEqual('(()=>{})();')
    })
  })
})
