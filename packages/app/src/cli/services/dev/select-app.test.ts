import {createApp, selectOrCreateApp} from './select-app.js'
import {AppInterface, WebType} from '../../models/app/app.js'
import {Organization, OrganizationApp} from '../../models/organization.js'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {testApp} from '../../models/app/app.test-data.js'
import {CreateAppQuery} from '../../api/graphql/create_app.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

vi.mock('../../prompts/dev')
vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/session')

const LOCAL_APP: AppInterface = testApp({
  directory: '',
  configurationPath: '/shopify.app.toml',
  configuration: {scopes: 'read_products', extensionDirectories: ['extensions/*']},
  webs: [
    {
      directory: '',
      configuration: {
        type: WebType.Backend,
        commands: {dev: ''},
      },
    },
  ],
  name: 'my-app',
})

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
  betas: {},
}
const ORG2: Organization = {
  id: '2',
  businessName: 'org2',
  betas: {},
}
const APP1: OrganizationApp = {
  id: '1',
  title: 'app1',
  apiKey: 'key1',
  apiSecretKeys: [{secret: 'secret1'}],
  organizationId: '1',
  grantedScopes: [],
}
const APP2: OrganizationApp = {
  id: '2',
  title: 'app2',
  apiKey: 'key2',
  apiSecretKeys: [{secret: 'secret2'}],
  organizationId: '1',
  grantedScopes: [],
}
const APP_LIST = {
  nodes: [
    {id: APP1.id, title: APP1.title, apiKey: APP1.apiKey},
    {id: APP2.id, title: APP2.title, apiKey: APP2.apiKey},
  ],
  pageInfo: {hasNextPage: false},
}

beforeEach(() => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
})

describe('createApp', () => {
  test('sends request to create app and returns it', async () => {
    // Given
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(partnersRequest).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 2,
      title: 'app-name',
      appUrl: 'https://example.com',
      redir: ['https://example.com/api/auth'],
      type: 'undecided',
    }

    // When
    const got = await createApp(ORG2, LOCAL_APP.name, 'token')

    // Then
    expect(got).toEqual(APP1)
    expect(partnersRequest).toHaveBeenCalledWith(CreateAppQuery, 'token', variables)
  })

  test('throws error if requests has a user error', async () => {
    // Given
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(partnersRequest).mockResolvedValueOnce({
      appCreate: {app: {}, userErrors: [{message: 'some-error'}]},
    })

    // When
    const got = createApp(ORG2, LOCAL_APP.name, 'token')

    // Then
    await expect(got).rejects.toThrow(`some-error`)
  })
})

describe('selectOrCreateApp', () => {
  test('prompts user to select', async () => {
    // Given
    vi.mocked(selectAppPrompt).mockResolvedValueOnce(APP1.apiKey)
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(false)
    vi.mocked(partnersRequest).mockResolvedValueOnce({app: APP1})

    // When
    const got = await selectOrCreateApp(LOCAL_APP.name, APP_LIST, ORG1, 'token')

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).toHaveBeenCalledWith(APP_LIST, ORG1.id, 'token')
  })

  test('prompts user to create if chooses to create', async () => {
    // Given
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(true)
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(partnersRequest).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 1,
      title: 'app-name',
      appUrl: 'https://example.com',
      redir: ['https://example.com/api/auth'],
      type: 'undecided',
    }

    // When
    const got = await selectOrCreateApp(LOCAL_APP.name, APP_LIST, ORG1, 'token')

    // Then
    expect(got).toEqual(APP1)
    expect(appNamePrompt).toHaveBeenCalledWith(LOCAL_APP.name)
    expect(partnersRequest).toHaveBeenCalledWith(CreateAppQuery, 'token', variables)
  })
})
