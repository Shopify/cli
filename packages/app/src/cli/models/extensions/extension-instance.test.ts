import {SingleWebhookSubscriptionType} from './specifications/app_config_webhook_schemas/webhooks_schema.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from './schemas.js'
import {
  testApp,
  testAppConfigExtensions,
  testFunctionExtension,
  testTaxCalculationExtension,
  testThemeExtensions,
  testPaymentExtensions,
  testUIExtension,
  testFlowActionExtension,
  testDeveloperPlatformClient,
  testSingleWebhookSubscriptionExtension,
  placeholderAppConfiguration,
} from '../app/app.test-data.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {ExtensionBuildOptions} from '../../services/build/extension.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, readFile, mkdir, writeFile, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {slugify} from '@shopify/cli-kit/common/string'
import {hashString, nonRandomUUID} from '@shopify/cli-kit/node/crypto'
import {Writable} from 'stream'

const developerPlatformClient: DeveloperPlatformClient = testDeveloperPlatformClient()

function functionConfiguration(): FunctionConfigType {
  return {
    name: 'foo',
    type: 'function',
    api_version: '2023-07',
    configuration_ui: true,
    build: {
      wasm_opt: true,
    },
  }
}

describe('watchPaths', async () => {
  test('returns an array for a single path', async () => {
    const config = functionConfiguration()
    config.build = {
      watch: 'src/single-path.foo',
      wasm_opt: true,
    }
    const extensionInstance = await testFunctionExtension({
      config,
      dir: 'foo',
    })

    const got = extensionInstance.watchBuildPaths

    expect(got).toEqual([joinPath('foo', 'src', 'single-path.foo'), joinPath('foo', '**', '!(.)*.graphql')])
  })

  test('returns default paths for javascript', async () => {
    const config = functionConfiguration()
    config.build = {
      wasm_opt: true,
    }
    const extensionInstance = await testFunctionExtension({
      config,
      entryPath: 'src/index.js',
      dir: 'foo',
    })

    const got = extensionInstance.watchBuildPaths

    expect(got).toEqual([joinPath('foo', 'src', '**', '*.{js,ts}'), joinPath('foo', '**', '!(.)*.graphql')])
  })

  test('returns js and ts paths for esbuild extensions', async () => {
    const extensionInstance = await testUIExtension({directory: 'foo'})

    const got = extensionInstance.watchBuildPaths

    expect(got).toEqual([joinPath('foo', 'src', '**', '*.{ts,tsx,js,jsx}')])
  })

  test('return empty array for non-function non-esbuild extensions', async () => {
    const extensionInstance = await testTaxCalculationExtension('foo')

    const got = extensionInstance.watchBuildPaths

    expect(got).toEqual([])
  })

  test('returns configured paths and input query', async () => {
    const config = functionConfiguration()
    config.build = {
      watch: ['src/**/*.rs', 'src/**/*.foo'],
      wasm_opt: true,
    }
    const extensionInstance = await testFunctionExtension({
      config,
      dir: 'foo',
    })

    const got = extensionInstance.watchBuildPaths

    expect(got).toEqual([
      joinPath('foo', 'src/**/*.rs'),
      joinPath('foo', 'src/**/*.foo'),
      joinPath('foo', '**', '!(.)*.graphql'),
    ])
  })

  test('returns null if not javascript and not configured', async () => {
    const config = functionConfiguration()
    config.build = {
      wasm_opt: true,
    }
    const extensionInstance = await testFunctionExtension({
      config,
    })

    const got = extensionInstance.watchBuildPaths

    expect(got).toBeNull()
  })
})

