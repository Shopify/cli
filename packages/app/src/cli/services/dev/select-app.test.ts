import {selectOrCreateApp} from './select-app.js'
import {AppInterface, WebType} from '../../models/app/app.js'
import {Organization, OrganizationSource} from '../../models/organization.js'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {testApp, testOrganizationApp, testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {describe, expect, vi, test} from 'vitest'

vi.mock('../../prompts/dev')
vi.mock('@shopify/cli-kit/node/output')

const LOCAL_APP: AppInterface = testApp({
  directory: '',
  configuration: {
    path: '/shopify.app.toml',
    client_id: 'test-client-id',
    name: 'my-app',
    application_url: 'https://example.com',
    embedded: true,
    access_scopes: {scopes: 'read_products'},
    extension_directories: ['extensions/*'],
  },
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
  source: OrganizationSource.BusinessPlatform,
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
    async appFromIdentifiers(apiKey: string) {
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
    const got = await selectOrCreateApp(APPS, false, ORG1, developerPlatformClient, {name: LOCAL_APP.name})

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).toHaveBeenCalledWith(expect.any(Function), APPS, false, {
      directory: undefined,
    })
  })

  test('prompts user to create if chooses to create', async () => {
    // Given
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(true)
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')

    // When
    const {developerPlatformClient} = mockDeveloperPlatformClient()
    const got = await selectOrCreateApp(APPS, false, ORG1, developerPlatformClient, {name: LOCAL_APP.name})

    // Then
    expect(got).toEqual({...APP1, newApp: true})
    expect(appNamePrompt).toHaveBeenCalledWith(LOCAL_APP.name)
    expect(developerPlatformClient.createApp).toHaveBeenCalledWith(ORG1, {name: 'app-name'})
  })

  test('retries when selectAppPrompt returns undefined and succeeds on next attempt', async () => {
    // Given
    vi.mocked(selectAppPrompt).mockResolvedValueOnce(undefined).mockResolvedValueOnce(APPS[0])
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(false)

    // When
    const {developerPlatformClient} = mockDeveloperPlatformClient()
    const got = await selectOrCreateApp(APPS, false, ORG1, developerPlatformClient, {name: LOCAL_APP.name})

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).toHaveBeenCalledTimes(2)
  })

  test('throws BugError when selectAppPrompt returns undefined for all attempts', async () => {
    // Given
    vi.mocked(selectAppPrompt).mockResolvedValue(undefined)
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(false)

    // When/Then
    const {developerPlatformClient} = mockDeveloperPlatformClient()
    await expect(selectOrCreateApp(APPS, false, ORG1, developerPlatformClient, {name: LOCAL_APP.name})).rejects.toThrow(
      BugError,
    )
    expect(selectAppPrompt).toHaveBeenCalledTimes(2)
  })

  test('throws BugError when appFromIdentifiers returns undefined for all attempts', async () => {
    // Given
    vi.mocked(selectAppPrompt).mockResolvedValue(APPS[0])
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(false)
    const developerPlatformClient = testDeveloperPlatformClient({
      async appFromIdentifiers(_apiKey) {
        return undefined
      },
    })

    // When/Then
    await expect(selectOrCreateApp(APPS, false, ORG1, developerPlatformClient, {name: LOCAL_APP.name})).rejects.toThrow(
      BugError,
    )
    expect(selectAppPrompt).toHaveBeenCalledTimes(2)
  })
})
