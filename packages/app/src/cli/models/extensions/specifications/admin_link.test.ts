import * as loadLocales from '../../../utilities/extensions/locales-configuration.js'
import {ExtensionInstance} from '../extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'

describe('admin_link', async () => {
  async function getTestAdminLink(directory: string, configuration: Record<string, unknown> = {}) {
    const configurationPath = joinPath(directory, 'shopify.extension.toml')
    const allSpecs = await loadLocalExtensionsSpecifications()
    const specification = allSpecs.find((spec) => spec.identifier === 'admin_link')!
    const parsed = specification.parseConfigurationObject(configuration)
    if (parsed.state !== 'ok') {
      throw new Error("Couldn't parse configuration")
    }

    return new ExtensionInstance({
      configuration: parsed.data,
      directory,
      specification,
      configurationPath,
      entryPath: '',
    })
  }

  test('has the correct identifier', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = await getTestAdminLink(tmpDir)
      expect(extension.specification.identifier).toBe('admin_link')
    })
  })

  test('has localization and ui_preview in appModuleFeatures', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = await getTestAdminLink(tmpDir)
      expect(extension.specification.appModuleFeatures()).toContain('localization')
      expect(extension.specification.appModuleFeatures()).toContain('ui_preview')
    })
  })

  test('is previewable', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = await getTestAdminLink(tmpDir)
      expect(extension.isPreviewable).toBe(true)
    })
  })

  test('has include_assets client step with generatesAssetsManifest enabled', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const extension = await getTestAdminLink(tmpDir)
      const clientSteps = extension.specification.clientSteps!
      expect(clientSteps).toHaveLength(1)
      expect(clientSteps[0]!.lifecycle).toBe('build')

      const steps = clientSteps[0]!.steps
      expect(steps).toHaveLength(1)
      expect(steps[0]).toMatchObject({
        id: 'include-admin-link-assets',
        name: 'Include Admin Link Assets',
        type: 'include_assets',
        config: {
          generatesAssetsManifest: true,
          inclusions: [
            {type: 'configKey', anchor: 'targeting[]', groupBy: 'target', key: 'targeting[].tools'},
            {type: 'configKey', anchor: 'targeting[]', groupBy: 'target', key: 'targeting[].instructions'},
            {type: 'configKey', anchor: 'targeting[]', groupBy: 'target', key: 'targeting[].intents[].schema'},
          ],
        },
      })
    })
  })

  describe('deployConfig()', () => {
    test('includes localization in deploy config', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const localization = {
          default_locale: 'en',
          translations: {title: 'Hello!'},
        }
        vi.spyOn(loadLocales, 'loadLocalesConfig').mockResolvedValue(localization)

        const extension = await getTestAdminLink(tmpDir, {
          name: 'My Admin Link',
          targeting: [{url: 'https://example.com'}],
        })

        const deployConfig = await extension.deployConfig({
          apiKey: 'apiKey',
          appConfiguration: placeholderAppConfiguration,
        })

        expect(deployConfig).toMatchObject({localization})
        expect(loadLocales.loadLocalesConfig).toHaveBeenCalledWith(tmpDir, 'admin_link')
      })
    })

    test('strips first-class fields from deploy config', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        vi.spyOn(loadLocales, 'loadLocalesConfig').mockResolvedValue({})

        const extension = await getTestAdminLink(tmpDir, {
          type: 'admin_link',
          handle: 'my-link',
          name: 'My Admin Link',
          targeting: [{url: 'https://example.com'}],
        })

        const deployConfig = await extension.deployConfig({
          apiKey: 'apiKey',
          appConfiguration: placeholderAppConfiguration,
        })

        expect(deployConfig).not.toHaveProperty('type')
        expect(deployConfig).not.toHaveProperty('handle')
        expect(deployConfig).toHaveProperty('name', 'My Admin Link')
        expect(deployConfig).toHaveProperty('targeting')
      })
    })
  })
})
