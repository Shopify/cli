import * as loadLocales from '../../../utilities/extensions/locales-configuration.js'
import {ExtensionInstance} from '../extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {inTemporaryDirectory, touchFile, writeFile, readFile, mkdir, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {err, ok} from '@shopify/cli-kit/node/result'
import {zod} from '@shopify/cli-kit/node/schema'
import {afterEach, describe, expect, test, vi} from 'vitest'

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
    afterEach(() => {
      delete process.env.REMOTE_DOM_EXPERIMENT
    })

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

    test('uses Remote DOM imports for supported API versions when REMOTE_DOM_EXPERIMENT is true', async () => {
      process.env.REMOTE_DOM_EXPERIMENT = 'true'

      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          // Remote DOM supported API version
          apiVersion: '2025-07',
          extensionPoints: [
            {
              target: 'admin.product-details.block.render',
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
        expect(stdInContent).toBe(
          `import Target_0 from './src/ExtensionPointA.js'; shopify.extend('admin.product-details.block.render', () => Target_0());`,
        )
      })
    })

    test('uses regular imports for non-Remote DOM API versions when REMOTE_DOM_EXPERIMENT is true', async () => {
      process.env.REMOTE_DOM_EXPERIMENT = 'true'
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const uiExtension = await getTestUIExtension({
          directory: tmpDir,
          // Non-Remote DOM supported API version
          apiVersion: '2025-01',
          extensionPoints: [
            {
              target: 'admin.product-details.block.render',
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

  async function setupUIExtensionWithNodeModules({
    tmpDir,
    fileExtension,
    fileContent,
    remoteDom = false,
  }: {
    tmpDir: string
    fileExtension: string
    fileContent: string
    remoteDom?: boolean
  }) {
    const target = 'admin.product-details.block.render'
    // Create extension files
    const srcDir = joinPath(tmpDir, 'src')
    await mkdir(srcDir)
    const filePath = joinPath(srcDir, `index.${fileExtension}`)

    await writeFile(filePath, fileContent)

    // Create shopify.d.ts type file
    const typeFilePath = joinPath(tmpDir, 'shopify.d.ts')
    await writeFile(typeFilePath, '// Type definitions')

    // Create node_modules structure
    const nodeModulesPath = joinPath(tmpDir, 'node_modules', '@shopify', 'ui-extensions')
    await mkdir(nodeModulesPath)

    const targetPath = joinPath(nodeModulesPath, target)
    await mkdir(targetPath)
    const targetFilePath = joinPath(targetPath, 'index.js')
    await writeFile(targetFilePath, '// Mock UI extension target')

    const libraryPath = joinPath(nodeModulesPath, 'index.js')
    await writeFile(libraryPath, '// Mock UI extension library')

    // Get UI extension spec and create instance
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'ui_extension')!

    const extension = new ExtensionInstance({
      configuration: {
        // Remote DOM supported version
        api_version: remoteDom ? '2025-07' : '2025-01',
        extension_points: [
          {
            target,
            module: `./src/index.${fileExtension}`,
          },
        ],
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
      srcDir,
      typeFilePath,
      filePath,
      libraryPath,
      extension,
    }
  }

  describe('contributeToSharedTypeFile with Remote DOM API version', () => {
    test('updates TS modules with type reference and returns shared types definition', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, typeFilePath, filePath, libraryPath, srcDir} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileExtension: 'ts',
          fileContent: '// TS code',
          remoteDom: true,
        })

        // When
        const result = await extension.contributeToSharedTypeFile?.(typeFilePath)

        // Then
        expect(result).toHaveLength(1)

        const expectedDefinition = `declare module './src/index.ts' {
  const globalThis: typeof import('./node_modules/@shopify/ui-extensions/admin.product-details.block.render/index.js');
  const shopify: import('./node_modules/@shopify/ui-extensions/admin.product-details.block.render/index.js').Api;
}\n`
        expect(result[0]?.definition).toBe(expectedDefinition)
        expect(result[0]?.libraryRoot.replace(/\\/g, '/')).toBe(libraryPath.replace(/\\/g, '/'))

        // Check if the TS file was updated with reference
        const moduleFileContent = await readFile(filePath)
        expect(moduleFileContent.toString()).toContain('/// <reference types="../shopify.d.ts" />')

        // Should not create a .d.ts file
        await expect(fileExists(joinPath(srcDir, 'index.ts.d.ts'))).resolves.toBe(false)
      })
    })

    test('updates TSX modules with type reference and returns shared types definition', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, typeFilePath, filePath, libraryPath, srcDir} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileExtension: 'tsx',
          fileContent: '// TSX code',
          remoteDom: true,
        })

        // When
        const result = await extension.contributeToSharedTypeFile?.(typeFilePath)

        // Then
        expect(result).toHaveLength(1)

        const expectedDefinition = `declare module './src/index.tsx' {
  const globalThis: typeof import('./node_modules/@shopify/ui-extensions/admin.product-details.block.render/index.js');
  const shopify: import('./node_modules/@shopify/ui-extensions/admin.product-details.block.render/index.js').Api;
}\n`
        expect(result[0]?.definition).toBe(expectedDefinition)
        expect(result[0]?.libraryRoot.replace(/\\/g, '/')).toBe(libraryPath.replace(/\\/g, '/'))

        // TSX file should have type reference
        const moduleFileContent = await readFile(filePath)
        expect(moduleFileContent.toString()).toContain('/// <reference types="../shopify.d.ts" />')

        // Should not create a .d.ts file
        await expect(fileExists(joinPath(srcDir, 'index.tsx.d.ts'))).resolves.toBe(false)
      })
    })

    test('updates JSX modules with a local .d.ts type reference instead of return shared types definition', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, typeFilePath, filePath, srcDir} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileExtension: 'jsx',
          fileContent: '// JSX code',
          remoteDom: true,
        })

        // When
        const result = await extension.contributeToSharedTypeFile?.(typeFilePath)

        // Then
        expect(result).not.toBeUndefined()
        expect(result).toEqual([])

        // JSX file should have type reference comment
        const moduleFileContent = await readFile(filePath)
        expect(moduleFileContent.toString()).toBe('/// <reference types="./index.d.ts" />\n// JSX code')

        // Should create a .d.ts file next to the JSX file
        await expect(fileExists(joinPath(srcDir, 'index.d.ts'))).resolves.toBe(true)
      })
    })

    test('updates JS modules with a local .d.ts type reference instead of return shared types definition', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, typeFilePath, filePath, srcDir} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileExtension: 'js',
          fileContent: '// JavaScript code',
          remoteDom: true,
        })

        // When
        const result = await extension.contributeToSharedTypeFile?.(typeFilePath)

        // Then
        expect(result).not.toBeUndefined()
        expect(Array.isArray(result)).toBe(true)
        expect(result).toEqual([])

        // JS file should have type reference comment
        const moduleFileContent = await readFile(filePath)
        expect(moduleFileContent.toString()).toBe('/// <reference types="./index.d.ts" />\n// JavaScript code')

        // Should create a .d.ts file next to the JS file
        await expect(fileExists(joinPath(srcDir, 'index.d.ts'))).resolves.toBe(true)
      })
    })
  })

  describe('contributeToSharedTypeFile with non-Remote DOM API version', () => {
    test('returns empty shared types definition for TS modules and leaves file unchanged', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, typeFilePath, filePath, srcDir} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileExtension: 'ts',
          fileContent: '// TypeScript code',
          remoteDom: false,
        })

        // When
        const result = await extension.contributeToSharedTypeFile?.(typeFilePath)

        // Then
        expect(result).toEqual([])

        // TS file should remain unchanged
        const moduleFileContent = await readFile(filePath)
        expect(moduleFileContent.toString()).toBe('// TypeScript code')

        // Should not create a .d.ts file
        await expect(fileExists(joinPath(srcDir, 'index.ts.d.ts'))).resolves.toBe(false)
      })
    })

    test('returns empty shared types definition for TSX modules and leaves file unchanged', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, typeFilePath, filePath, srcDir} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileExtension: 'tsx',
          fileContent: '// TypeScript React code',
          remoteDom: false,
        })

        // When
        const result = await extension.contributeToSharedTypeFile?.(typeFilePath)

        // Then
        expect(result).toEqual([])

        // TSX file should remain unchanged
        const moduleFileContent = await readFile(filePath)
        expect(moduleFileContent.toString()).toBe('// TypeScript React code')

        // Should not create a .d.ts file
        await expect(fileExists(joinPath(srcDir, 'index.tsx.d.ts'))).resolves.toBe(false)
      })
    })

    test('does not create local .d.ts file for JSX modules and leaves file unchanged', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, typeFilePath, filePath, srcDir} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileExtension: 'jsx',
          fileContent: '// JSX code',
          remoteDom: false,
        })
        // When
        const result = await extension.contributeToSharedTypeFile?.(typeFilePath)

        // Then
        expect(result).toEqual([])

        // JSX file should remain unchanged
        const moduleFileContent = await readFile(filePath)
        expect(moduleFileContent.toString()).toBe('// JSX code')

        // Should not create a .d.ts file next to the JSX file
        await expect(fileExists(joinPath(srcDir, 'index.d.ts'))).resolves.toBe(false)
      })
    })

    test('does not create local .d.ts file for JS modules and leaves file unchanged', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const {extension, typeFilePath, filePath, srcDir} = await setupUIExtensionWithNodeModules({
          tmpDir,
          fileExtension: 'js',
          fileContent: '// JavaScript code',
          remoteDom: false,
        })

        // When
        const result = await extension.contributeToSharedTypeFile?.(typeFilePath)

        // Then
        expect(result).toEqual([])

        // JS file should remain unchanged
        const moduleFileContent = await readFile(filePath)
        expect(moduleFileContent.toString()).toBe('// JavaScript code')

        // Should not create a .d.ts file next to the JS file
        await expect(fileExists(joinPath(srcDir, 'index.d.ts'))).resolves.toBe(false)
      })
    })
  })
})
