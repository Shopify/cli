import {
  updateURLs,
  shouldOrPromptUpdateURLs,
  generateFrontendURL,
  generatePartnersURLs,
  PartnersURLs,
  validatePartnersURLs,
  FrontendURLOptions,
} from './urls.js'
import {DEFAULT_CONFIG, testApp, testAppWithConfig} from '../../models/app/app.test-data.js'
import {UpdateURLsQuery} from '../../api/graphql/update_urls.js'
import {setCachedAppInfo} from '../local-storage.js'
import {writeAppConfigurationFile} from '../app/write-app-configuration-file.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {isSpin, spinFqdn, appPort, appHost} from '@shopify/cli-kit/node/context/spin'
import {codespacePortForwardingDomain, codespaceURL, gitpodURL, isUnitTest} from '@shopify/cli-kit/node/context/local'
import {renderConfirmationPrompt, renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {terminalSupportsRawMode} from '@shopify/cli-kit/node/system'

vi.mock('../local-storage.js')
vi.mock('../app/write-app-configuration-file.js')
vi.mock('@shopify/cli-kit/node/tcp')
vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/context/spin')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/plugins')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/system')

beforeEach(() => {
  vi.mocked(getAvailableTCPPort).mockResolvedValue(3042)
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mocked(isUnitTest).mockReturnValue(true)
  vi.mocked(terminalSupportsRawMode).mockReturnValue(true)
})

const defaultOptions: FrontendURLOptions = {
  noTunnel: false,
  tunnelUrl: undefined,
  tunnelClient: {
    getTunnelStatus: () => ({status: 'starting'}),
    stopTunnel: () => {},
    provider: 'cloudflare',
    port: 1111,
  },
}

describe('updateURLs', () => {
  test('sends a request to update the URLs', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValueOnce({appUpdate: {userErrors: []}})
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
    expect(partnersRequest).toHaveBeenCalledWith(UpdateURLsQuery, 'token', expectedVariables)
  })

  test('when config as code is enabled, the configuration is updated as well', async () => {
    // Given
    const appWithConfig = testAppWithConfig()
    const apiKey = appWithConfig.configuration.client_id as string

    vi.mocked(partnersRequest).mockResolvedValueOnce({appUpdate: {userErrors: []}})
    const urls = {
      applicationUrl: 'https://example.com',
      redirectUrlWhitelist: [
        'https://example.com/auth/callback',
        'https://example.com/auth/shopify/callback',
        'https://example.com/api/auth/callback',
      ],
    }

    // When
    await updateURLs(urls, apiKey, 'token', appWithConfig)

    // Then
    expect(writeAppConfigurationFile).toHaveBeenCalledWith(
      {
        path: appWithConfig.configuration.path,
        access_scopes: {
          scopes: 'read_products',
        },
        application_url: 'https://example.com',
        auth: {
          redirect_urls: [
            'https://example.com/auth/callback',
            'https://example.com/auth/shopify/callback',
            'https://example.com/api/auth/callback',
          ],
        },
        client_id: 'api-key',
        embedded: true,
        name: 'my app',
        webhooks: {
          api_version: '2023-04',
        },
      },
      appWithConfig.configSchema,
    )
  })

  test('throws an error if requests has a user error', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValueOnce({appUpdate: {userErrors: [{message: 'Boom!'}]}})
    const urls = {
      applicationUrl: 'https://example.com',
      redirectUrlWhitelist: [],
    }

    // When
    const got = updateURLs(urls, 'apiKey', 'token')

    // Then
    await expect(got).rejects.toThrow(new AbortError(`Boom!`))
  })

  test('includes app proxy fields if passed in', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValueOnce({appUpdate: {userErrors: []}})
    const urls = {
      applicationUrl: 'https://example.com',
      redirectUrlWhitelist: [
        'https://example.com/auth/callback',
        'https://example.com/auth/shopify/callback',
        'https://example.com/api/auth/callback',
      ],
      appProxy: {
        proxyUrl: 'https://example.com',
        proxySubPath: 'subpath',
        proxySubPathPrefix: 'prefix',
      },
    }

    const expectedVariables = {
      apiKey: 'apiKey',
      ...urls,
    }

    // When
    await updateURLs(urls, 'apiKey', 'token')

    // Then
    expect(partnersRequest).toHaveBeenCalledWith(UpdateURLsQuery, 'token', expectedVariables)
  })

  test('also updates app proxy url when config as code is enabled', async () => {
    // Given
    const appWithConfig = testAppWithConfig()
    const apiKey = appWithConfig.configuration.client_id as string

    vi.mocked(partnersRequest).mockResolvedValueOnce({appUpdate: {userErrors: []}})
    const urls = {
      applicationUrl: 'https://example.com',
      redirectUrlWhitelist: [
        'https://example.com/auth/callback',
        'https://example.com/auth/shopify/callback',
        'https://example.com/api/auth/callback',
      ],
      appProxy: {
        proxyUrl: 'https://example.com',
        proxySubPath: 'subpath',
        proxySubPathPrefix: 'prefix',
      },
    }

    // When
    await updateURLs(urls, apiKey, 'token', appWithConfig)

    // Then
    expect(writeAppConfigurationFile).toHaveBeenCalledWith(
      {
        path: appWithConfig.configuration.path,
        access_scopes: {
          scopes: 'read_products',
        },
        application_url: 'https://example.com',
        auth: {
          redirect_urls: [
            'https://example.com/auth/callback',
            'https://example.com/auth/shopify/callback',
            'https://example.com/api/auth/callback',
          ],
        },
        app_proxy: {
          url: 'https://example.com',
          subpath: 'subpath',
          prefix: 'prefix',
        },
        client_id: 'api-key',
        embedded: true,
        name: 'my app',
        webhooks: {
          api_version: '2023-04',
        },
      },
      appWithConfig.configSchema,
    )
  })
})

