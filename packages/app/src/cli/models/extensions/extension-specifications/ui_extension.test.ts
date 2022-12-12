import {ExtensionInstance, ExtensionSpec, specForType} from '../extensions.js'
import {configurationFileNames} from '../../../constants.js'
import * as loadLocales from '../../../utilities/extensions/locales-configuration.js'
import {describe, expect, test, vi} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {err, ok} from '@shopify/cli-kit/node/result'

describe('ui_extension', async () => {
  interface GetUIExtensionProps {
    directory: string
    extensionPoints?: {target: string; module: string}[]
  }

  async function getTestUIExtension({directory, extensionPoints}: GetUIExtensionProps) {
    const configurationPath = path.join(directory, configurationFileNames.extension.ui)
    const specification = (await specForType('ui_extension')) as ExtensionSpec
    const configuration = {
      extensionPoints,
      name: 'UI Extension',
      type: 'ui_extension',
      metafields: [],
      capabilities: {
        block_progress: false,
        network_access: false,
      },
      settings: {},
    }

    return new ExtensionInstance({
      configuration,
      directory,
      specification,
      configurationPath,
      entryPath: '',
      remoteSpecification: undefined,
      extensionPointSpecs: undefined,
    })
  }

  describe('validate()', () => {
    test('returns ok({}) if there are no errors', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        await file.mkdir(path.join(tmpDir, 'src'))
        await file.touch(path.join(tmpDir, 'src', 'ExtensionPointA.js'))

        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'EXTENSION::POINT::A',
              module: './src/ExtensionPointA.js',
            },
          ],
        })

        // When
        const result = await uiExtension.validate()

        // Then
        expect(result).toStrictEqual(ok({}))
      })
    })

    test('returns err(message) when extensionPoints[n].module does not map to a file', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'EXTENSION::POINT::A',
              module: './ExtensionPointA.js',
            },
          ],
        })

        // When
        const result = await uiExtension.validate()

        // Then
        const notFoundPath = path.join(tmpDir, './ExtensionPointA.js')
        const tomlPath = path.join(tmpDir, configurationFileNames.extension.ui)

        expect(result).toEqual(
          err(`Couldn't find ${notFoundPath}
Please check the module path for EXTENSION::POINT::A

Please check the configuration in ${tomlPath}`),
        )
      })
    })

    test('returns err(message) when there are duplicate targets', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        await file.mkdir(path.join(tmpDir, 'src'))
        await file.touch(path.join(tmpDir, 'src', 'ExtensionPointA.js'))

        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'EXTENSION::POINT::A',
              module: './src/ExtensionPointA.js',
            },
            {
              target: 'EXTENSION::POINT::A',
              module: './src/ExtensionPointA.js',
            },
          ],
        })

        // When
        const result = await uiExtension.validate()

        // Then
        const tomlPath = path.join(tmpDir, configurationFileNames.extension.ui)

        expect(result).toEqual(
          err(`Duplicate targets found: EXTENSION::POINT::A
Extension point targets must be unique

Please check the configuration in ${tomlPath}`),
        )
      })
    })
  })

  describe('previewMessage()', async () => {
    test('maps every target to a preview link', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'EXTENSION::POINT::A',
              module: './src/ExtensionPointA.js',
            },
            {
              target: 'EXTENSION::POINT::B',
              module: './src/ExtensionPointB.js',
            },
          ],
        })

        // When
        const host = 'http://1234.ngrok.io'
        const previewMessage = await uiExtension.previewMessage(host, 'not_used')

        // Then
        expect(previewMessage!.value).toContain(
          `EXTENSION::POINT::A preview link: ${host}/extensions/${uiExtension.devUUID}/EXTENSION::POINT::A`,
        )
        expect(previewMessage!.value).toContain(
          `EXTENSION::POINT::B preview link: ${host}/extensions/${uiExtension.devUUID}/EXTENSION::POINT::B`,
        )
      })
    })
  })

  describe('deployConfig()', () => {
    test('returns the deploy config', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const localization = {
          default_locale: 'en',
          translations: {title: 'Hola!'},
        }
        vi.spyOn(loadLocales, 'loadLocalesConfig').mockResolvedValue(localization)
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'EXTENSION::POINT::A',
              module: './src/ExtensionPointA.js',
            },
          ],
        })

        // When
        const deployConfig = await uiExtension.deployConfig()

        // Then
        expect(loadLocales.loadLocalesConfig).toBeCalledWith(tmpDir, uiExtension.configuration.type)
        expect(deployConfig).toStrictEqual({
          localization,
          extension_points: uiExtension.configuration.extensionPoints,
          capabilities: uiExtension.configuration.capabilities,
          metafields: uiExtension.configuration.metafields,
          name: uiExtension.configuration.name,
          settings: uiExtension.configuration.settings,
        })
      })
    })
  })

  describe('getBundleExtensionStdinContent()', async () => {
    test('maps every target to an import statement', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'EXTENSION::POINT::A',
              module: './src/ExtensionPointA.js',
            },
            {
              target: 'EXTENSION::POINT::B',
              module: './src/ExtensionPointB.js',
            },
          ],
        })

        // When
        const stdInContent = uiExtension.getBundleExtensionStdinContent()

        // Then
        expect(stdInContent).toContain(`import './src/ExtensionPointA.js';`)
        expect(stdInContent).toContain(`import './src/ExtensionPointB.js';`)
      })
    })
  })

  describe('shouldFetchCartUrl()', async () => {
    test('returns true if a Checkout target exists', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'CHECKOUT::POINT::A',
              module: './src/CheckoutPointA.js',
            },
          ],
        })

        // Then
        expect(uiExtension.shouldFetchCartUrl()).toBe(true)
      })
    })

    test('returns false if a Checkout target does not exist', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'ADMIN::POINT::A',
              module: './src/CheckoutPointA.js',
            },
          ],
        })

        // Then
        expect(uiExtension.shouldFetchCartUrl()).toBe(false)
      })
    })
  })

  describe('hasExtensionPointTarget()', async () => {
    test('returns true if the target exists', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'POINT::THAT::EXISTS',
              module: './src/PointThatExists.js',
            },
          ],
        })

        // Then
        expect(uiExtension.hasExtensionPointTarget('POINT::THAT::EXISTS')).toBe(true)
      })
    })

    test('returns false if the target does not exist', async () => {
      await file.inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'POINT::THAT::EXISTS',
              module: './src/PointThatExists.js',
            },
          ],
        })

        // Then
        expect(uiExtension.hasExtensionPointTarget('NONEXISTANT::POINT')).toBe(false)
      })
    })
  })
})
