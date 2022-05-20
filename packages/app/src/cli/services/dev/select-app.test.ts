import {createApp, selectOrCreateApp} from './select-app'
import {App, WebType} from '../../models/app/app'
import {OrganizationApp} from '../../models/organization'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '@shopify/cli-kit'

const LOCAL_APP: App = {
  directory: '',
  dependencyManager: 'yarn',
  configurationPath: '/shopify.app.toml',
  configuration: {name: 'my-app', scopes: 'read_products'},
  webs: [
    {
      directory: '',
      configuration: {
        type: WebType.Backend,
        commands: {dev: ''},
      },
    },
  ],
  nodeDependencies: {},
  extensions: {ui: [], theme: [], function: []},
}

const APP1: OrganizationApp = {id: '1', title: 'app1', apiKey: 'key1', apiSecretKeys: [{secret: 'secret1'}]}
const APP2: OrganizationApp = {id: '2', title: 'app2', apiKey: 'key2', apiSecretKeys: [{secret: 'secret2'}]}

beforeEach(() => {
  vi.mock('../../prompts/dev')
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: async () => 'token',
      },
      api: {
        partners: {
          request: vi.fn(),
        },
        graphql: cliKit.api.graphql,
      },
    }
  })
})

describe('createApp', () => {
  it('sends request to create app and returns it', async () => {
    // Given
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(api.partners.request).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 123,
      title: 'app-name',
      appUrl: 'https://shopify.github.io/shopify-cli/help/start-app/',
      redir: ['http://localhost:3456'],
    }

    // When
    const got = await createApp('123', LOCAL_APP, 'token')

    // Then
    expect(got).toEqual(APP1)
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.CreateAppQuery, 'token', variables)
  })

  it('throws error if requests has a user error', async () => {
    // Given
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(api.partners.request).mockResolvedValueOnce({appCreate: {app: {}, userErrors: [{message: 'some-error'}]}})

    // When
    const got = createApp('123', LOCAL_APP, 'token')

    // Then
    expect(got).rejects.toThrow(`some-error`)
  })
})

describe('selectOrCreateApp', () => {
  it('returns app if cachedApiKey is valid', async () => {
    // Given
    const cachedApiKey = APP1.apiKey
    vi.mocked(api.partners.request).mockResolvedValueOnce({app: APP1})

    // When
    const got = await selectOrCreateApp(LOCAL_APP, [APP1, APP2], '1', 'token', cachedApiKey)

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).not.toHaveBeenCalled()
  })

  it('prompts user to select if there is no cachedApiKey and chooses to select', async () => {
    // Given
    vi.mocked(selectAppPrompt).mockResolvedValueOnce(APP1)
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(false)

    // When
    const got = await selectOrCreateApp(LOCAL_APP, [APP1, APP2], 'token', '1')

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).toHaveBeenCalledWith([APP1, APP2])
  })

  it('prompts user to select if cachedApiKey is invalid and chooses to select', async () => {
    // Given
    const cachedApiKey = 'invalid'
    vi.mocked(selectAppPrompt).mockResolvedValueOnce(APP1)
    vi.mocked(api.partners.request).mockResolvedValueOnce({app: null})
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(false)

    // When
    const got = await selectOrCreateApp(LOCAL_APP, [APP1, APP2], '1', 'token', cachedApiKey)

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).toHaveBeenCalledWith([APP1, APP2])
  })

  it('prompts user to create if chooses to create', async () => {
    // Given
    vi.mocked(createAsNewAppPrompt).mockResolvedValue(true)
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(api.partners.request).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 1,
      title: 'app-name',
      appUrl: 'https://shopify.github.io/shopify-cli/help/start-app/',
      redir: ['http://localhost:3456'],
    }

    // When
    const got = await selectOrCreateApp(LOCAL_APP, [APP1, APP2], '1', 'token')

    // Then
    expect(got).toEqual(APP1)
    expect(appNamePrompt).toHaveBeenCalledWith(LOCAL_APP.configuration.name)
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.CreateAppQuery, 'token', variables)
  })
})
