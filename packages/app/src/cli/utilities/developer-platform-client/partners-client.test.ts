import {PartnersClient} from './partners-client.js'
import {CreateAppQuery} from '../../api/graphql/create_app.js'
import {AppInterface, WebType} from '../../models/app/app.js'
import {Organization} from '../../models/organization.js'
import {
  testPartnersUserSession,
  testApp,
  testAppWithLegacyConfig,
  testOrganizationApp,
} from '../../models/app/app.test-data.js'
import {appNamePrompt} from '../../prompts/dev.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {describe, expect, vi, test} from 'vitest'

vi.mock('../../prompts/dev.js')
vi.mock('@shopify/cli-kit/node/api/partners')

const LOCAL_APP: AppInterface = testApp({
  directory: '',
  configuration: {path: '/shopify.app.toml', scopes: 'read_products', extension_directories: ['extensions/*']},
  webs: [
    {
      directory: '',
      configuration: {
        roles: [WebType.Backend],
        commands: {dev: ''},
      },
    },
  ],
  name: 'my-app',
})

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
}
const ORG2: Organization = {
  id: '2',
  businessName: 'org2',
}

const APP1 = testOrganizationApp({apiKey: 'key1'})

describe('createApp', () => {
  test('sends request to create app with launchable defaults and returns it', async () => {
    // Given
    const partnersClient = new PartnersClient(testPartnersUserSession)
    const localApp = testAppWithLegacyConfig({config: {scopes: 'write_products'}})
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(partnersRequest).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 1,
      title: localApp.name,
      appUrl: 'https://example.com',
      redir: ['https://example.com/api/auth'],
      requestedAccessScopes: ['write_products'],
      type: 'undecided',
    }

    // When
    const got = await partnersClient.createApp(ORG1, localApp.name, {
      scopesArray: ['write_products'],
      isLaunchable: true,
    })

    // Then
    expect(got).toEqual({...APP1, newApp: true})
    expect(partnersRequest).toHaveBeenCalledWith(CreateAppQuery, 'token', variables)
  })

  test('creates an app with non-launchable defaults', async () => {
    // Given
    const partnersClient = new PartnersClient(testPartnersUserSession)
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(partnersRequest).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 1,
      title: LOCAL_APP.name,
      appUrl: 'https://shopify.dev/apps/default-app-home',
      redir: ['https://shopify.dev/apps/default-app-home/api/auth'],
      requestedAccessScopes: [],
      type: 'undecided',
    }

    // When
    const got = await partnersClient.createApp(ORG1, LOCAL_APP.name, {isLaunchable: false})

    // Then
    expect(got).toEqual({...APP1, newApp: true})
    expect(partnersRequest).toHaveBeenCalledWith(CreateAppQuery, 'token', variables)
  })

  test('throws error if requests has a user error', async () => {
    // Given
    const partnersClient = new PartnersClient(testPartnersUserSession)
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(partnersRequest).mockResolvedValueOnce({
      appCreate: {app: {}, userErrors: [{message: 'some-error'}]},
    })

    // When
    const got = partnersClient.createApp(ORG2, LOCAL_APP.name)

    // Then
    await expect(got).rejects.toThrow(`some-error`)
  })
})
