import {getShouldRenderTarget} from './ui_extension.js'
import * as loadLocales from '../../../utilities/extensions/locales-configuration.js'
import {ExtensionInstance} from '../extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {AssetIdentifier} from '../specification.js'
import {inTemporaryDirectory, touchFile, writeFile, mkdir, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {err, ok} from '@shopify/cli-kit/node/result'
import {zod} from '@shopify/cli-kit/node/schema'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import * as output from '@shopify/cli-kit/node/output'
import type {NewExtensionPointSchemaType} from '../schemas.js'

describe('ui_extension', async () => {
  interface GetUIExtensionProps {
    directory: string
    apiVersion?: string
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

  async function getTestUIExtension({directory, extensionPoints, apiVersion}: GetUIExtensionProps) {
    const configurationPath = joinPath(directory, 'shopify.extension.toml')
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
    const configuration = {
      extension_points: extensionPoints,
      api_version: apiVersion ?? ('2023-01' as const),
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
          tools: undefined,
          instructions: undefined,
          intents: undefined,
          assets: undefined,
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
          tools: undefined,
          instructions: undefined,
          intents: undefined,
          assets: undefined,
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
          tools: undefined,
          instructions: undefined,
          intents: undefined,
          assets: undefined,
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
          tools: undefined,
          instructions: undefined,
          intents: undefined,
          assets: undefined,
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
          tools: undefined,
          instructions: undefined,
          intents: undefined,
          assets: undefined,
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
          tools: undefined,
          instructions: undefined,
          intents: undefined,
          assets: undefined,
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

    test('build_manifest includes tools asset when tools is present', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            tools: './tools.json',
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
          tools: './tools.json',
          instructions: undefined,
          intents: undefined,
          assets: undefined,
          metafields: [],
          default_placement_reference: undefined,
          capabilities: undefined,
          preloads: {},
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
              },
            },
          },
          urls: {},
        },
      ])
    })

    test('build_manifest includes instructions asset when instructions is present', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            instructions: './instructions.md',
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
          tools: undefined,
          instructions: './instructions.md',
          intents: undefined,
          assets: undefined,
          metafields: [],
          default_placement_reference: undefined,
          capabilities: undefined,
          preloads: {},
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
              },
            },
          },
          urls: {},
        },
      ])
    })

    test('targeting object passes through assets when configured', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            assets: './assets',
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
          tools: undefined,
          instructions: undefined,
          intents: undefined,
          assets: './assets',
          metafields: [],
          default_placement_reference: undefined,
          capabilities: undefined,
          preloads: {},
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
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

    test('build_manifest includes both tools and instructions when both are present', async () => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
      const configuration = {
        targeting: [
          {
            target: 'EXTENSION::POINT::A',
            module: './src/ExtensionPointA.js',
            tools: './tools.json',
            instructions: './instructions.md',
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
          tools: './tools.json',
          instructions: './instructions.md',
          intents: undefined,
          assets: undefined,
          metafields: [],
          default_placement_reference: undefined,
          capabilities: undefined,
          preloads: {},
          build_manifest: {
            assets: {
              main: {
                filepath: 'test-ui-extension.js',
                module: './src/ExtensionPointA.js',
              },
            },
          },
          urls: {},
        },
      ])
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
          supported_features: undefined,
          name: uiExtension.configuration.name,
          description: uiExtension.configuration.description,
          api_version: uiExtension.configuration.api_version,
          settings: uiExtension.configuration.settings,
        })
      })
    })

    test('returns supported_features with runs_offline true when configured', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        vi.spyOn(loadLocales, 'loadLocalesConfig').mockResolvedValue({})
        const configurationPath = joinPath(tmpDir, 'shopify.extension.toml')
        const allSpecs = await loadLocalExtensionsSpecifications()
        const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
        const uiExtension = new ExtensionInstance({
          configuration: {
            extension_points: [],
            api_version: '2023-01' as const,
            name: 'UI Extension',
            type: 'ui_extension',
            metafields: [],
            capabilities: {},
            supported_features: {
              runs_offline: true,
            },
            settings: {},
          },
          directory: tmpDir,
          specification,
          configurationPath,
          entryPath: '',
        })

        // When
        const deployConfig = await uiExtension.deployConfig({
          apiKey: 'apiKey',
          appConfiguration: placeholderAppConfiguration,
        })

        // Then
        expect(deployConfig?.supported_features).toStrictEqual({
          runs_offline: true,
        })
      })
    })

    test('returns supported_features with runs_offline false when configured', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        vi.spyOn(loadLocales, 'loadLocalesConfig').mockResolvedValue({})
        const configurationPath = joinPath(tmpDir, 'shopify.extension.toml')
        const allSpecs = await loadLocalExtensionsSpecifications()
        const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
        const uiExtension = new ExtensionInstance({
          configuration: {
            extension_points: [],
            api_version: '2023-01' as const,
            name: 'UI Extension',
            type: 'ui_extension',
            metafields: [],
            capabilities: {},
            supported_features: {
              runs_offline: false,
            },
            settings: {},
          },
          directory: tmpDir,
          specification,
          configurationPath,
          entryPath: '',
        })

        // When
        const deployConfig = await uiExtension.deployConfig({
          apiKey: 'apiKey',
          appConfiguration: placeholderAppConfiguration,
        })

        // Then
        expect(deployConfig?.supported_features).toStrictEqual({
          runs_offline: false,
        })
      })
    })

    test('returns supported_features as undefined when not configured', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        vi.spyOn(loadLocales, 'loadLocalesConfig').mockResolvedValue({})
        const configurationPath = joinPath(tmpDir, 'shopify.extension.toml')
        const allSpecs = await loadLocalExtensionsSpecifications()
        const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!
        const uiExtension = new ExtensionInstance({
          configuration: {
            extension_points: [],
            api_version: '2023-01' as const,
            name: 'UI Extension',
            type: 'ui_extension',
            metafields: [],
            capabilities: {},
            settings: {},
          },
          directory: tmpDir,
          specification,
          configurationPath,
          entryPath: '',
        })

        // When
        const deployConfig = await uiExtension.deployConfig({
          apiKey: 'apiKey',
          appConfiguration: placeholderAppConfiguration,
        })

        // Then
        expect(deployConfig?.supported_features).toBeUndefined()
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

    test('includes shopify.extend calls for all targets including should-render for Remote DOM API versions', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          // Remote DOM supported API version
          apiVersion: '2025-10',
          extensionPoints: [
            {
              target: 'admin.product-details.action.render',
              module: './src/ExtensionPointA.js',
              build_manifest: {
                assets: {
                  main: {
                    module: './src/ExtensionPointA.js',
                    filepath: '/test-ui-extension.js',
                  },
                  should_render: {
                    module: './src/condition/should-render.js',
                    filepath: '/test-ui-extension-conditions.js',
                  },
                },
              },
            },
          ],
        })

        // When
        const stdInContent = uiExtension.getBundleExtensionStdinContent()

        // Then
        expect(stdInContent.main).toBe(
          `import Target_0 from './src/ExtensionPointA.js';shopify.extend('admin.product-details.action.render', (...args) => Target_0(...args));`,
        )

        expect(stdInContent.assets!.find((asset) => asset.identifier === AssetIdentifier.ShouldRender)?.content).toBe(
          `import shouldRender from './src/condition/should-render.js';shopify.extend('admin.product-details.action.should-render', (...args) => shouldRender(...args));`,
        )
      })
    })

    test('uses regular imports for non-Remote DOM API versions', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          // Non-Remote DOM supported API version
          apiVersion: '2025-01',
          extensionPoints: [
            {
              target: 'admin.product-details.action.render',
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
          ],
        })

        // When
        const stdInContent = uiExtension.getBundleExtensionStdinContent().main

        // Then
        expect(stdInContent).toBe(`import './src/ExtensionPointA.js';`)
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

  interface TestUIExtensionPoint {
    target: string
    module: string
    tools?: string
    intents?: NonNullable<NewExtensionPointSchemaType['intents']>
    build_manifest: {
      assets: {
        main: {module: string}
        should_render?: {module: string}
      }
    }
  }

  async function setupUIExtensionWithNodeModules({
    tmpDir,
    fileContent,
    shouldRenderFileContent,
    apiVersion,
    target = 'admin.product-details.action.render',
    targetDtsContent,
  }: {
    tmpDir: string
    fileContent: string
    shouldRenderFileContent?: string
    apiVersion: string
    target?: string
    targetDtsContent?: string
  }) {
    // Create extension files
    const srcDir = joinPath(tmpDir, 'src')
    await mkdir(srcDir)
    const filePath = joinPath(srcDir, `index.jsx`)

    await writeFile(filePath, fileContent)

    // Create node_modules structure
    const nodeModulesPath = joinPath(tmpDir, 'node_modules', '@shopify', 'ui-extensions')
    await mkdir(nodeModulesPath)

    await Promise.all(
      ['admin', 'checkout', 'point-of-sale', 'customer-account'].map(async (generatedTypesHelperSurface) => {
        const generatedTypesHelperPath = joinPath(nodeModulesPath, generatedTypesHelperSurface)
        await mkdir(generatedTypesHelperPath)
        await writeFile(joinPath(generatedTypesHelperPath, 'index.js'), '// Mock generated types helper exports')
      }),
    )

    const targetPath = joinPath(nodeModulesPath, target)
    await mkdir(targetPath)
    // `require.resolve('@shopify/ui-extensions/<target>')` resolves to this file,
    // and the CLI's ShopifyGlobal detector reads whatever path require.resolve
    // returned. Injecting `targetDtsContent` here lets tests exercise the
    // detection branch; defaults preserve the original placeholder.
    await writeFile(joinPath(targetPath, 'index.js'), targetDtsContent ?? '// Mock UI extension target')

    let shouldRenderFilePath
    if (shouldRenderFileContent) {
      const shouldRenderTargetPath = joinPath(nodeModulesPath, getShouldRenderTarget(target))
      await mkdir(shouldRenderTargetPath)
      await writeFile(joinPath(shouldRenderTargetPath, 'index.js'), '// Mock UI extension should-render target')

      const shouldRenderDir = joinPath(srcDir, 'condition')
      await mkdir(shouldRenderDir)
      shouldRenderFilePath = joinPath(shouldRenderDir, 'should-render.js')

      await writeFile(shouldRenderFilePath, shouldRenderFileContent)
    }

    // Get UI extension spec and create instance
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!

    const extensionPoints: TestUIExtensionPoint[] = [
      {
        target,
        module: `./src/index.jsx`,
        build_manifest: {
          assets: {
            main: {
              module: './src/index.jsx',
            },
            should_render: shouldRenderFilePath
              ? {
                  module: './src/condition/should-render.js',
                }
              : undefined,
          },
        },
      },
    ]

    const extension = new ExtensionInstance({
      configuration: {
        api_version: apiVersion,
        extension_points: extensionPoints,
        name: 'Test UI Extension',
        type: 'ui_extension',
        metafields: [],
      },
      configurationPath: joinPath(tmpDir, 'shopify.extension.toml'),
      directory: tmpDir,
      specification,
      entryPath: filePath,
    })

    return {
      filePath,
      extension,
      shouldRenderFilePath,
      nodeModulesPath,
    }
  }

  describe('contributeToSharedTypeFile', () => {
    test('sets the typeDefinitionsByFile map for both main and should-render modules when api version supports Remote DOM', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// JSX code',
          shouldRenderFileContent: '// JS code',
          // Remote DOM supported version
          apiVersion: '2025-10',
        })
        // Create tsconfig.json
        const tsconfigPath = joinPath(tmpDir, 'tsconfig.json')
        await writeFile(tsconfigPath, '// TypeScript config')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')

        // Then
        expect(typeDefinitionsByFile).toStrictEqual(
          new Map([
            [
              shopifyDtsPath,
              new Set([
                `//@ts-ignore\ndeclare module './src/index.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;
  const globalThis: { shopify: typeof shopify };
}\n`,
                `//@ts-ignore\ndeclare module './src/condition/should-render.js' {
  const shopify: import('@shopify/ui-extensions/admin.product-details.action.should-render').Api;
  const globalThis: { shopify: typeof shopify };
}\n`,
              ]),
            ],
          ]),
        )
      })
    })

    test('supports individual and shared tsconfig.json files when api version supports Remote DOM', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, nodeModulesPath} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// JSX code',
          shouldRenderFileContent: '// JS code',
          // Remote DOM supported version
          apiVersion: '2025-10',
        })

        // Add another target sharing the same tsconfig.json as the main target
        const otherTarget = 'admin.orders-details.block.render'
        const targetPath = joinPath(nodeModulesPath, otherTarget)
        await mkdir(targetPath)
        await writeFile(joinPath(targetPath, 'index.js'), '// Mock other target')
        await writeFile(joinPath(tmpDir, 'src', 'another-target-module.jsx'), '// JSX code for other target')

        extension.configuration.extension_points.push({
          target: otherTarget,
          module: './src/another-target-module.jsx',
          build_manifest: {
            assets: {
              main: {
                module: './src/another-target-module.jsx',
              },
            } as any,
          },
        })

        const mainModuleTsConfigPath = joinPath(tmpDir, 'tsconfig.json')
        await writeFile(mainModuleTsConfigPath, '// TypeScript config')

        const shouldRenderModuleTsConfigPath = joinPath(tmpDir, 'src', 'condition', 'tsconfig.json')
        await writeFile(shouldRenderModuleTsConfigPath, '// TypeScript config')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        // Then
        expect(typeDefinitionsByFile).toStrictEqual(
          new Map([
            [
              joinPath(tmpDir, 'shopify.d.ts'),
              new Set([
                `//@ts-ignore\ndeclare module './src/index.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;
  const globalThis: { shopify: typeof shopify };
}\n`,
                `//@ts-ignore\ndeclare module './src/another-target-module.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.orders-details.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}\n`,
              ]),
            ],
            [
              joinPath(tmpDir, 'src', 'condition', 'shopify.d.ts'),
              new Set([
                `//@ts-ignore\ndeclare module './should-render.js' {
  const shopify: import('@shopify/ui-extensions/admin.product-details.action.should-render').Api;
  const globalThis: { shopify: typeof shopify };
}\n`,
              ]),
            ],
          ]),
        )
      })
    })

    test('emits Api & ShopifyGlobal intersection when target re-exports ShopifyGlobal', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// JSX code',
          // Remote DOM supported version
          apiVersion: '2025-10',
          // The target re-exports `ShopifyGlobal` via a named export specifier,
          // which is the shape the AST helper detects. Any surface can opt in
          // by emitting this shape from its target `.d.ts`.
          targetDtsContent: `
            interface _ShopifyGlobalInternal { addEventListener(type: string, listener: (event: unknown) => void): void }
            export type {_ShopifyGlobalInternal as ShopifyGlobal}
            export type Api = {placeholder: true}
          `,
        })

        // Create tsconfig.json
        const tsconfigPath = joinPath(tmpDir, 'tsconfig.json')
        await writeFile(tsconfigPath, '// TypeScript config')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')

        // Then — prettier wraps the long intersection onto two lines.
        expect(typeDefinitionsByFile).toStrictEqual(
          new Map([
            [
              shopifyDtsPath,
              new Set([
                `//@ts-ignore\ndeclare module './src/index.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api &
    import('@shopify/ui-extensions/admin.product-details.action.render').ShopifyGlobal;
  const globalThis: { shopify: typeof shopify };
}\n`,
              ]),
            ],
          ]),
        )
      })
    })

    test('ShopifyGlobal detection is target-agnostic — any target with the re-export opts in', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        // A fabricated target name belonging to no real surface. The detector
        // is purely name-based on the public `ShopifyGlobal` export, so any
        // surface's target can opt in by shipping this shape — there is no
        // allowlist or hard-coded target in the CLI.
        const genericTarget = 'fake-surface.any-target.render'

        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// JSX code',
          apiVersion: '2025-10',
          target: genericTarget,
          targetDtsContent: `
            interface _FakeShopifyGlobal { someHostApi(): void }
            export type {_FakeShopifyGlobal as ShopifyGlobal}
            export type Api = {placeholder: true}
          `,
        })

        const tsconfigPath = joinPath(tmpDir, 'tsconfig.json')
        await writeFile(tsconfigPath, '// TypeScript config')

        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')

        expect(typeDefinitionsByFile).toStrictEqual(
          new Map([
            [
              shopifyDtsPath,
              new Set([
                `//@ts-ignore\ndeclare module './src/index.jsx' {
  const shopify: import('@shopify/ui-extensions/${genericTarget}').Api &
    import('@shopify/ui-extensions/${genericTarget}').ShopifyGlobal;
  const globalThis: { shopify: typeof shopify };
}\n`,
              ]),
            ],
          ]),
        )
      })
    })

    test('emits plain Api when target does not re-export ShopifyGlobal', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        // No `targetDtsContent` — the helper writes the default placeholder,
        // which contains no `ShopifyGlobal` export. This guards against the
        // detection helper accidentally tripping on targets that don't opt in.
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// JSX code',
          apiVersion: '2025-10',
        })

        const tsconfigPath = joinPath(tmpDir, 'tsconfig.json')
        await writeFile(tsconfigPath, '// TypeScript config')

        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')

        expect(typeDefinitionsByFile).toStrictEqual(
          new Map([
            [
              shopifyDtsPath,
              new Set([
                `//@ts-ignore\ndeclare module './src/index.jsx' {
  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;
  const globalThis: { shopify: typeof shopify };
}\n`,
              ]),
            ],
          ]),
        )
      })
    })

    test("throws error when when api version supports Remote DOM and there's a tsconfig.json but type reference for target could not be found", async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Preact code',
          // Remote DOM supported version
          apiVersion: '2025-10',
        })

        // Create tsconfig.json file for testing
        const mainModuleTsConfigPath = joinPath(tmpDir, 'tsconfig.json')
        await writeFile(mainModuleTsConfigPath, '// TypeScript config')

        // Change target to a target that does not exist in the library
        extension.configuration.extension_points[0]!.target = 'admin.unknown.action.render'

        // When
        await expect(extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)).rejects.toThrow(
          new AbortError(
            'Type reference for admin.unknown.action.render could not be found. You might be using the wrong @shopify/ui-extensions version.',
            'Fix the error by ensuring you have the correct version of @shopify/ui-extensions, for example ~2025.10.0, in your dependencies.',
          ),
        )

        // No shopify.d.ts file should be created
        expect(fileExistsSync(joinPath(tmpDir, 'shopify.d.ts'))).toBe(false)
      })
    })

    test('does not throw error when when api version supports Remote DOM but there is no tsconfig.json', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Preact code',
          // Remote DOM supported version
          apiVersion: '2025-10',
        })

        // Change target to a target that does not exist in the library
        extension.configuration.extension_points[0]!.target = 'admin.unknown.action.render'

        // When
        await expect(extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)).resolves.not.toThrow()

        // No shopify.d.ts file should be created
        expect(fileExistsSync(joinPath(tmpDir, 'shopify.d.ts'))).toBe(false)
      })
    })

    test('does not set the typeDefinitionsByFile map when api version does not support Remote DOM', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()
      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// TypeScript React code',
          // Non-Remote DOM supported version
          apiVersion: '2025-01',
        })

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        // Then
        expect(typeDefinitionsByFile).toStrictEqual(new Map())

        // No shopify.d.ts file should be created
        expect(fileExistsSync(joinPath(tmpDir, 'shopify.d.ts'))).toBe(false)
      })
    })

    test('generates types for imported modules when extension has single target', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: `
            import './utils/helper.js';
            import './components/Button.jsx';
            // Main extension code
          `,
          apiVersion: '2025-10',
        })

        // Create imported files
        const utilsDir = joinPath(tmpDir, 'src', 'utils')
        const componentsDir = joinPath(tmpDir, 'src', 'components')
        await mkdir(utilsDir)
        await mkdir(componentsDir)
        await writeFile(joinPath(utilsDir, 'helper.js'), 'export const helper = () => {};')
        await writeFile(joinPath(componentsDir, 'Button.jsx'), 'export const Button = () => {};')

        // Create tsconfig.json
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '// TypeScript config')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')

        // Then - should include types for imported modules when single target
        expect(Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])).toContain(
          `//@ts-ignore\ndeclare module './src/utils/helper.js' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
        expect(Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])).toContain(
          `//@ts-ignore\ndeclare module './src/components/Button.jsx' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
      })
    })

    test('generates union types for shared modules when extension has multiple targets', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, nodeModulesPath} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: `
            import '../shared/utils.js';
            // Main extension code
          `,
          apiVersion: '2025-10',
        })

        // Add second target that shares modules
        const secondTarget = 'admin.orders-details.block.render'
        const targetPath = joinPath(nodeModulesPath, secondTarget)
        await mkdir(targetPath)
        await writeFile(joinPath(targetPath, 'index.js'), '// Mock second target')
        await writeFile(
          joinPath(tmpDir, 'src', 'orders.jsx'),
          `
          import '../shared/utils.js';
          // Orders extension code
        `,
        )

        extension.configuration.extension_points.push({
          target: secondTarget,
          module: './src/orders.jsx',
          build_manifest: {
            assets: {
              main: {
                module: './src/orders.jsx',
              },
            } as any,
          },
        })

        // Create shared module
        const sharedDir = joinPath(tmpDir, 'shared')
        await mkdir(sharedDir)
        await writeFile(joinPath(sharedDir, 'utils.js'), 'export const sharedUtil = () => {};')

        // Create tsconfig.json
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '// TypeScript config')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = typeDefinitionsByFile.get(shopifyDtsPath)

        // Then - should generate union type for shared module
        expect(Array.from(types ?? [])).toContain(
          `//@ts-ignore\ndeclare module './shared/utils.js' {\n  const shopify:\n    | import('@shopify/ui-extensions/admin.product-details.action.render').Api\n    | import('@shopify/ui-extensions/admin.orders-details.block.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
      })
    })

    test('generates non-target-specific types for all files when extension has multiple targets from different surfaces', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, nodeModulesPath} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: `
            import './components/Shared.jsx';
            // Admin extension code
          `,
          apiVersion: '2025-10',
          target: 'admin.product-details.action.render',
        })

        // Add checkout target (different surface)
        const checkoutTarget = 'purchase.checkout.block.render'
        const checkoutTargetPath = joinPath(nodeModulesPath, checkoutTarget)
        await mkdir(checkoutTargetPath)
        await writeFile(joinPath(checkoutTargetPath, 'index.js'), '// Mock checkout target')
        await writeFile(
          joinPath(tmpDir, 'src', 'checkout.jsx'),
          `
          import './components/Shared.jsx';
          // Checkout extension code
        `,
        )

        extension.configuration.extension_points.push({
          target: checkoutTarget,
          module: './src/checkout.jsx',
          build_manifest: {
            assets: {
              main: {
                module: './src/checkout.jsx',
              },
            } as any,
          },
        })

        // Create shared component
        const componentsDir = joinPath(tmpDir, 'src', 'components')
        await mkdir(componentsDir)
        await writeFile(joinPath(componentsDir, 'Shared.jsx'), 'export const Shared = () => {};')

        // Create tsconfig.json
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '// TypeScript config')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should generate union types for shared files
        // when targets are from different surfaces (admin vs checkout)
        expect(types).toContain(
          `//@ts-ignore\ndeclare module './src/components/Shared.jsx' {\n  const shopify:\n    | import('@shopify/ui-extensions/admin.product-details.action.render').Api\n    | import('@shopify/ui-extensions/purchase.checkout.block.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
      })
    })

    test('handles TypeScript path mapping aliases when resolving imports', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: `
            import '~/utils/helper.js';
            import '@/components/Button.jsx';
            // Main extension code using path aliases
          `,
          apiVersion: '2025-10',
        })

        // Create directory structure for aliased paths
        const utilsDir = joinPath(tmpDir, 'src', 'utils')
        const componentsDir = joinPath(tmpDir, 'src', 'components')
        await mkdir(utilsDir)
        await mkdir(componentsDir)
        await writeFile(joinPath(utilsDir, 'helper.js'), 'export const helper = () => {};')
        await writeFile(joinPath(componentsDir, 'Button.jsx'), 'export const Button = () => {};')

        // Create tsconfig.json with path mapping
        const tsconfigContent = JSON.stringify(
          {
            compilerOptions: {
              baseUrl: '.',
              paths: {
                '~/*': ['./src/*'],
                '@/*': ['./src/*'],
              },
            },
          },
          null,
          2,
        )
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), tsconfigContent)

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')

        // Then - should resolve aliased imports and include types
        expect(Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])).toContain(
          `//@ts-ignore\ndeclare module './src/utils/helper.js' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
        expect(Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])).toContain(
          `//@ts-ignore\ndeclare module './src/components/Button.jsx' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
      })
    })

    test('generates shopify.d.ts in the extension directory when importing files outside extension directory', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = joinPath(tmpDir, 'extensions', 'extension')
        const helpersDir = joinPath(tmpDir, 'helpers')
        const srcDir = joinPath(extensionDir, 'src')

        await mkdir(extensionDir)
        await mkdir(helpersDir)
        await mkdir(srcDir)

        await writeFile(joinPath(helpersDir, 'utils.ts'), 'export const helper = () => {};')

        const extensionContent = `import { helper } from '../../../helpers/utils.ts';\n// Extension code`
        await writeFile(joinPath(srcDir, 'index.jsx'), extensionContent)

        const nodeModulesPath = joinPath(tmpDir, 'node_modules', '@shopify', 'ui-extensions')
        await mkdir(nodeModulesPath)
        const targetPath = joinPath(nodeModulesPath, 'admin.product-details.action.render')
        await mkdir(targetPath)
        await writeFile(joinPath(targetPath, 'index.js'), '// Mock UI extension target')

        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        await writeFile(joinPath(extensionDir, 'tsconfig.json'), '{}')

        const allSpecs = await loadLocalExtensionsSpecifications()
        const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!

        const extension = new ExtensionInstance({
          configuration: {
            api_version: '2025-10',
            extension_points: [
              {
                target: 'admin.product-details.action.render',
                module: `./src/index.jsx`,
                build_manifest: {
                  assets: {
                    main: {
                      module: './src/index.jsx',
                    },
                  },
                },
              },
            ],
            name: 'Test UI Extension',
            type: 'ui_extension',
            metafields: [],
          },
          configurationPath: joinPath(extensionDir, 'shopify.extension.toml'),
          directory: extensionDir,
          specification,
          entryPath: joinPath(srcDir, 'index.jsx'),
        })

        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const rootShopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        expect(typeDefinitionsByFile.has(rootShopifyDtsPath)).toBe(false)

        const extensionShopifyDtsPath = joinPath(extensionDir, 'shopify.d.ts')
        expect(typeDefinitionsByFile.has(extensionShopifyDtsPath)).toBe(true)

        const extensionTypes = typeDefinitionsByFile.get(extensionShopifyDtsPath)
        expect(Array.from(extensionTypes ?? [])).toContain(
          `//@ts-ignore\ndeclare module './src/index.jsx' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )

        expect(Array.from(extensionTypes ?? [])).not.toContain(expect.stringContaining('helpers/utils.ts'))
      })
    })

    test('generates type definitions for files imported from extension root directory', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = tmpDir
        const srcDir = joinPath(extensionDir, 'src')
        await mkdir(srcDir)

        // Create shared file at the root of extension directory
        await writeFile(joinPath(extensionDir, 'shared_file.ts'), 'export const sharedUtil = () => "shared";')

        // Create package.json
        await writeFile(joinPath(extensionDir, 'package.json'), '{"name": "test-extension"}')

        // Create main extension file that imports from root
        const extensionContent = `import { sharedUtil } from '../shared_file.ts';\n// Extension code using shared file`
        await writeFile(joinPath(srcDir, 'extension.ts'), extensionContent)

        // Set up node_modules structure
        const nodeModulesPath = joinPath(extensionDir, 'node_modules', '@shopify', 'ui-extensions')
        await mkdir(nodeModulesPath)
        const targetPath = joinPath(nodeModulesPath, 'admin.product-details.action.render')
        await mkdir(targetPath)
        await writeFile(joinPath(targetPath, 'index.js'), '// Mock UI extension target')

        // Create tsconfig.json in extension root
        await writeFile(joinPath(extensionDir, 'tsconfig.json'), '{}')

        // Create extension instance
        const allSpecs = await loadLocalExtensionsSpecifications()
        const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!

        const extension = new ExtensionInstance({
          configuration: {
            // Remote DOM supported version
            api_version: '2025-10',
            extension_points: [
              {
                target: 'admin.product-details.action.render',
                module: `./src/extension.ts`,
                build_manifest: {
                  assets: {
                    main: {
                      module: './src/extension.ts',
                    },
                  },
                },
              },
            ],
            name: 'Test UI Extension',
            type: 'ui_extension',
            metafields: [],
          },
          configurationPath: joinPath(extensionDir, 'shopify.extension.toml'),
          directory: extensionDir,
          specification,
          entryPath: joinPath(srcDir, 'extension.ts'),
        })

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(extensionDir, 'shopify.d.ts')
        const types = typeDefinitionsByFile.get(shopifyDtsPath)

        // Then - should include type definition for both the main file and the root-level shared file
        expect(Array.from(types ?? [])).toContain(
          `//@ts-ignore\ndeclare module './src/extension.ts' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
        expect(Array.from(types ?? [])).toContain(
          `//@ts-ignore\ndeclare module './shared_file.ts' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
      })
    })

    test('handles complex directory structure with root-level imports and nested files', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = tmpDir
        const srcDir = joinPath(extensionDir, 'src')
        const componentsDir = joinPath(srcDir, 'components')
        await mkdir(srcDir)
        await mkdir(componentsDir)

        // Create multiple files at the root
        await writeFile(joinPath(extensionDir, 'shared_file.ts'), 'export const sharedUtil = () => "shared";')
        await writeFile(joinPath(extensionDir, 'utils.js'), 'export const utilFunc = () => "util";')
        await writeFile(joinPath(extensionDir, 'package.json'), '{"name": "test-extension"}')

        // Main extension file imports from root
        const extensionContent = `
          import { sharedUtil } from '../shared_file.ts';
          import { utilFunc } from '../utils.js';
          // Extension code
        `
        await writeFile(joinPath(srcDir, 'extension.ts'), extensionContent)

        // Component also imports from root (this pattern might reveal issues)
        const componentContent = `
          import { sharedUtil } from '../../shared_file.ts';
          import { utilFunc } from '../../utils.js';
          // Component code
        `
        await writeFile(joinPath(componentsDir, 'Component.jsx'), componentContent)

        // Add import from extension to component
        const updatedExtensionContent = `
          import { sharedUtil } from '../shared_file.ts';
          import { utilFunc } from '../utils.js';
          import './components/Component.jsx';
          // Extension code
        `
        await writeFile(joinPath(srcDir, 'extension.ts'), updatedExtensionContent)

        // Set up node_modules
        const nodeModulesPath = joinPath(extensionDir, 'node_modules', '@shopify', 'ui-extensions')
        await mkdir(nodeModulesPath)
        const targetPath = joinPath(nodeModulesPath, 'admin.product-details.action.render')
        await mkdir(targetPath)
        await writeFile(joinPath(targetPath, 'index.js'), '// Mock UI extension target')

        await writeFile(joinPath(extensionDir, 'tsconfig.json'), '{}')

        const allSpecs = await loadLocalExtensionsSpecifications()
        const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!

        const extension = new ExtensionInstance({
          configuration: {
            // Remote DOM supported version
            api_version: '2025-10',
            extension_points: [
              {
                target: 'admin.product-details.action.render',
                module: `./src/extension.ts`,
                build_manifest: {
                  assets: {
                    main: {
                      module: './src/extension.ts',
                    },
                  },
                },
              },
            ],
            name: 'Test UI Extension',
            type: 'ui_extension',
            metafields: [],
          },
          configurationPath: joinPath(extensionDir, 'shopify.extension.toml'),
          directory: extensionDir,
          specification,
          entryPath: joinPath(srcDir, 'extension.ts'),
        })

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(extensionDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should include type definitions for all files:
        // main file, component, and both root-level shared files
        expect(types).toContain(
          `//@ts-ignore\ndeclare module './src/extension.ts' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
        expect(types).toContain(
          `//@ts-ignore\ndeclare module './src/components/Component.jsx' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
        expect(types).toContain(
          `//@ts-ignore\ndeclare module './shared_file.ts' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
        expect(types).toContain(
          `//@ts-ignore\ndeclare module './utils.js' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )
      })
    })

    test('generates type definitions for chained imports: extension → component → root-level shared file', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const extensionDir = tmpDir
        const srcDir = joinPath(extensionDir, 'src')
        const componentsDir = joinPath(srcDir, 'components')
        await mkdir(srcDir)
        await mkdir(componentsDir)

        // Create shared file at the root
        const sharedUtilsContent = `
          export const formatPrice = (price) => \`$\${price}\`;
          export const validateInput = (input) => input?.length > 0;
        `
        await writeFile(joinPath(extensionDir, 'shared_utils.ts'), sharedUtilsContent)

        // Create package.json
        await writeFile(joinPath(extensionDir, 'package.json'), '{"name": "test-extension"}')

        // Create component that imports from root-level shared file
        const buttonContent = `
          import { formatPrice, validateInput } from '../../shared_utils.ts';

          export const Button = ({ price, label }) => {
            const isValid = validateInput(label);
            const formattedPrice = formatPrice(price);
            return isValid ? \`\${label}: \${formattedPrice}\` : 'Invalid';
          };
        `
        await writeFile(joinPath(componentsDir, 'Button.jsx'), buttonContent)

        // Create main extension file that imports the component (but not directly the shared file)
        const extensionContent = `
          import { Button } from './components/Button.jsx';

          // Extension code that uses Button component
          // Note: extension doesn't directly import shared_utils.ts
          const renderButton = () => Button({ price: 99, label: 'Buy Now' });
        `
        await writeFile(joinPath(srcDir, 'extension.ts'), extensionContent)

        // Set up node_modules
        const nodeModulesPath = joinPath(extensionDir, 'node_modules', '@shopify', 'ui-extensions')
        await mkdir(nodeModulesPath)
        const targetPath = joinPath(nodeModulesPath, 'admin.product-details.action.render')
        await mkdir(targetPath)
        await writeFile(joinPath(targetPath, 'index.js'), '// Mock UI extension target')

        await writeFile(joinPath(extensionDir, 'tsconfig.json'), '{}')

        const allSpecs = await loadLocalExtensionsSpecifications()
        const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!

        const extension = new ExtensionInstance({
          configuration: {
            // Remote DOM supported version
            api_version: '2025-10',
            extension_points: [
              {
                target: 'admin.product-details.action.render',
                module: `./src/extension.ts`,
                build_manifest: {
                  assets: {
                    main: {
                      module: './src/extension.ts',
                    },
                  },
                },
              },
            ],
            name: 'Test UI Extension',
            type: 'ui_extension',
            metafields: [],
          },
          configurationPath: joinPath(extensionDir, 'shopify.extension.toml'),
          directory: extensionDir,
          specification,
          entryPath: joinPath(srcDir, 'extension.ts'),
        })

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(extensionDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should include type definitions for all files in the chain:
        // 1. Main extension file
        expect(types).toContain(
          `//@ts-ignore\ndeclare module './src/extension.ts' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )

        // 2. Component file that imports from root
        expect(types).toContain(
          `//@ts-ignore\ndeclare module './src/components/Button.jsx' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )

        // 3. Root-level shared file (imported by component, not directly by extension)
        expect(types).toContain(
          `//@ts-ignore\ndeclare module './shared_utils.ts' {\n  const shopify: import('@shopify/ui-extensions/admin.product-details.action.render').Api;\n  const globalThis: { shopify: typeof shopify };\n}\n`,
        )

        // Verify we have exactly 3 type definitions (no duplicates)
        expect(types).toHaveLength(3)
      })
    })

    test('generates shopify.d.ts with ShopifyTools interface when tools file is present', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Extension code',
          apiVersion: '2025-10',
        })

        // Create tools.json file
        const toolsContent = JSON.stringify([
          {
            name: 'search_products',
            description: 'Search for products by query',
            inputSchema: {
              type: 'object',
              properties: {
                query: {type: 'string'},
              },
              required: ['query'],
            },
            outputSchema: {
              type: 'object',
              properties: {
                products: {type: 'array', items: {type: 'string'}},
              },
            },
          },
        ])
        await writeFile(joinPath(tmpDir, 'tools.json'), toolsContent)

        // Update extension configuration to include tools
        extension.configuration.extension_points[0]!.tools = './tools.json'

        // Create tsconfig.json
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should include ShopifyTools interface and tool type definitions
        expect(types).toHaveLength(1)
        const typeDefinition = types[0]!
        expect(typeDefinition).toContain('interface ShopifyTools')
        expect(typeDefinition).toContain('interface SearchProductsInput')
        expect(typeDefinition).toContain('interface SearchProductsOutput')
        expect(typeDefinition).toContain("name: 'search_products'")
        expect(typeDefinition).toContain("import('@shopify/ui-extensions/admin').WithGeneratedTools<")
        expect(typeDefinition).not.toContain('interface GeneratedToolsConstraint<Tools>')
      })
    })

    test('generates shopify.d.ts with multiple tools in ShopifyTools interface', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Extension code',
          apiVersion: '2025-10',
        })

        // Create tools.json file with multiple tools
        const toolsContent = JSON.stringify([
          {
            name: 'get_product',
            description: 'Get product by ID',
            inputSchema: {
              type: 'object',
              properties: {
                productId: {type: 'string'},
              },
              required: ['productId'],
            },
            outputSchema: {
              type: 'object',
              properties: {
                title: {type: 'string'},
                price: {type: 'number'},
              },
            },
          },
          {
            name: 'update_inventory',
            description: 'Update inventory count',
            inputSchema: {
              type: 'object',
              properties: {
                sku: {type: 'string'},
                quantity: {type: 'number'},
              },
              required: ['sku', 'quantity'],
            },
          },
        ])
        await writeFile(joinPath(tmpDir, 'tools.json'), toolsContent)

        // Update extension configuration to include tools
        extension.configuration.extension_points[0]!.tools = './tools.json'

        // Create tsconfig.json
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should include type definitions for both tools
        expect(types).toHaveLength(1)
        const typeDefinition = types[0]!
        expect(typeDefinition).toContain('interface ShopifyTools')
        expect(typeDefinition).toContain('interface GetProductInput')
        expect(typeDefinition).toContain('interface GetProductOutput')
        expect(typeDefinition).toContain("name: 'get_product'")
        expect(typeDefinition).toContain('interface UpdateInventoryInput')
        expect(typeDefinition).toContain('type UpdateInventoryOutput = unknown')
        expect(typeDefinition).toContain("name: 'update_inventory'")
      })
    })

    test('does not include ShopifyTools when tools file does not exist', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Extension code',
          apiVersion: '2025-10',
        })

        // Update extension configuration to reference a non-existent tools file
        extension.configuration.extension_points[0]!.tools = './non-existent-tools.json'

        // Create tsconfig.json
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should generate type definition without ShopifyTools
        expect(types).toHaveLength(1)
        const typeDefinition = types[0]!
        expect(typeDefinition).not.toContain('ShopifyTools')
        expect(typeDefinition).toContain("import('@shopify/ui-extensions/admin.product-details.action.render').Api")
      })
    })

    test('does not include ShopifyTools when tools file has invalid JSON', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Extension code',
          apiVersion: '2025-10',
        })

        // Create invalid tools.json file
        await writeFile(joinPath(tmpDir, 'tools.json'), 'not valid json {{{')

        // Update extension configuration to include tools
        extension.configuration.extension_points[0]!.tools = './tools.json'

        // Create tsconfig.json
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should generate type definition without ShopifyTools (graceful fallback)
        expect(types).toHaveLength(1)
        const typeDefinition = types[0]!
        expect(typeDefinition).not.toContain('ShopifyTools')
      })
    })

    test('does not include ShopifyTools when tools file has invalid schema', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Extension code',
          apiVersion: '2025-10',
        })

        // Create tools.json with invalid schema (missing required fields)
        const invalidToolsContent = JSON.stringify([
          {
            name: 'incomplete_tool',
            // missing description and inputSchema
          },
        ])
        await writeFile(joinPath(tmpDir, 'tools.json'), invalidToolsContent)

        // Update extension configuration to include tools
        extension.configuration.extension_points[0]!.tools = './tools.json'

        // Create tsconfig.json
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should generate type definition without ShopifyTools (graceful fallback)
        expect(types).toHaveLength(1)
        const typeDefinition = types[0]!
        expect(typeDefinition).not.toContain('ShopifyTools')
      })
    })

    test('generates ShopifyTools only for entry point file, not for imported files', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: `
            import './utils/helper.js';
            // Main extension code
          `,
          apiVersion: '2025-10',
        })

        // Create imported file
        const utilsDir = joinPath(tmpDir, 'src', 'utils')
        await mkdir(utilsDir)
        await writeFile(joinPath(utilsDir, 'helper.js'), 'export const helper = () => {};')

        // Create tools.json file
        const toolsContent = JSON.stringify([
          {
            name: 'my_tool',
            description: 'A tool',
            inputSchema: {type: 'object'},
          },
        ])
        await writeFile(joinPath(tmpDir, 'tools.json'), toolsContent)

        // Update extension configuration to include tools
        extension.configuration.extension_points[0]!.tools = './tools.json'

        // Create tsconfig.json
        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should have 2 type definitions (entry point and helper)
        expect(types).toHaveLength(2)

        // Entry point should have ShopifyTools
        const entryPointType = types.find((t) => t.includes('./src/index.jsx'))
        expect(entryPointType).toContain('ShopifyTools')
        expect(entryPointType).toContain("import('@shopify/ui-extensions/admin').WithGeneratedTools<")

        // Imported file should NOT have ShopifyTools
        const helperType = types.find((t) => t.includes('./src/utils/helper.js'))
        expect(helperType).not.toContain('ShopifyTools')
      })
    })

    test('generates shopify.d.ts with generated intent request and response types when intent schema is present', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Extension code',
          apiVersion: '2025-10',
          target: 'admin.app.intent.render',
        })

        const intentSchemaContent = JSON.stringify({
          inputSchema: {
            type: 'object',
            properties: {
              recipient: {type: 'string'},
            },
            required: ['recipient'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: {type: 'boolean'},
            },
          },
        })
        await writeFile(joinPath(tmpDir, 'intent-schema.json'), intentSchemaContent)
        extension.configuration.extension_points[0]!.intents = [
          {
            action: 'create',
            type: 'application/email',
            schema: './intent-schema.json',
          },
        ]

        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then
        expect(types).toHaveLength(1)
        const typeDefinition = types[0]!
        expect(typeDefinition).toContain('interface CreateApplicationEmailIntentInput')
        expect(typeDefinition).toContain('interface CreateApplicationEmailIntentRequest')
        expect(typeDefinition).toContain(`action: 'create';`)
        expect(typeDefinition).toContain(`type: 'application/email';`)
        expect(typeDefinition).not.toContain('interface ShopifyGeneratedIntentResponse<Data = unknown>')
        expect(typeDefinition).not.toContain('interface ShopifyGeneratedIntentsApi<')
        expect(typeDefinition).toContain('type ShopifyGeneratedIntentVariants =')
        expect(typeDefinition).toContain("import('@shopify/ui-extensions/admin').ShopifyGeneratedIntentVariant<")
        expect(typeDefinition).toContain('CreateApplicationEmailIntentRequest')
        expect(typeDefinition).toContain('CreateApplicationEmailIntentOutput')
        expect(typeDefinition).toContain("import('@shopify/ui-extensions/admin').WithGeneratedIntents<")
      })
    })

    test('uses the target surface package for generated helper types', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Extension code',
          apiVersion: '2025-10',
          target: 'purchase.checkout.block.render',
        })

        const toolsContent = JSON.stringify([
          {
            name: 'my_tool',
            description: 'A tool',
            inputSchema: {type: 'object'},
          },
        ])
        await writeFile(joinPath(tmpDir, 'tools.json'), toolsContent)
        extension.configuration.extension_points[0]!.tools = './tools.json'

        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then
        expect(types).toHaveLength(1)
        const typeDefinition = types[0]!
        expect(typeDefinition).toContain("import('@shopify/ui-extensions/checkout').WithGeneratedTools<")
        expect(typeDefinition).not.toContain("import('@shopify/ui-extensions/admin').WithGeneratedTools<")
      })
    })

    test('warns and skips intent type generation when the schema file is missing', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()
      const outputWarnSpy = vi.spyOn(output, 'outputWarn').mockImplementation(() => {})

      try {
        await inTemporaryDirectory(async (tmpDir) => {
          const {extension} = await setupUIExtensionWithNodeModules({
            tmpDir,
            fileContent: '// Extension code',
            apiVersion: '2025-10',
            target: 'admin.app.intent.render',
          })

          extension.configuration.extension_points[0]!.intents = [
            {
              action: 'create',
              type: 'application/email',
              schema: './missing-intent-schema.json',
            },
          ]

          await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

          // When
          await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

          const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
          const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

          // Then
          expect(outputWarnSpy).toHaveBeenCalledWith(
            'Intent schema file "./missing-intent-schema.json" was not found. Skipping intent type generation.',
          )
          expect(types).toHaveLength(1)
          expect(types[0]).not.toContain('ShopifyGeneratedIntentVariants')
        })
      } finally {
        outputWarnSpy.mockRestore()
      }
    })

    test('throws when intent action/type pairs are duplicated for an entry point', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Extension code',
          apiVersion: '2025-10',
          target: 'admin.app.intent.render',
        })

        const intentSchemaContent = JSON.stringify({
          inputSchema: {
            type: 'object',
          },
        })
        await writeFile(joinPath(tmpDir, 'intent-schema.json'), intentSchemaContent)
        extension.configuration.extension_points[0]!.intents = [
          {
            action: 'create',
            type: 'application/email',
            schema: './intent-schema.json',
          },
          {
            action: 'create',
            type: 'application/email',
            schema: './intent-schema.json',
          },
        ]

        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When/Then
        await expect(extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)).rejects.toThrow(
          new AbortError(
            'Intent "create:application/email" is defined multiple times. Intents must be unique within a target.',
          ),
        )
      })
    })

    test('generates intent types only for entry point file, not for imported files', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: `
            import './utils/helper.js';
            // Main extension code
          `,
          apiVersion: '2025-10',
          target: 'admin.app.intent.render',
        })

        const utilsDir = joinPath(tmpDir, 'src', 'utils')
        await mkdir(utilsDir)
        await writeFile(joinPath(utilsDir, 'helper.js'), 'export const helper = () => {};')

        const intentSchemaContent = JSON.stringify({
          inputSchema: {
            type: 'object',
            properties: {
              recipient: {type: 'string'},
            },
          },
        })
        await writeFile(joinPath(tmpDir, 'intent-schema.json'), intentSchemaContent)
        extension.configuration.extension_points[0]!.intents = [
          {
            action: 'create',
            type: 'application/email',
            schema: './intent-schema.json',
          },
        ]

        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - should have 2 type definitions (entry point and helper)
        expect(types).toHaveLength(2)

        const entryPointType = types.find((t) => t.includes('./src/index.jsx'))
        expect(entryPointType).toContain('ShopifyGeneratedIntentVariants')
        expect(entryPointType).toContain('CreateApplicationEmailIntentRequest')
        expect(entryPointType).toContain("import('@shopify/ui-extensions/admin').WithGeneratedIntents<")

        const helperType = types.find((t) => t.includes('./src/utils/helper.js'))
        expect(helperType).not.toContain('ShopifyGeneratedIntentVariants')
        expect(helperType).not.toContain('CreateApplicationEmailIntentRequest')
      })
    })

    test('generates intent types from an intent schema file that declares a value schema', async () => {
      const typeDefinitionsByFile = new Map<string, Set<string>>()

      await inTemporaryDirectory(async (tmpDir) => {
        const {extension} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileContent: '// Extension code',
          apiVersion: '2025-10',
          target: 'admin.app.intent.render',
        })

        // Given an intent schema file that declares a root-level `value` schema
        const intentSchemaContent = JSON.stringify({
          value: {
            type: 'object',
            properties: {
              productId: {type: 'string'},
            },
            required: ['productId'],
          },
          inputSchema: {
            type: 'object',
            properties: {
              title: {type: 'string'},
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: {type: 'string'},
            },
          },
        })
        await writeFile(joinPath(tmpDir, 'intent-schema.json'), intentSchemaContent)
        extension.configuration.extension_points[0]!.intents = [
          {
            action: 'edit',
            type: 'shopify/Product',
            schema: './intent-schema.json',
          },
        ]

        await writeFile(joinPath(tmpDir, 'tsconfig.json'), '{}')

        // When
        await extension.contributeToSharedTypeFile?.(typeDefinitionsByFile)

        const shopifyDtsPath = joinPath(tmpDir, 'shopify.d.ts')
        const types = Array.from(typeDefinitionsByFile.get(shopifyDtsPath) ?? [])

        // Then - the value schema is compiled into EditShopifyProductIntentValue
        // and wired through the request type.
        expect(types).toHaveLength(1)
        const typeDefinition = types[0]!
        expect(typeDefinition).toContain('interface EditShopifyProductIntentValue')
        expect(typeDefinition).toContain('productId: string;')
        expect(typeDefinition).toContain('value?: EditShopifyProductIntentValue;')
        // Sanity: the value type is not the `unknown` fallback used when no schema is provided.
        expect(typeDefinition).not.toContain('type EditShopifyProductIntentValue = unknown')
      })
    })
  })
})
