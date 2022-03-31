import {createApp} from './create-app'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '@shopify/cli-kit'
import {App} from '$cli/models/app/app'
import {OrganizationApp} from '$cli/models/organization'
import {appNamePrompt, appTypePrompt} from '$cli/prompts/dev'

const LOCAL_APP: App = {
  directory: '',
  packageManager: 'yarn',
  configuration: {name: 'my-app'},
  scripts: [],
  home: {directory: ''},
  extensions: [],
}

const APP1: OrganizationApp = {id: '1', title: 'app1', apiKey: 'key1', apiSecretKeys: {secret: 'secret1'}}

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
