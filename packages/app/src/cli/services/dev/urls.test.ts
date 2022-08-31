import {updateURLs, generateURL, getURLs, shouldOrPromptUpdateURLs, generateFrontendURL} from './urls.js'
import {testApp} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {api, error, outputMocker, store, ui} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'

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
      port: {
        getRandomPort: async () => 3042,
      },
    }
  })

  vi.mocked(store.cliKitStore).mockReturnValue({
    setAppInfo: vi.fn(),
  } as any)
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

  it('returns true if the app is new', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
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
      appDirectory: '/path',
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
      appDirectory: '/path',
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
      appDirectory: '/path',
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
      appDirectory: '/path',
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
      appDirectory: '/path',
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
      appDirectory: '/path',
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
      appDirectory: '/path',
    }
    vi.mocked(ui.prompt).mockResolvedValue({value: 'always'})

    // When
    await shouldOrPromptUpdateURLs(options)

    // Then
    expect(store.cliKitStore().setAppInfo).toHaveBeenNthCalledWith(1, {
      directory: '/path',
      updateURLs: true,
    })
  })

  it('shows the current URLs', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
    }
    const outputMock = outputMocker.mockAndCaptureOutput()
    vi.mocked(ui.prompt).mockResolvedValue({value: 'no'})

    // When
    await shouldOrPromptUpdateURLs(options)

    // Then
    expect(outputMock.output()).toMatch(/example.com\/home/)
    expect(outputMock.output()).toMatch(/example.com\/auth\/callback/)
  })
})

describe('generateFrontendURL', () => {
  beforeEach(() => {
    vi.mocked(ui.prompt).mockResolvedValue({value: 'yes'})
  })

  it('returns tunnelUrl when there is a tunnelUrl ignoring all other false values', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: false,
      noTunnel: false,
      tunnelUrl: 'https://my-tunnel-provider.io:4242',
      commandConfig: {plugins: []},
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://my-tunnel-provider.io', frontendPort: 4242, usingTunnel: true})
  })

  it('returns tunnelUrl when there is a tunnelUrl ignoring all other true values', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => true}),
      tunnel: true,
      noTunnel: true,
      tunnelUrl: 'https://my-tunnel-provider.io:4242',
      commandConfig: {plugins: []},
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://my-tunnel-provider.io', frontendPort: 4242, usingTunnel: true})
  })

  it('generates a tunnel url when tunnel is true and there is no tunnelUrl and there are no extensions', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: true,
      noTunnel: false,
      commandConfig: {plugins: []},
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://fake-url.ngrok.io', frontendPort: 3042, usingTunnel: true})
  })

  it('generates a tunnel url when tunnel is false and there is no tunnelUrl and there are extensions', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => true}),
      tunnel: false,
      noTunnel: false,
      commandConfig: {plugins: []},
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://fake-url.ngrok.io', frontendPort: 3042, usingTunnel: true})
  })

  it('returns localhost if tunnel is false and there is no tunnelUrl nor extensions', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: false,
      noTunnel: false,
      commandConfig: {plugins: []},
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'http://localhost', frontendPort: 3042, usingTunnel: false})
  })

  it('returns localhost if noTunnel is true even if there are extensions', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => true}),
      tunnel: false,
      noTunnel: true,
      commandConfig: {plugins: []},
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'http://localhost', frontendPort: 3042, usingTunnel: false})
  })

  it('raises error if tunnelUrl does not include port', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: false,
      noTunnel: false,
      tunnelUrl: 'https://my-tunnel-provider.io',
      commandConfig: {plugins: []},
    }

    // When
    const got = generateFrontendURL(options)

    // Then
    await expect(got).rejects.toThrow(/Invalid tunnel URL/)
  })

  it('cancels execution if you select not to continue in the plugin prompt', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({value: 'cancel'})
    const options = {
      app: testApp({hasUIExtensions: () => true}),
      tunnel: true,
      noTunnel: false,
      commandConfig: {plugins: []},
    }

    // When
    const got = generateFrontendURL(options)

    // Then
    await expect(got).rejects.toThrow()
  })

  it('Stores the tunnel plugin in your presets if you select always', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({value: 'always'})
    const options = {
      app: testApp({hasUIExtensions: () => true, directory: '/app-path'}),
      tunnel: true,
      noTunnel: false,
      commandConfig: {plugins: []},
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://fake-url.ngrok.io', frontendPort: 3042, usingTunnel: true})
    expect(store.cliKitStore().setAppInfo).toBeCalledWith({directory: '/app-path', tunnelPlugin: 'ngrok'})
  })
})