describe('keepBuiltSourcemapsLocally', async () => {
  test('moves the appropriate source map files to the expected directory for sourcemap generating extensions', async () => {
    await inTemporaryDirectory(async (bundleDirectory: string) => {
      await inTemporaryDirectory(async (outputPath: string) => {
        const extensionInstance = await testUIExtension({
          type: 'ui_extension',
          handle: 'scriptToMove',
          directory: outputPath,
        })
        const someDirPath = joinPath(bundleDirectory, 'some_dir')
        const otherDirPath = joinPath(bundleDirectory, 'other_dir')

        await mkdir(someDirPath)
        await writeFile(joinPath(someDirPath, 'scriptToMove.js'), 'abc')
        await writeFile(joinPath(someDirPath, 'scriptToMove.js.map'), 'abc map')

        await mkdir(otherDirPath)
        await writeFile(joinPath(otherDirPath, 'scriptToIgnore.js'), 'abc')
        await writeFile(joinPath(otherDirPath, 'scriptToIgnore.js.map'), 'abc map')

        await extensionInstance.keepBuiltSourcemapsLocally(bundleDirectory, 'some_dir')

        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToMove.js'))).toBe(false)
        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToMove.js.map'))).toBe(true)
        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToIgnore.js'))).toBe(false)
        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToIgnore.js.map'))).toBe(false)
      })
    })
  })

  test('does not move files if no handle matching sourcemap files found within the given path', async () => {
    await inTemporaryDirectory(async (bundleDirectory: string) => {
      await inTemporaryDirectory(async (outputPath: string) => {
        const extensionInstance = await testUIExtension({
          type: 'ui_extension',
          handle: 'scriptToMove',
          directory: outputPath,
        })
        const someDirPath = joinPath(bundleDirectory, 'some_dir')
        const otherDirPath = joinPath(bundleDirectory, 'other_dir')

        await mkdir(someDirPath)
        await writeFile(joinPath(someDirPath, 'scriptToMove.js'), 'abc')
        await writeFile(joinPath(someDirPath, 'scriptToMove.js.map'), 'abc map')

        await mkdir(otherDirPath)
        await writeFile(joinPath(otherDirPath, 'scriptToIgnore.js'), 'abc')
        await writeFile(joinPath(otherDirPath, 'scriptToIgnore.js.map'), 'abc map')

        await extensionInstance.keepBuiltSourcemapsLocally(bundleDirectory, 'other_dir')

        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToMove.js'))).toBe(false)
        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToMove.js.map'))).toBe(false)
        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToIgnore.js'))).toBe(false)
        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToIgnore.js.map'))).toBe(false)
      })
    })
  })

  test('does nothing for non-sourcemap generating extensions', async () => {
    await inTemporaryDirectory(async (bundleDirectory: string) => {
      await inTemporaryDirectory(async (outputPath: string) => {
        const extensionInstance = await testUIExtension({
          type: 'web_pixel_extension',
          handle: 'scriptToMove',
          directory: outputPath,
        })
        const someDirPath = joinPath(bundleDirectory, 'some_dir')
        const otherDirPath = joinPath(bundleDirectory, 'other_dir')

        await mkdir(someDirPath)
        await writeFile(joinPath(someDirPath, 'scriptToMove.js'), 'abc')
        await writeFile(joinPath(someDirPath, 'scriptToMove.js.map'), 'abc map')

        await mkdir(otherDirPath)
        await writeFile(joinPath(otherDirPath, 'scriptToIgnore.js'), 'abc')
        await writeFile(joinPath(otherDirPath, 'scriptToIgnore.js.map'), 'abc map')

        await extensionInstance.keepBuiltSourcemapsLocally(bundleDirectory, 'some_dir')

        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToMove.js'))).toBe(false)
        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToMove.js.map'))).toBe(false)
        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToIgnore.js'))).toBe(false)
        expect(fileExistsSync(joinPath(outputPath, 'dist', 'scriptToIgnore.js.map'))).toBe(false)
      })
    })
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

describe('deployConfig', async () => {
  test('returns deployConfig when defined', async () => {
    const extensionInstance = await testThemeExtensions()

    const got = await extensionInstance.deployConfig({
      apiKey: 'apiKey',
      appConfiguration: placeholderAppConfiguration,
    })

    expect(got).toMatchObject({theme_extension: {files: {}}})
  })

  test('returns transformed config when defined', async () => {
    const extensionInstance = await testAppConfigExtensions()

    const got = await extensionInstance.deployConfig({
      apiKey: 'apiKey',
      appConfiguration: placeholderAppConfiguration,
    })

    expect(got).toMatchObject({embedded: true})
  })

  test('returns undefined when the transformed config is empty', async () => {
    const extensionInstance = await testAppConfigExtensions(true)

    const got = await extensionInstance.deployConfig({
      apiKey: 'apiKey',
      appConfiguration: placeholderAppConfiguration,
    })

    expect(got).toBeUndefined()
  })
})

describe('bundleConfig', async () => {
  test('returns the uuid from extensions when the extension is uuid managed', async () => {
    const extensionInstance = await testThemeExtensions()

    const got = await extensionInstance.bundleConfig({
      identifiers: {
        extensions: {'theme-extension-name': 'theme-uuid'},
        extensionIds: {},
        app: 'My app',
        extensionsNonUuidManaged: {},
      },
      developerPlatformClient,
      apiKey: 'apiKey',
      appConfiguration: placeholderAppConfiguration,
    })

    expect(got).toEqual(
      expect.objectContaining({
        uuid: 'theme-uuid',
        context: '',
      }),
    )
  })

  test('returns the target in context for a payments app', async () => {
    const extensionInstance = await testPaymentExtensions()

    const got = await extensionInstance.bundleConfig({
      identifiers: {
        extensions: {'payment-extension-name': 'payment-uuid'},
        extensionIds: {},
        app: 'My app',
        extensionsNonUuidManaged: {},
      },
      developerPlatformClient,
      apiKey: 'apiKey',
      appConfiguration: placeholderAppConfiguration,
    })

    expect(got).toEqual(
      expect.objectContaining({
        uuid: 'payment-uuid',
        context: 'payments.offsite.render',
      }),
    )
  })

  test('returns the uuid from extensionsNonUuidManaged when the extension is not uuid managed', async () => {
    const extensionInstance = await testAppConfigExtensions()

    const got = await extensionInstance.bundleConfig({
      identifiers: {
        extensions: {},
        extensionIds: {},
        app: 'My app',
        extensionsNonUuidManaged: {point_of_sale: 'uuid'},
      },
      developerPlatformClient,
      apiKey: 'apiKey',
      appConfiguration: placeholderAppConfiguration,
    })

    expect(got).toEqual(
      expect.objectContaining({
        uuid: 'uuid',
      }),
    )
  })
})

describe('contextValue', async () => {
  test('returns the target value in context for a payments extension', async () => {
    const extensionInstance = await testPaymentExtensions()

    const got = extensionInstance.contextValue

    expect(got).toEqual('payments.offsite.render')
  })

  test('returns an empty string for an extension without targets', async () => {
    const extensionInstance = await testAppConfigExtensions()

    const got = extensionInstance.contextValue

    expect(got).toEqual('')
  })

  test('returns an empty string for an extension with multiple targets', async () => {
    const extensionInstance = await testUIExtension()

    const got = extensionInstance.contextValue

    expect(got).toEqual('')
  })
})

describe('isFlow', async () => {
  test('returns true for a flow extension', async () => {
    const extensionInstance = await testFlowActionExtension()

    const got = extensionInstance.isFlow

    expect(got).toBe(true)
  })

  test('returns false for a non-flow extension', async () => {
    const extensionInstance = await testAppConfigExtensions()

    const got = extensionInstance.isFlow

    expect(got).toBe(false)
  })
})

describe('draftMessages', async () => {
  test('returns correct success message when the extension is draftable and not configuration', async () => {
    // Given
    const extensionInstance = await testUIExtension()

    // When
    const result = extensionInstance.draftMessages.successMessage

    // Then
    expect(result).toEqual('Draft updated successfully for extension: test-ui-extension')
  })

  test('returns no success message when the extension is draftable but configuration', async () => {
    // Given
    const extensionInstance = await testAppConfigExtensions()

    // When
    const result = extensionInstance.draftMessages.successMessage

    // Then
    expect(result).toBeUndefined()
  })

  test('returns correct error message when the extension is draftable and not configuration', async () => {
    // Given
    const extensionInstance = await testUIExtension()

    // When
    const result = extensionInstance.draftMessages.errorMessage

    // Then
    expect(result).toEqual('Error while deploying updated extension draft')
  })

  test('returns no error message when the extension is draftable but configuration', async () => {
    // Given
    const extensionInstance = await testAppConfigExtensions()

    // When
    const result = extensionInstance.draftMessages.successMessage

    // Then
    expect(result).toBeUndefined()
  })

  describe('buildHandle', async () => {
    test('extensions handle is either its handle or name when specification uidStrategy is uuid', async () => {
      // Given
      const extensionInstance = await testUIExtension()

      const result = extensionInstance.configuration.handle ?? slugify(extensionInstance.configuration.name ?? '')
      // Then
      expect(extensionInstance.handle).toBe(result)
    })

    test('extensions handle is its identifier when specification uidStrategy is single', async () => {
      // Given
      const extensionInstance = await testAppConfigExtensions()

      // Then
      expect(extensionInstance.handle).toBe(extensionInstance.specification.identifier)
    })

    test('extensions handle is a hashString when specification uidStrategy is dynamic and it is a webhook subscription extension', async () => {
      // Given
      const extensionInstance = await testSingleWebhookSubscriptionExtension()

      // When
      const subscription = extensionInstance.configuration as unknown as SingleWebhookSubscriptionType
      let result = ''
      if (subscription) {
        result = hashString(subscription.topic + subscription.uri + subscription.filter).substring(
          0,
          MAX_EXTENSION_HANDLE_LENGTH,
        )
      }

      // Then
      expect(extensionInstance.handle).toBe(result)
    })
  })

  describe('buildUIDFromStrategy', async () => {
    test('returns specification identifier when strategy is single', async () => {
      // Given
      const extensionInstance = await testAppConfigExtensions()

      // Then
      expect(extensionInstance.uid).toBe(extensionInstance.specification.identifier)
    })

    test('returns configuration uid when strategy is uuid and uid exists', async () => {
      // Given
      const extensionInstance = await testUIExtension({
        name: 'test-extension',
        type: 'ui_extension',
        uid: 'test-uid',
      })

      // Then
      expect(extensionInstance.uid).toBe('test-uid')
    })

    test('returns non-random UUID based on handle when strategy is uuid and no uid exists', async () => {
      // Given
      const extensionInstance = await testThemeExtensions()

      // Then
      expect(extensionInstance.uid).toBe(nonRandomUUID(extensionInstance.handle))
    })

    test('returns non-random UUID based on handle when strategy is dynamic', async () => {
      // Given
      const extensionInstance = await testSingleWebhookSubscriptionExtension()

      // Then
      expect(extensionInstance.uid).toBe(nonRandomUUID(extensionInstance.handle))
    })
  })
})
