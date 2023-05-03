import {
  updateURLs,
  getURLs,
  shouldOrPromptUpdateURLs,
  generateFrontendURL,
  generatePartnersURLs,
  PartnersURLs,
  validatePartnersURLs,
  FrontendURLOptions,
} from './urls.js'
import {testApp} from '../../models/app/app.test-data.js'
import {UpdateURLsQuery} from '../../api/graphql/update_urls.js'
import {GetURLsQuery} from '../../api/graphql/get_urls.js'
import {setAppInfo} from '../local-storage.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {isSpin, spinFqdn, appPort, appHost} from '@shopify/cli-kit/node/context/spin'
import {codespaceURL, gitpodURL, isUnitTest} from '@shopify/cli-kit/node/context/local'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {terminalSupportsRawMode} from '@shopify/cli-kit/node/system'

vi.mock('../local-storage.js')
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
  app: testApp({hasUIExtensions: () => false}),
  noTunnel: false,
  tunnelUrl: undefined,
  commandConfig: new Config({root: ''}),
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
})

describe('getURLs', () => {
  test('sends a request to get the URLs', async () => {
    // Given
    vi.mocked(partnersRequest).mockResolvedValueOnce({
      app: {applicationUrl: 'https://example.com', redirectUrlWhitelist: []},
    })
    const expectedVariables = {apiKey: 'apiKey'}

    // When
    await getURLs('apiKey', 'token')

    // Then
    expect(partnersRequest).toHaveBeenCalledWith(GetURLsQuery, 'token', expectedVariables)
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
    }

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(false)
  })

  test('returns true when the user selects always', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
    }
    vi.mocked(renderSelectPrompt).mockResolvedValue('always')

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(true)
  })

  test('returns true when the user selects yes', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
    }
    vi.mocked(renderSelectPrompt).mockResolvedValue('yes')

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(true)
  })

  test('returns false when the user selects never', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
    }
    vi.mocked(renderSelectPrompt).mockResolvedValue('never')

    // When
    const got = await shouldOrPromptUpdateURLs(options)

    // Then
    expect(got).toEqual(false)
  })

  test('returns false when the user selects no', async () => {
    // Given
    const options = {
      currentURLs,
      appDirectory: '/path',
    }
    vi.mocked(renderSelectPrompt).mockResolvedValue('no')

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
    }
    vi.mocked(renderSelectPrompt).mockResolvedValue('always')

    // When
    await shouldOrPromptUpdateURLs(options)

    // Then
    expect(setAppInfo).toHaveBeenNthCalledWith(1, {
      directory: '/path',
      updateURLs: true,
    })
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
      app: testApp({hasUIExtensions: () => true}),
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
    expect(setAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  test('Returns a codespace url if we are in a codespace environment', async () => {
    // Given
    vi.mocked(codespaceURL).mockReturnValue('codespace.url.fqdn.com')

    // When
    const got = await generateFrontendURL(defaultOptions)

    // Then
    expect(got).toEqual({
      frontendUrl: 'https://codespace.url.fqdn.com-4040.githubpreview.dev',
      frontendPort: 4040,
      usingLocalhost: false,
    })
    expect(setAppInfo).not.toBeCalled()
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
    expect(setAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  test('Returns a 1p app spin url if we are in a spin environment running a 1p app', async () => {
    // Given
    vi.mocked(isSpin).mockReturnValue(true)
    vi.mocked(appPort).mockReturnValue(1234)
    vi.mocked(appHost).mockReturnValue('1p-app-host.spin.domain.dev')

    // When
    const got = await generateFrontendURL(defaultOptions)

    // Then
    expect(got).toEqual({
      frontendUrl: 'https://1p-app-host.spin.domain.dev',
      frontendPort: 1234,
      usingLocalhost: false,
    })
    expect(setAppInfo).not.toBeCalled()
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
})

describe('validatePartnersURLs', () => {
  test('does not throw any error when the URLs are valid', () => {
    // Given
    const applicationUrl = 'http://example.com'
    const redirectUrlWhitelist = ['http://example.com/callback1', 'http://example.com/callback2']
    const urls: PartnersURLs = {applicationUrl, redirectUrlWhitelist}

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
})
