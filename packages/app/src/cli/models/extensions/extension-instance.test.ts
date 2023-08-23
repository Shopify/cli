import {
  testApp,
  testFunctionExtension,
  testTaxCalculationExtension,
  testThemeExtensions,
  testUIExtension,
  testWebPixelExtension,
} from '../app/app.test-data.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
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

    expect(got).toEqual([
      joinPath('foo', 'src', '**', '*.js'),
      joinPath('foo', 'src', '**', '*.ts'),
      joinPath('foo', '**', '!(.)*.graphql'),
    ])
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
  test('returns true for ui extensions when using unified deploys', async () => {
    const extensionInstance = await testUIExtension()

    const got = extensionInstance.isDraftable(true)

    expect(got).toBe(true)
  })

  test('returns false for ui extensions when not using unified deploys', async () => {
    const extensionInstance = await testUIExtension()

    const got = extensionInstance.isDraftable(false)

    expect(got).toBe(false)
  })

  test('returns false for theme extensions', async () => {
    const extensionInstance = await testThemeExtensions()

    const got1 = extensionInstance.isDraftable(true)
    const got2 = extensionInstance.isDraftable(false)

    expect(got1).toBe(false)
    expect(got2).toBe(false)
  })

  test('returns false for functions when not using unified deploys', async () => {
    const extensionInstance = await testFunctionExtension()

    const got = extensionInstance.isDraftable(false)

    expect(got).toBe(false)
  })

  test('returns true for functions when using unified deploys', async () => {
    const extensionInstance = await testFunctionExtension()

    const got = extensionInstance.isDraftable(true)

    expect(got).toBe(true)
  })

  test('returns true for web pixel extensions', async () => {
    const extensionInstance = await testWebPixelExtension()

    const got = extensionInstance.isDraftable(false)

    expect(got).toBe(true)
  })
})

describe('build', async () => {
  test('creates a valid JS file for tax calculation extensions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionInstance = await testTaxCalculationExtension(tmpDir)
      const options = {
        stdout: new Writable(),
        stderr: new Writable(),
        app: testApp(),
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
