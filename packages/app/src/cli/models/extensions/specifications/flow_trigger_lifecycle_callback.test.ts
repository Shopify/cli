import {ExtensionInstance} from '../extension-instance.js'
import {loadLocalExtensionsSpecifications} from '../load-specifications.js'
import {placeholderAppConfiguration} from '../../app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('flow_trigger_lifecycle_callback', () => {
  test('resolves relative URLs against the app URL for deployment and the tunnel URL for dev', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const allSpecs = await loadLocalExtensionsSpecifications()
      const specification = allSpecs.find((spec) => spec.identifier === 'flow_trigger_lifecycle_callback')!
      const parsed = specification.parseConfigurationObject({
        type: 'flow_trigger_lifecycle_callback',
        name: 'Lifecycle callback',
        url: '/callback',
      })
      if (parsed.state !== 'ok') {
        throw new Error("Couldn't parse configuration")
      }

      const extension = new ExtensionInstance({
        configuration: parsed.data,
        directory: tmpDir,
        specification,
        configurationPath: joinPath(tmpDir, 'shopify.extension.toml'),
        entryPath: '',
      })

      const deployConfig = await extension.deployConfig({
        apiKey: 'apiKey',
        appConfiguration: {...placeholderAppConfiguration, application_url: 'https://my-app.example.com'},
      })
      expect(deployConfig).toEqual({
        name: 'Lifecycle callback',
        url: 'https://my-app.example.com/callback',
      })

      extension.patchWithAppDevURLs({
        applicationUrl: 'https://my-tunnel.example.com',
        redirectUrlWhitelist: [],
      })
      expect(extension.configuration).toMatchObject({url: 'https://my-tunnel.example.com/callback'})
    })
  })
})
