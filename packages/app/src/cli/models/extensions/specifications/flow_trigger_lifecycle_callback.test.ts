import {ExtensionInstance} from '../extension-instance.js'
import {placeholderAppConfiguration, testDeveloperPlatformClient, testOrganizationApp} from '../../app/app.test-data.js'
import {RemoteSpecification} from '../../../api/graphql/extension_specifications.js'
import {fetchSpecifications} from '../../../services/generate/fetch-extension-specifications.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('flow_trigger_lifecycle_callback', () => {
  test('resolves relative URLs against the app URL for deployment and the tunnel URL for dev', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const remoteSpec: RemoteSpecification = {
        name: 'Flow trigger lifecycle callback',
        externalName: 'Flow trigger lifecycle callback',
        identifier: 'flow_trigger_lifecycle_callback',
        externalIdentifier: 'flow_trigger_lifecycle_callback',
        experience: 'extension',
        managementExperience: 'cli',
        gated: false,
        registrationLimit: 1,
        uidStrategy: 'uuid',
        validationSchema: {
          jsonSchema: JSON.stringify({
            type: 'object',
            properties: {
              name: {type: 'string'},
              url: {type: 'string', pattern: '^(https://|/[^/])'},
            },
            required: ['url'],
            additionalProperties: false,
          }),
        },
      }
      const allSpecs = await fetchSpecifications({
        developerPlatformClient: testDeveloperPlatformClient({specifications: async () => [remoteSpec]}),
        app: testOrganizationApp(),
      })
      const specification = allSpecs.find((spec) => spec.identifier === 'flow_trigger_lifecycle_callback')!
      expect(specification.parseConfigurationObject({url: 42}).state).toBe('error')
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
