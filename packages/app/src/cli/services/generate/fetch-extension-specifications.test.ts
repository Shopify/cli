import {fetchSpecifications} from './fetch-extension-specifications.js'
import {testDeveloperPlatformClient, testOrganizationApp} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory, writeFile, mkdir, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('fetchExtensionSpecifications', () => {
  test('returns the filtered and mapped results including theme', async () => {
    // Given/When
    const got = await fetchSpecifications({
      developerPlatformClient: testDeveloperPlatformClient(),
      app: testOrganizationApp(),
    })

    // Then
    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Post-purchase UI',
          identifier: 'checkout_post_purchase',
          externalIdentifier: 'checkout_post_purchase_external',
          registrationLimit: 1,
          surface: 'post_purchase',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'Subscription UI',
          identifier: 'product_subscription',
          externalIdentifier: 'product_subscription_external',
          registrationLimit: 1,
          surface: 'admin',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'UI Extension',
          identifier: 'ui_extension',
          externalIdentifier: 'ui_extension_external',
          registrationLimit: 50,
          surface: 'all',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Product Subscription',
          externalName: 'Subscription UI',
          identifier: 'product_subscription',
          externalIdentifier: 'product_subscription_external',
          registrationLimit: 1,
          surface: 'admin',
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Online Store - App Theme Extension',
          externalName: 'Theme App Extension',
          identifier: 'theme',
          externalIdentifier: 'theme_external',
          registrationLimit: 1,
          surface: undefined,
        }),
      ]),
    )

    expect(got).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identifier: 'remote_only_extension_schema',
          uidStrategy: 'uuid',
        }),
        expect.objectContaining({
          identifier: 'remote_only_extension_schema_with_localization',
          uidStrategy: 'uuid',
        }),
        expect.not.objectContaining({
          identifier: 'remote_only_extension_without_schema',
        }),
        expect.objectContaining({
          identifier: 'remote_only_extension_schema_config_style',
          uidStrategy: 'single',
        }),
      ]),
    )

    const withoutLocalization = got.find((spec) => spec.identifier === 'remote_only_extension_schema')
    const withLocalization = got.find((spec) => spec.identifier === 'remote_only_extension_schema_with_localization')

    expect(withoutLocalization?.appModuleFeatures()).toEqual([])
    expect(withLocalization?.appModuleFeatures()).toEqual(['localization'])
  })

  describe('admin_link', () => {
    test('applies override with validate and copyStaticAssets methods', async () => {
      const got = await fetchSpecifications({
        developerPlatformClient: testDeveloperPlatformClient(),
        app: testOrganizationApp(),
      })

      const adminLink = got.find((spec) => spec.identifier === 'admin_link')

      expect(adminLink).toBeDefined()
      expect(adminLink?.identifier).toBe('admin_link')
      expect(adminLink?.validate).toBeDefined()
      expect(adminLink?.copyStaticAssets).toBeDefined()
      expect(adminLink?.uidStrategy).toBe('uuid')
      expect(adminLink?.registrationLimit).toBe(10)
    })

    test('remote schema validates configuration', async () => {
      const got = await fetchSpecifications({
        developerPlatformClient: testDeveloperPlatformClient(),
        app: testOrganizationApp(),
      })

      const adminLink = got.find((spec) => spec.identifier === 'admin_link')
      expect(adminLink).toBeDefined()

      const validConfig = {
        targeting: [
          {
            target: 'admin.product.details.action',
            tools: './tools.json',
          },
        ],
        name: 'Test Admin Link',
        type: 'admin_link' as const,
        handle: 'test-admin-link',
      }

      const parsed = adminLink?.parseConfigurationObject(validConfig)

      expect(parsed?.state).toBe('ok')
      if (parsed?.state === 'ok') {
        const data = parsed.data as {name?: string; targeting?: {target: string}[]}
        expect(data.name).toBe('Test Admin Link')
        expect(data.targeting).toBeDefined()
        expect(data.targeting?.[0]?.target).toBe('admin.product.details.action')
      }

      const invalidConfig = {
        targeting: [
          {
            target: 'admin.product.details.action',
          },
        ],
        type: 'admin_link' as const,
      }

      const parsedInvalid = adminLink?.parseConfigurationObject(invalidConfig)

      expect(parsedInvalid?.state).toBe('error')
      if (parsedInvalid?.state === 'error') {
        expect(parsedInvalid.errors.length).toBeGreaterThan(0)
        const nameError = parsedInvalid.errors.find((err) => err.path?.includes('name'))
        expect(nameError).toBeDefined()
      }
    })

    test('validate works with fetched admin_link spec', async () => {
      const got = await fetchSpecifications({
        developerPlatformClient: testDeveloperPlatformClient(),
        app: testOrganizationApp(),
      })

      const adminLink = got.find((spec) => spec.identifier === 'admin_link')
      expect(adminLink).toBeDefined()
      expect(adminLink?.validate).toBeDefined()

      await inTemporaryDirectory(async (tmpDir) => {
        await writeFile(joinPath(tmpDir, 'tools.json'), '{"tools": []}')
        await writeFile(joinPath(tmpDir, 'instructions.md'), '# Instructions')

        const config = {
          targeting: [
            {
              target: 'admin.product.details.action',
              tools: './tools.json',
              instructions: './instructions.md',
              build_manifest: {
                assets: {
                  tools: {
                    filepath: 'test-tools.json',
                    module: './tools.json',
                    static: true,
                  },
                  instructions: {
                    filepath: 'test-instructions.md',
                    module: './instructions.md',
                    static: true,
                  },
                },
              },
            },
          ],
          name: 'Test',
          type: 'admin_link' as const,
        }

        const result = await adminLink!.validate!(config, '', tmpDir)
        expect(result).toMatchObject({value: {}})
      })
    })

    test('validate returns error when files are missing', async () => {
      const got = await fetchSpecifications({
        developerPlatformClient: testDeveloperPlatformClient(),
        app: testOrganizationApp(),
      })

      const adminLink = got.find((spec) => spec.identifier === 'admin_link')
      expect(adminLink).toBeDefined()

      await inTemporaryDirectory(async (tmpDir) => {
        const config = {
          targeting: [
            {
              target: 'admin.product.details.action',
              tools: './missing-tools.json',
              instructions: undefined,
              build_manifest: {
                assets: {
                  tools: {
                    filepath: 'test-tools.json',
                    module: './missing-tools.json',
                    static: true,
                  },
                },
              },
            },
          ],
          name: 'Test',
          type: 'admin_link' as const,
        }

        const result = await adminLink!.validate!(config, '', tmpDir)
        expect(result.isErr()).toBe(true)
        if (result.isErr()) {
          expect(result.error).toContain("Couldn't find")
          expect(result.error).toContain('missing-tools.json')
        }
      })
    })

    test('copyStaticAssets works with fetched admin_link spec', async () => {
      const got = await fetchSpecifications({
        developerPlatformClient: testDeveloperPlatformClient(),
        app: testOrganizationApp(),
      })

      const adminLink = got.find((spec) => spec.identifier === 'admin_link')
      expect(adminLink).toBeDefined()
      expect(adminLink?.copyStaticAssets).toBeDefined()

      await inTemporaryDirectory(async (tmpDir) => {
        const distDir = joinPath(tmpDir, 'dist')
        await mkdir(distDir)
        await writeFile(joinPath(tmpDir, 'tools.json'), '{"tools": []}')
        await writeFile(joinPath(tmpDir, 'instructions.md'), '# Instructions')

        const config = {
          targeting: [
            {
              target: 'admin.product.details.action',
              tools: './tools.json',
              instructions: './instructions.md',
              build_manifest: {
                assets: {
                  tools: {
                    filepath: 'test-tools.json',
                    module: './tools.json',
                    static: true,
                  },
                  instructions: {
                    filepath: 'test-instructions.md',
                    module: './instructions.md',
                    static: true,
                  },
                },
              },
            },
          ],
          name: 'Test',
          type: 'admin_link' as const,
        }

        await adminLink!.copyStaticAssets!(config, tmpDir, joinPath(distDir, 'extension.js'))

        expect(fileExistsSync(joinPath(distDir, 'test-tools.json'))).toBe(true)
        expect(fileExistsSync(joinPath(distDir, 'test-instructions.md'))).toBe(true)
      })
    })
  })
})
