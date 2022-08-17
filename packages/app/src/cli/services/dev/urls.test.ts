import {updateURLs, generateURL, getURLs, shouldOrPromptUpdateURLs} from './urls.js'
import {AppInterface, WebType} from '../../models/app/app.js'
import {testApp} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {api, error, outputMocker, store, ui} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'

const LOCAL_APP: AppInterface = testApp({
  directory: '',
  configurationPath: '/shopify.app.toml',
  configuration: {scopes: 'read_products'},
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

beforeEach(() => {
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
      plugins: {
        lookupTunnelPlugin: async () => {
          return {start: async () => 'https://fake-url.ngrok.io'}
        },
      },
      ui: {
        prompt: vi.fn(),
      },
      store: {
        cliKitStore: vi.fn(),
      },
    }
  })
})

describe('generateURL', () => {
  it('returns a tunnel URL by default', async () => {
    // Given
    const pluginList: Plugin[] = []

    // When
    const got = await generateURL(pluginList, 3456)

    // Then
    expect(got).toEqual('https://fake-url.ngrok.io')
  })
})

describe('updateURLs', () => {
  it('sends a request to update the URLs', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({appUpdate: {userErrors: []}})
    const urls = {
      applicationUrl: 'https://example.com',
      redirectUrlWhitelist: [
        'https://example.com/auth/callback',
        'https://example.com/auth/shopify/callback',
        'https://example.com/api/auth/callback',
      ],
    }
    const expectedVariables = {
      apiKey: 'apiKey',
      ...urls,
    }

    // When
    await updateURLs(urls, 'apiKey', 'token')

    // Then
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.UpdateURLsQuery, 'token', expectedVariables)
  })

  it('throws an error if requests has a user error', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({appUpdate: {userErrors: [{message: 'Boom!'}]}})
    const urls = {
      applicationUrl: 'https://example.com',
      redirectUrlWhitelist: [],
    }

    // When
    const got = updateURLs(urls, 'apiKey', 'token')

    // Then
    await expect(got).rejects.toThrow(new error.Abort(`Boom!`))
  })
})

describe('getURLs', () => {
  it('sends a request to get the URLs', async () => {
    // Given
    vi.mocked(api.partners.request).mockResolvedValueOnce({
      app: {applicationUrl: 'https://example.com', redirectUrlWhitelist: []},
    })
    const expectedVariables = {apiKey: 'apiKey'}

    // When
    await getURLs('apiKey', 'token')

    // Then
    expect(api.partners.request).toHaveBeenCalledWith(api.graphql.GetURLsQuery, 'token', expectedVariables)
  })
})

describe('shouldOrPromptUpdateURLs', () => {
  const currentURLs = {
    applicationUrl: 'https://example.com/home',
    redirectUrlWhitelist: ['https://example.com/auth/callback'],
  }

  beforeEach(() => {
    vi.mocked(store.cliKitStore).mockReturnValue({
      setAppInfo: vi.fn(),
    } as any)
  })

  it('returns true if the app is new', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
      newApp: true,
    }

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(true)
  })

  it('returns true if the cached value is true (always)', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
      cachedUpdateURLs: true,
    }

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(true)
  })

  it('returns false if the cached value is false (never)', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
      cachedUpdateURLs: false,
    }

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(false)
  })

  it('returns true when the user selects always', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
    }
    vi.mocked(ui.prompt).mockResolvedValue({value: 'always'})

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(true)
  })

  it('returns true when the user selects yes', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
    }
    vi.mocked(ui.prompt).mockResolvedValue({value: 'yes'})

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(true)
  })

  it('returns false when the user selects never', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
    }
    vi.mocked(ui.prompt).mockResolvedValue({value: 'never'})

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(false)
  })

  it('returns false when the user selects no', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
    }
    vi.mocked(ui.prompt).mockResolvedValue({value: 'no'})

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(false)
  })

  it('saves the response for the next time', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
    }
    vi.mocked(ui.prompt).mockResolvedValue({value: 'always'})

    // When
    await shouldOrPromptUpdateURLs(options)

    // Then
    expect(store.cliKitStore().setAppInfo).toHaveBeenNthCalledWith(1, {
      directory: LOCAL_APP.directory,
      updateURLs: true,
    })
  })

  it('shows the current URLs', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
    }
    const outputMock = outputMocker.mockAndCaptureOutput()
    vi.mocked(ui.prompt).mockResolvedValue({value: 'no'})

    // When
    await shouldOrPromptUpdateURLs(options)

    // Then
    expect(outputMock.output()).toMatch(/example.com\/home/)
    expect(outputMock.output()).toMatch(/example.com\/auth\/callback/)
  })

  it('shows a reminder when choosing always/never', async () => {
    // Given
    const options = {
      currentURLs,
      app: LOCAL_APP,
    }
    const outputMock = outputMocker.mockAndCaptureOutput()
    vi.mocked(ui.prompt).mockResolvedValue({value: 'always'})

    // When
    await shouldOrPromptUpdateURLs(options)

    // Then
    expect(outputMock.output()).toMatch(/You won't be asked again/)
  })
})
