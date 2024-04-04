import {selectOrCreateApp} from './select-app.js'
import {AppInterface, WebType} from '../../models/app/app.js'
import {MinimalAppIdentifiers, Organization} from '../../models/organization.js'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {testApp, testOrganizationApp, testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('../../prompts/dev')

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
const APP1 = testOrganizationApp({apiKey: 'key1'})
const APP2 = testOrganizationApp({
  id: '2',
  title: 'app2',
  apiKey: 'key2',
  apiSecretKeys: [{secret: 'secret2'}],
})
const APPS = [
  {id: APP1.id, title: APP1.title, apiKey: APP1.apiKey, organizationId: ORG1.id},
  {id: APP2.id, title: APP2.title, apiKey: APP2.apiKey, organizationId: ORG1.id},
]

function mockDeveloperPlatformClient() {
  const developerPlatformClient = testDeveloperPlatformClient({
    createApp: async () => ({...APP1, newApp: true}),
    async appFromId({apiKey}: MinimalAppIdentifiers) {
      if (apiKey === APP1.apiKey) return APP1
      if (apiKey === APP2.apiKey) return APP2
      throw new Error(`App with client ID ${apiKey} not found`)
    },
  })
  return {developerPlatformClient}
}

describe('selectOrCreateApp', () => {
  test('prompts user to select', async () => {
    // Given
    vi.mocked(selectAppPrompt).mockResolvedValueOnce(APP1)
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(false)

    // When
    const {developerPlatformClient} = mockDeveloperPlatformClient()
    const got = await selectOrCreateApp(LOCAL_APP.name, APPS, false, ORG1, developerPlatformClient, {})

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).toHaveBeenCalledWith(APPS, false, ORG1.id, {
      directory: undefined,
    })
  })

  test('prompts user to create if chooses to create', async () => {
    // Given
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(true)
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')

    // When
    const {developerPlatformClient} = mockDeveloperPlatformClient()
    const got = await selectOrCreateApp(LOCAL_APP.name, APPS, false, ORG1, developerPlatformClient, {})

    // Then
    expect(got).toEqual({...APP1, newApp: true})
    expect(appNamePrompt).toHaveBeenCalledWith(LOCAL_APP.name)
    expect(developerPlatformClient.createApp).toHaveBeenCalledWith(ORG1, 'app-name', {})
  })
})
