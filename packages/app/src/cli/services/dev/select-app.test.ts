import {createApp, selectOrCreateApp} from './select-app'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '@shopify/cli-kit'
import {App} from '$cli/models/app/app'
import {OrganizationApp} from '$cli/models/organization'
import {appNamePrompt, appTypePrompt, selectAppPrompt} from '$cli/prompts/dev'

const LOCAL_APP: App = {
  directory: '',
  packageManager: 'yarn',
  configuration: {name: 'my-app'},
  scripts: [],
  home: {directory: '', configuration: {commands: {dev: ''}}},
  extensions: [],
}

const APP1: OrganizationApp = {id: '1', title: 'app1', apiKey: 'key1', apiSecretKeys: [{secret: 'secret1'}]}
const APP2: OrganizationApp = {id: '2', title: 'app2', apiKey: 'key2', apiSecretKeys: [{secret: 'secret2'}]}

beforeEach(() => {
  vi.mock('$cli/prompts/dev')
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

afterEach(() => {
  vi.mocked(api.partners.request).mockClear()
})

describe('createApp', () => {
  it('sends request to create app and returns it', async () => {
    // Given
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(appTypePrompt).mockResolvedValue('custom')
    vi.mocked(api.partners.request).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 123,
      title: 'app-name',
      type: 'custom',
      appUrl: 'https://shopify.github.io/shopify-cli/help/start-app/',
      redir: ['http://localhost:3456'],
    }

    // When
    const got = await createApp('123', LOCAL_APP)

    // Then
    expect(got).toEqual(APP1)
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.CreateAppQuery, 'token', variables)
  })

  it('throws error if requests has a user error', async () => {
    // Given
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(appTypePrompt).mockResolvedValue('custom')
    vi.mocked(api.partners.request).mockResolvedValueOnce({appCreate: {app: {}, userErrors: [{message: 'some-error'}]}})

    // When
    const got = createApp('123', LOCAL_APP)

    // Then
    expect(got).rejects.toThrow(`some-error`)
  })
})

describe('selectOrCreateApp', () => {
  it('returns app if envApiKey is valid', async () => {
    // Given
    const envApiKey = APP2.apiKey

    // When
    const got = await selectOrCreateApp(LOCAL_APP, [APP1, APP2], '1', 'key4', envApiKey)

    // Then
    expect(got).toEqual(APP2)
    expect(selectAppPrompt).not.toHaveBeenCalled()
  })

  it('throws if envApiKey is invalid', async () => {
    // Given
    const envApiKey = 'invalid'

    // When
    const got = selectOrCreateApp(LOCAL_APP, [APP1, APP2], '1', 'key4', envApiKey)

    // Then
    expect(got).rejects.toThrowError(/Invalid API key/)
    expect(selectAppPrompt).not.toHaveBeenCalled()
  })

  it('returns app if cachedApiKey is valid and there is no envApiKey', async () => {
    // Given
    const cachedApiKey = APP1.apiKey

    // When
    const got = await selectOrCreateApp(LOCAL_APP, [APP1, APP2], '1', cachedApiKey)

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).not.toHaveBeenCalled()
  })

  it('prompts user to select if there is no envApiKey nor cachedApiKey', async () => {
    // Given
    vi.mocked(selectAppPrompt).mockResolvedValueOnce(APP1)

    // When
    const got = await selectOrCreateApp(LOCAL_APP, [APP1, APP2], '1')

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).toHaveBeenCalledWith([APP1, APP2])
  })

  it('prompts user to select if cachedApiKey is invalid', async () => {
    // Given
    const cachedApiKey = 'invalid'
    vi.mocked(selectAppPrompt).mockResolvedValueOnce(APP1)

    // When
    const got = await selectOrCreateApp(LOCAL_APP, [APP1, APP2], '1', cachedApiKey)

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).toHaveBeenCalledWith([APP1, APP2])
  })

  it('prompts user to create if prompt returns undefined', async () => {
    // Given
    vi.mocked(selectAppPrompt).mockResolvedValueOnce(undefined)
    vi.mocked(appNamePrompt).mockResolvedValue('app-name')
    vi.mocked(appTypePrompt).mockResolvedValue('custom')
    vi.mocked(api.partners.request).mockResolvedValueOnce({appCreate: {app: APP1, userErrors: []}})
    const variables = {
      org: 1,
      title: 'app-name',
      type: 'custom',
      appUrl: 'https://shopify.github.io/shopify-cli/help/start-app/',
      redir: ['http://localhost:3456'],
    }

    // When
    const got = await selectOrCreateApp(LOCAL_APP, [APP1, APP2], '1')

    // Then
    expect(got).toEqual(APP1)
    expect(selectAppPrompt).toHaveBeenCalledWith([APP1, APP2])
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.CreateAppQuery, 'token', variables)
  })
})
