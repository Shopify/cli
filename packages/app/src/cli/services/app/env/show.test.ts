import {getAppEnv} from './show.js'
import {logMetadataForLoadedContext} from '../../context.js'
import {AppInterface} from '../../../models/app/app.js'
import {
  testApp,
  testOrganizationApp,
  testOrganizationAppWithoutClientSecret,
  testDeveloperPlatformClient,
} from '../../../models/app/app.test-data.js'
import {OrganizationSource} from '../../../models/organization.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, expect, test, vi} from 'vitest'

vi.mock('../../context.js')

const organization = {id: '123', businessName: 'test', source: OrganizationSource.BusinessPlatform}

afterEach(() => {
  vi.unstubAllEnvs()
})

test('returns the environment facts and records analytics metadata', async () => {
  const app = mockApp()
  const remoteApp = testOrganizationApp()

  const result = await getAppEnv(app, remoteApp, organization)

  expect(result).toEqual({
    variables: [
      {name: 'SHOPIFY_API_KEY', value: remoteApp.apiKey, isSecret: false},
      {name: 'SHOPIFY_API_SECRET', value: 'api-secret', isSecret: true},
      {name: 'SCOPES', value: 'my-scope', isSecret: false},
    ],
  })
  expect(logMetadataForLoadedContext).toHaveBeenCalledWith(remoteApp, organization.source)
})

test('fetches the client secret when the app lookup did not include it', async () => {
  const appClientSecrets = vi.fn().mockResolvedValue([{secret: 'fetched-secret'}])
  const remoteApp = testOrganizationApp({
    apiSecretKeys: [],
    developerPlatformClient: testDeveloperPlatformClient({appClientSecrets}),
  })

  const result = await getAppEnv(mockApp(), remoteApp, organization)

  expect(appClientSecrets).toHaveBeenCalledWith(remoteApp)
  expect(result.variables).toContainEqual({name: 'SHOPIFY_API_SECRET', value: 'fetched-secret', isSecret: true})
})

test('marks SHOPIFY_API_SECRET as unavailable and warns when the App Management API returns no secret', async () => {
  const output = mockAndCaptureOutput()
  const remoteApp = testOrganizationAppWithoutClientSecret()

  const result = await getAppEnv(mockApp(), remoteApp, organization)

  expect(result).toEqual({
    variables: [
      {name: 'SHOPIFY_API_KEY', value: remoteApp.apiKey, isSecret: false},
      {name: 'SHOPIFY_API_SECRET', isSecret: true},
      {name: 'SCOPES', value: 'my-scope', isSecret: false},
    ],
  })
  expect(output.warn()).toContain("SHOPIFY_API_SECRET isn't included")
  output.clear()
})

test('never shows the secret from SHOPIFY_CLI_APP_CLIENT_SECRET', async () => {
  vi.stubEnv('SHOPIFY_CLI_APP_CLIENT_SECRET', 'environment-secret')
  const output = mockAndCaptureOutput()

  const result = await getAppEnv(mockApp(), testOrganizationAppWithoutClientSecret(), organization)

  expect(result.variables).toContainEqual({name: 'SHOPIFY_API_SECRET', isSecret: true})
  expect(JSON.stringify(result)).not.toContain('environment-secret')
  output.clear()
})

function mockApp(): AppInterface {
  return testApp({
    name: 'myapp',
    directory: '/',
    configuration: {
      client_id: 'test-client-id',
      name: 'my-app',
      application_url: 'https://example.com',
      embedded: true,
      access_scopes: {
        scopes: 'my-scope',
      },
    },
  })
}
