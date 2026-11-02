import {getAppEnv} from './show.js'
import {logMetadataForLoadedContext} from '../../context.js'
import {AppInterface} from '../../../models/app/app.js'
import {testApp, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {OrganizationSource} from '../../../models/organization.js'
import {expect, test, vi} from 'vitest'

vi.mock('../../context.js')

const organization = {id: '123', businessName: 'test', source: OrganizationSource.BusinessPlatform}

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

test('omits SHOPIFY_API_SECRET when the app has no secret', async () => {
  const app = mockApp()
  const remoteApp = testOrganizationApp({apiSecretKeys: []})

  const result = await getAppEnv(app, remoteApp, organization)

  expect(result).toEqual({
    variables: [
      {name: 'SHOPIFY_API_KEY', value: remoteApp.apiKey, isSecret: false},
      {name: 'SCOPES', value: 'my-scope', isSecret: false},
    ],
  })
  expect(result.variables.map(({name}) => name)).not.toContain('SHOPIFY_API_SECRET')
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