describe('shouldOrPromptUpdateURLs', () => {
  const currentURLs = {
    applicationUrl: 'https://example.com/home',
    redirectUrlWhitelist: ['https://example.com/auth/callback'],
  }

  test('returns true if the app is new', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
      newApp: true,
      apiKey: 'api-key',
    }

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(true)
  })

  test('returns true if the cached value is true (always)', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
      cachedUpdateURLs: true,
      apiKey: 'api-key',
    }

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(true)
  })

  test('returns false if the cached value is false (never)', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
      cachedUpdateURLs: false,
      apiKey: 'api-key',
    }

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(false)
  })

  test('returns true when the user selects yes', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
      apiKey: 'api-key',
    }
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(true)
  })

  test('returns false when the user selects no', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
      apiKey: 'api-key',
    }
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(false)
  })

  test('saves the response for the next time', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
      apiKey: 'api-key',
    }
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    await shouldOrPromptUpdateURLs(options)

    // Then
    expect(setCachedAppInfo).toHaveBeenNthCalledWith(1, {
      directory: '/path',
      updateURLs: true,
    })
  })

  test('does not update config file or cache if current config client does not match remote', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
      apiKey: 'api-key',
      localApp: testApp({configuration: {...DEFAULT_CONFIG, client_id: 'different'}}, 'current'),
    }
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    const result = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(result).toBe(true)
    expect(setCachedAppInfo).not.toHaveBeenCalled()
    expect(writeAppConfigurationFile).not.toHaveBeenCalled()
  })

  test('updates the config file if current config client matches remote', async () => {
    // Given
    const localApp = testApp({configuration: {...DEFAULT_CONFIG, client_id: 'api-key'}}, 'current')
    const options = {
      currentURLs,
      appDirectory: '/path',
      apiKey: 'api-key',
      localApp,
    }
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    const result = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(result).toBe(true)
    expect(setCachedAppInfo).not.toHaveBeenCalled()
    expect(writeAppConfigurationFile).toHaveBeenCalledWith(localApp.configuration, localApp.configSchema)
  })
})

