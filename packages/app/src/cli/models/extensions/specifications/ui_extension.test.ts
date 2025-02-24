import * as loadLocales from '../../../utilities/extensions/locales-configuration.js'
import {ExtensionInstance} from '../extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {inTemporaryDirectory, mkdir, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {err, ok} from '@shopify/cli-kit/node/result'
import {zod} from '@shopify/cli-kit/node/schema'
import {describe, expect, test, vi} from 'vitest'

describe('ui_extension', async () => {
  interface GetUIExtensionProps {
    directory: string
    extensionPoints?: {
      target: string
      module: string
      label?: string
      default_placement_reference?: string
      should_render?: {
        module: string
      }
      urls?: {
        edit?: string
      }
      build_manifest?: {
        assets: {
          main: {
            filepath: string
            module: string
          }
          should_render?: {
            filepath: string
            module: string
          }
        }
      }
    }[]
  }

  async function getTestUIExtension({directory, extensionPoints}: GetUIExtensionProps) {
    const configurationPath = joinPath(directory, 'shopify.extension.toml')
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
    const configuration = {
      extension_points: extensionPoints,
      api_version: '2023-01' as const,
      name: 'UI Extension',
      description: 'This is an ordinary test extension.',
      type: 'ui_extension',
      metafields: [],
      capabilities: {
        block_progress: false,
        network_access: false,
        api_access: false,
        collect_buyer_consent: {
          customer_privacy: true,
          sms_marketing: false,
        },
        iframe: {
          sources: [],
        },
      },
      settings: {},
      urls: {},
    }

    return new ExtensionInstance({
      configuration,
      directory,
      specification,
      configurationPath,
      entryPath: '',
    })
  }

  describe('validate()', () => {
    test('returns ok({}) if there are no errors', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        await mkdir(joinPath(tmpDir, 'src'))
        await touchFile(joinPath(tmpDir, 'src', 'ExtensionPointA.js'))

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

    test('targeting object is transformed into extension_points. metafields are inherited', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            should_render: {
              module: './src/ShouldRender.js',
            },
          },
        ],
        api_version: '2023-01' as const,
        handle: 'test-ui-extension',
        name: 'UI Extension',
        description: 'This is an ordinary test extension',
        type: 'ui_extension',
        metafields: [{namespace: 'test', key: 'test'}],
        capabilities: {
          block_progress: false,
          network_access: false,
          api_access: false,
          collect_buyer_consent: {
            customer_privacy: true,
            sms_marketing: false,
          },
          iframe: {
            sources: [],
          },
        },
        settings: {},
      }

      // When
      const parsed = specification.parseConfigurationObject(configuration)
      if (parsed.state !== 'ok') {
        throw new Error("Couldn't parse configuration")
      }

      const got = parsed.data

      // Then
      expect(got.extension_points).toStrictEqual([
        {
          target: 'EXTENSION::POINT::A',
          module: './src/ExtensionPointA.js',
          metafields: [{namespace: 'test', key: 'test'}],
          default_placement_reference: undefined,
          capabilities: undefined,
          preloads: {},
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
              },
              should_render: {
                filepath: 'test-ui-extension-conditions.js',
                module: './src/ShouldRender.js',
              },
            },
          },
          urls: {},
        },
      ])
    })

    test('targeting object accepts a default_placement', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            default_placement: 'PLACEMENT_REFERENCE1',
          },
        ],
        api_version: '2023-01' as const,
        name: 'UI Extension',
        description: 'This is an ordinary test extension',
        type: 'ui_extension',
        handle: 'test-ui-extension',
        capabilities: {
          block_progress: false,
          network_access: false,
          api_access: false,
          collect_buyer_consent: {
            customer_privacy: true,
            sms_marketing: false,
          },
          iframe: {
            sources: [],
          },
        },
        settings: {},
      }

      // When
      const parsed = specification.parseConfigurationObject(configuration)
      if (parsed.state !== 'ok') {
        throw new Error("Couldn't parse configuration")
      }

      const got = parsed.data

      // Then
      expect(got.extension_points).toStrictEqual([
        {
          target: 'EXTENSION::POINT::A',
          module: './src/ExtensionPointA.js',
          metafields: [],
          default_placement_reference: 'PLACEMENT_REFERENCE1',
          capabilities: undefined,
          preloads: {},
          urls: {},
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
              },
            },
          },
        },
      ])
    })

    test('targeting object accepts allow_direct_linking for target capabilities', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            capabilities: {allow_direct_linking: true},
          },
        ],
        api_version: '2023-01' as const,
        name: 'UI Extension',
        description: 'This is an ordinary test extension',
        type: 'ui_extension',
        handle: 'test-ui-extension',
        capabilities: {
          block_progress: false,
          network_access: false,
          api_access: false,
          collect_buyer_consent: {
            customer_privacy: true,
            sms_marketing: false,
          },
          iframe: {
            sources: [],
          },
        },
        settings: {},
      }

      // When
      const parsed = specification.parseConfigurationObject(configuration)
      if (parsed.state !== 'ok') {
        throw new Error("Couldn't parse configuration")
      }

      const got = parsed.data

      // Then
      expect(got.extension_points).toStrictEqual([
        {
          target: 'EXTENSION::POINT::A',
          module: './src/ExtensionPointA.js',
          metafields: [],
          urls: {},
          default_placement_reference: undefined,
          capabilities: {allow_direct_linking: true},
          preloads: {},
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
              },
            },
          },
        },
      ])
    })

    test('targeting object accepts preloads', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            preloads: {chat: '/chat', not_supported: '/hello'},
          },
        ],
        api_version: '2023-01' as const,
        name: 'UI Extension',
        description: 'This is an ordinary test extension',
        type: 'ui_extension',
        handle: 'test-ui-extension',
        capabilities: {
          block_progress: false,
          network_access: false,
          api_access: false,
          collect_buyer_consent: {
            customer_privacy: true,
            sms_marketing: false,
          },
          iframe: {
            sources: [],
          },
        },
        settings: {},
      }

      // When
      const parsed = specification.parseConfigurationObject(configuration)
      if (parsed.state !== 'ok') {
        throw new Error("Couldn't parse configuration")
      }

      const got = parsed.data

      // Then
      expect(got.extension_points).toStrictEqual([
        {
          target: 'EXTENSION::POINT::A',
          module: './src/ExtensionPointA.js',
          metafields: [],
          default_placement_reference: undefined,
          capabilities: undefined,
          preloads: {chat: '/chat'},
          urls: {},
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
              },
            },
          },
        },
      ])
    })

    test('targeting object accepts urls', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            preloads: {chat: '/chat', not_supported: '/hello'},
            urls: {
              edit: '/bundles/products/101',
            },
          },
        ],
        api_version: '2023-01' as const,
        name: 'UI Extension',
        description: 'This is an ordinary test extension',
        type: 'ui_extension',
        handle: 'test-ui-extension',
        capabilities: {
          block_progress: false,
          network_access: false,
          api_access: false,
          collect_buyer_consent: {
            customer_privacy: true,
            sms_marketing: false,
          },
          iframe: {
            sources: [],
          },
        },
        settings: {},
      }

      // When
      const parsed = specification.parseConfigurationObject(configuration)
      if (parsed.state !== 'ok') {
        throw new Error("Couldn't parse configuration")
      }

      const got = parsed.data

      // Then
      expect(got.extension_points).toStrictEqual([
        {
          target: 'EXTENSION::POINT::A',
          module: './src/ExtensionPointA.js',
          metafields: [],
          default_placement_reference: undefined,
          capabilities: undefined,
          preloads: {chat: '/chat'},
          urls: {
            edit: '/bundles/products/101',
          },
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
              },
            },
          },
        },
      ])
    })

    test('build_manifest includes should_render asset when should_render.module is present', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            should_render: {
              module: './src/ShouldRender.js',
            },
            preloads: {chat: '/chat', not_supported: '/hello'},
          },
        ],
        api_version: '2023-01' as const,
        name: 'UI Extension',
        description: 'This is an ordinary test extension',
        type: 'ui_extension',
        handle: 'test-ui-extension',
        capabilities: {
          block_progress: false,
          network_access: false,
          api_access: false,
          collect_buyer_consent: {
            customer_privacy: true,
            sms_marketing: false,
          },
          iframe: {
            sources: [],
          },
        },
        settings: {},
      }

      // When
      const parsed = specification.parseConfigurationObject(configuration)
      if (parsed.state !== 'ok') {
        throw new Error("Couldn't parse configuration")
      }

      const got = parsed.data

      // Then
      expect(got.extension_points).toStrictEqual([
        {
          target: 'EXTENSION::POINT::A',
          module: './src/ExtensionPointA.js',
          metafields: [],
          default_placement_reference: undefined,
          capabilities: undefined,
          preloads: {chat: '/chat'},
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
              },
              should_render: {
                filepath: 'test-ui-extension-conditions.js',
                module: './src/ShouldRender.js',
              },
            },
          },
          urls: {},
        },
      ])
    })

    test('returns error if there is no targeting or extension_points', async () => {
      // Given
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        api_version: '2023-01' as const,
        name: 'UI Extension',
        description: 'This is an ordinary test extension',
        type: 'ui_extension',
        metafields: [{namespace: 'test', key: 'test'}],
        capabilities: {
          block_progress: false,
          network_access: false,
          api_access: false,
          collect_buyer_consent: {
            customer_privacy: true,
            sms_marketing: false,
          },
          iframe: {
            sources: [],
          },
        },
        settings: {},
      }

      // When/Then
      const parsed = specification.parseConfigurationObject(configuration)
      expect(parsed.state).toBe('error')
      expect(parsed.errors).toEqual([
        {
          code: zod.ZodIssueCode.custom,
          message: 'No extension targets defined, add a `targeting` field to your configuration',
          path: [],
        },
      ])
    })

    test('returns err(message) when extensionPoints[n].module does not map to a file', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
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
        const notFoundPath = joinPath(tmpDir, './ExtensionPointA.js')

        expect(result).toEqual(
          err(`Couldn't find ${notFoundPath}
Please check the module path for EXTENSION::POINT::A

Please check the configuration in ${uiExtension.configurationPath}`),
        )
      })
    })

    test('returns err(message) when there are duplicate targets', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        await mkdir(joinPath(tmpDir, 'src'))
        await touchFile(joinPath(tmpDir, 'src', 'ExtensionPointA.js'))

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
        expect(result).toEqual(
          err(`Duplicate targets found: EXTENSION::POINT::A
Extension point targets must be unique

Please check the configuration in ${uiExtension.configurationPath}`),
        )
      })
    })
  })

  describe('deployConfig()', () => {
    test('returns the deploy config', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
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
              build_manifest: {
                assets: {
                  main: {
                    filepath: 'test-ui-extension.js',
                    module: './src/ExtensionPointA.js',
                  },
                },
              },
            },
          ],
        })

        // When
        const deployConfig = await uiExtension.deployConfig({
          apiKey: 'apiKey',
          appConfiguration: placeholderAppConfiguration,
        })

        // Then
        expect(loadLocales.loadLocalesConfig).toBeCalledWith(tmpDir, uiExtension.configuration.type)
        expect(deployConfig).toStrictEqual({
          localization,
          extension_points: uiExtension.configuration.extension_points?.map((extPoint) => ({
            ...extPoint,
            build_manifest: {
              ...extPoint.build_manifest,
              assets: {
                main: {
                  filepath: 'dist/test-ui-extension.js',
                  module: extPoint.module,
                },
              },
            },
          })),

          // Ensure nested capabilities are updated
          capabilities: {
            ...uiExtension.configuration.capabilities,
            collect_buyer_consent: {
              ...uiExtension.configuration.capabilities.collect_buyer_consent,
            },
            iframe: {
              ...uiExtension.configuration.capabilities.iframe,
            },
          },
          name: uiExtension.configuration.name,
          description: uiExtension.configuration.description,
          api_version: uiExtension.configuration.api_version,
          settings: uiExtension.configuration.settings,
        })
      })
    })
  })

  describe('getBundleExtensionStdinContent()', async () => {
    test('maps every target to an import statement', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          extensionPoints: [
            {
              target: 'EXTENSION::POINT::A',
              module: './src/ExtensionPointA.js',
              build_manifest: {
                assets: {
                  main: {
                    module: './src/ExtensionPointA.js',
                    filepath: '/test-ui-extension.js',
                  },
                },
              },
            },
            {
              target: 'EXTENSION::POINT::B',
              module: './src/ExtensionPointB.js',
              build_manifest: {
                assets: {
                  main: {
                    module: './src/ExtensionPointB.js',
                    filepath: '/test-ui-extension.js',
                  },
                },
              },
            },
          ],
        })

        // When
        const stdInContent = uiExtension.getBundleExtensionStdinContent().main

        // Then
        expect(stdInContent).toContain(`import './src/ExtensionPointA.js';`)
        expect(stdInContent).toContain(`import './src/ExtensionPointB.js';`)
      })
    })
  })

  describe('shouldFetchCartUrl()', async () => {
    test('returns true if a Checkout target exists', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
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
      await inTemporaryDirectory(async (tmpDir) => {
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
      await inTemporaryDirectory(async (tmpDir) => {
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
      await inTemporaryDirectory(async (tmpDir) => {
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
