import {testApp, testFunctionExtension, testTaxCalculationExtension} from '../app/app.test-data.js'
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