describe('generateFrontendURL', () => {
  beforeEach(() => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('yes')
  })

  test('returns tunnelUrl when there is a tunnelUrl ignoring the tunnel provider', async () => {
    // Given

    const options = {...defaultOptions, tunnelUrl: 'https://my-tunnel-provider.io:4242'}

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://my-tunnel-provider.io', frontendPort: 4242, usingLocalhost: false})
  })

  test('returns tunnelUrl when there is a tunnelUrl ignoring all other true values', async () => {
    // Given
    const options = {
      ...defaultOptions,
      app: testApp(),
      tunnelUrl: 'https://my-tunnel-provider.io:4242',
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://my-tunnel-provider.io', frontendPort: 4242, usingLocalhost: false})
  })

  test('generates a tunnel url with cloudflare when there is no tunnelUrl and use cloudflare is true', async () => {
    // Given
    const options: FrontendURLOptions = {
      ...defaultOptions,
      tunnelClient: {
        getTunnelStatus: () => ({status: 'connected', url: 'https://fake-url.cloudflare.io'}),
        port: 3042,
        stopTunnel: () => {},
        provider: 'cloudflare',
      },
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://fake-url.cloudflare.io', frontendPort: 3042, usingLocalhost: false})
  })

  test('returns localhost if noTunnel is true', async () => {
    // Given
    const options = {...defaultOptions, noTunnel: true}

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'http://localhost', frontendPort: 3042, usingLocalhost: true})
    expect(renderSelectPrompt).not.toBeCalled()
  })

  test('raises error if tunnelUrl does not include port', async () => {
    // Given
    const options = {...defaultOptions, tunnelUrl: 'https://my-tunnel-provider.io'}

    // When
    const got = generateFrontendURL(options)

    // Then
    await expect(got).rejects.toThrow(/Invalid tunnel URL/)
  })

  test('Returns a gitpod url if we are in a gitpod environment', async () => {
    // Given
    vi.mocked(gitpodURL).mockReturnValue('https://gitpod.url.fqdn.com')

    // When
    const got = await generateFrontendURL(defaultOptions)

    // Then
    expect(got).toEqual({frontendUrl: 'https://4040-gitpod.url.fqdn.com', frontendPort: 4040, usingLocalhost: false})
    expect(setCachedAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  test('Returns a codespace url if we are in a codespace environment', async () => {
    // Given
    vi.mocked(codespaceURL).mockReturnValue('codespace.url.fqdn.com')
    vi.mocked(codespacePortForwardingDomain).mockReturnValue('app.github.dev')

    // When
    const got = await generateFrontendURL(defaultOptions)

    // Then
    expect(got).toEqual({
      frontendUrl: 'https://codespace.url.fqdn.com-4040.app.github.dev',
      frontendPort: 4040,
      usingLocalhost: false,
    })
    expect(setCachedAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  test('Returns a cli spin url if we are in a spin environment running a non 1p app', async () => {
    // Given
    vi.mocked(isSpin).mockReturnValue(true)
    vi.mocked(spinFqdn).mockResolvedValue('spin.domain.dev')
    vi.mocked(appPort).mockReturnValue(undefined)
    vi.mocked(appHost).mockReturnValue(undefined)

    // When
    const got = await generateFrontendURL(defaultOptions)

    // Then
    expect(got).toEqual({
      frontendUrl: 'https://cli.spin.domain.dev',
      frontendPort: 4040,
      usingLocalhost: false,
    })
    expect(setCachedAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  test('Returns a 1p app spin url if we are in a spin environment running a 1p app', async () => {
    // Given
    vi.mocked(isSpin).mockReturnValue(true)
    vi.mocked(appPort).mockReturnValue(1234)
    vi.mocked(appHost).mockReturnValue('1p-app-host.spin.domain.dev')
    vi.mocked(checkPortAvailability).mockResolvedValue(true)

    // When
    const got = await generateFrontendURL(defaultOptions)

    // Then
    expect(got).toEqual({
      frontendUrl: 'https://1p-app-host.spin.domain.dev',
      frontendPort: 1234,
      usingLocalhost: false,
    })
    expect(setCachedAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  test('Returns a cli spin url if we are in a spin environment but a 1p app backend is running without the cli', async () => {
    // Given
    vi.mocked(isSpin).mockReturnValue(true)
    vi.mocked(appPort).mockReturnValue(1234)
    vi.mocked(spinFqdn).mockResolvedValue('spin.domain.dev')
    vi.mocked(checkPortAvailability).mockResolvedValue(false)

    // When
    const got = await generateFrontendURL(defaultOptions)

    // Then
    expect(got).toEqual({
      frontendUrl: 'https://cli.spin.domain.dev',
      frontendPort: 4040,
      usingLocalhost: false,
    })
    expect(setCachedAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  test('Returns a custom tunnel url if we are in a spin environment but a custom tunnel option is active', async () => {
    // Given
    vi.mocked(isSpin).mockReturnValue(true)
    const options = {...defaultOptions, tunnelUrl: 'https://my-tunnel-provider.io:4242'}

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://my-tunnel-provider.io', frontendPort: 4242, usingLocalhost: false})
  })
})

describe('generatePartnersURLs', () => {
  test('Returns the default values without an override', () => {
    const applicationUrl = 'http://my-base-url'

    const got = generatePartnersURLs(applicationUrl)

    expect(got).toMatchObject({
      applicationUrl,
      redirectUrlWhitelist: [
        `${applicationUrl}/auth/callback`,
        `${applicationUrl}/auth/shopify/callback`,
        `${applicationUrl}/api/auth/callback`,
      ],
    })
  })

  test('Returns just the override value when set as a string', () => {
    const applicationUrl = 'http://my-base-url'
    const overridePath = '/my/custom/path'

    const got = generatePartnersURLs(applicationUrl, overridePath)

    expect(got).toMatchObject({
      applicationUrl,
      redirectUrlWhitelist: [`${applicationUrl}${overridePath}`],
    })
  })

  test('Returns just the override values when set as an array', () => {
    const applicationUrl = 'http://my-base-url'
    const overridePath = ['/my/custom/path1', '/my/custom/path2']

    const got = generatePartnersURLs(applicationUrl, overridePath)

    expect(got).toMatchObject({
      applicationUrl,
      redirectUrlWhitelist: [`${applicationUrl}${overridePath[0]}`, `${applicationUrl}${overridePath[1]}`],
    })
  })

  test('Returns app proxy section when receiving proxy fields', () => {
    const applicationUrl = 'http://my-base-url'

    const got = generatePartnersURLs(applicationUrl, [], {
      url: applicationUrl,
      subpath: 'subpath',
      prefix: 'prefix',
    })

    expect(got).toMatchObject({
      applicationUrl,
      redirectUrlWhitelist: [
        `${applicationUrl}/auth/callback`,
        `${applicationUrl}/auth/shopify/callback`,
        `${applicationUrl}/api/auth/callback`,
      ],
      appProxy: {
        proxyUrl: applicationUrl,
        proxySubPath: 'subpath',
        proxySubPathPrefix: 'prefix',
      },
    })
  })

  test('Returns app proxy section changing only the host of the proxy url', () => {
    const applicationUrl = 'http://my-base-url'
    const proxyUrl = 'http://old-base-url/subpath'

    const got = generatePartnersURLs(applicationUrl, [], {
      url: proxyUrl,
      subpath: 'subpath',
      prefix: 'prefix',
    })

    expect(got).toMatchObject({
      applicationUrl,
      redirectUrlWhitelist: [
        `${applicationUrl}/auth/callback`,
        `${applicationUrl}/auth/shopify/callback`,
        `${applicationUrl}/api/auth/callback`,
      ],
      appProxy: {
        proxyUrl: 'http://my-base-url/subpath',
        proxySubPath: 'subpath',
        proxySubPathPrefix: 'prefix',
      },
    })
  })
})

describe('validatePartnersURLs', () => {
  test('does not throw any error when the URLs are valid', () => {
    // Given
    const applicationUrl = 'http://example.com'
    const redirectUrlWhitelist = ['http://example.com/callback1', 'http://example.com/callback2']
    const urls: PartnersURLs = {
      applicationUrl,
      redirectUrlWhitelist,
      appProxy: {proxyUrl: applicationUrl, proxySubPath: '', proxySubPathPrefix: ''},
    }

    // When/Then
    validatePartnersURLs(urls)
  })

  test('it raises an error when the application URL is not valid', () => {
    // Given
    const applicationUrl = 'wrong'
    const redirectUrlWhitelist = ['http://example.com/callback1', 'http://example.com/callback2']
    const urls: PartnersURLs = {applicationUrl, redirectUrlWhitelist}

    // When/Then
    expect(() => validatePartnersURLs(urls)).toThrow(/Invalid application URL/)
  })

  test('it raises an error when the redirection URLs are not valid', () => {
    // Given
    const applicationUrl = 'http://example.com'
    const redirectUrlWhitelist = ['http://example.com/callback1', 'wrong']
    const urls: PartnersURLs = {applicationUrl, redirectUrlWhitelist}

    // When/Then
    expect(() => validatePartnersURLs(urls)).toThrow(/Invalid redirection URLs/)
  })

  test('it raises an error when the app proxy URL is not valid', () => {
    // Given
    const applicationUrl = 'http://example.com'
    const redirectUrlWhitelist = ['http://example.com/callback1', 'http://example.com/callback2']
    const urls: PartnersURLs = {
      applicationUrl,
      redirectUrlWhitelist,
      appProxy: {proxyUrl: 'wrong', proxySubPath: '', proxySubPathPrefix: ''},
    }

    // When/Then
    expect(() => validatePartnersURLs(urls)).toThrow(/Invalid app proxy URL/)
  })
})
