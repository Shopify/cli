import {
  updateURLs,
  generateURL,
  getURLs,
  shouldOrPromptUpdateURLs,
  generateFrontendURL,
  generatePartnersURLs,
  PartnersURLs,
  validatePartnersURLs,
} from './urls.js'
import {testApp} from '../../models/app/app.test-data.js'
import {UpdateURLsQuery} from '../../api/graphql/update_urls.js'
import {GetURLsQuery} from '../../api/graphql/get_urls.js'
import {setAppInfo} from '../conf.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Config} from '@oclif/core'
import {err, ok} from '@shopify/cli-kit/node/result'
import {AbortError, AbortSilentError, BugError} from '@shopify/cli-kit/node/error'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {isSpin, spinFqdn} from '@shopify/cli-kit/node/environment/spin'
import {codespaceURL, gitpodURL, isUnitTest} from '@shopify/cli-kit/node/environment/local'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {runTunnelPlugin} from '@shopify/cli-kit/node/plugins'

beforeEach(() => {
  vi.mock('../conf.js')
  vi.mock('@shopify/cli-kit/node/tcp')
  vi.mocked(getAvailableTCPPort).mockResolvedValue(3042)
  vi.mock('@shopify/cli-kit/node/api/partners')
  vi.mock('@shopify/cli-kit/node/session')
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mock('@shopify/cli-kit/node/environment/spin')
  vi.mock('@shopify/cli-kit/node/environment/local')
  vi.mock('@shopify/cli-kit/node/plugins')
  vi.mocked(isUnitTest).mockReturnValue(true)
  vi.mock('@shopify/cli-kit/node/ui')
})

describe('generateURL', () => {
  it('returns a tunnel URL by default', async () => {
    // Given
    const config = new Config({root: ''})
    vi.mocked(runTunnelPlugin).mockResolvedValueOnce(ok('https://fake-url.ngrok.io'))

    // When
    const got = await generateURL(config, 3456)

    // Then
    expect(got).toEqual('https://fake-url.ngrok.io')
  })

  it('throws error if there are multiple urls', async () => {
    // Given
    const config = new Config({root: ''})
    vi.mocked(runTunnelPlugin).mockResolvedValueOnce(err({provider: 'ngrok', type: 'multiple-urls'}))

    // When
    const got = generateURL(config, 3456)

    // Then
    await expect(got).rejects.toThrow(BugError)
    await expect(got).rejects.toThrow(/Multiple tunnel plugins for ngrok found/)
  })

  it('throws error if there is no provider', async () => {
    // Given
    const config = new Config({root: ''})
    vi.mocked(runTunnelPlugin).mockResolvedValueOnce(err({provider: 'ngrok', type: 'no-provider'}))

    // When
    const got = generateURL(config, 3456)

    // Then
    await expect(got).rejects.toThrow(BugError)
    await expect(got).rejects.toThrow(/We couldn't find the ngrok tunnel plugin/)
  })

  it('throws error if there is an unknown error with the provider', async () => {
    // Given
    const config = new Config({root: ''})
    vi.mocked(runTunnelPlugin).mockResolvedValueOnce(err({provider: 'ngrok', type: 'unknown', message: 'message'}))

    // When
    const got = generateURL(config, 3456)

    // Then
    await expect(got).rejects.toThrow(BugError)
    await expect(got).rejects.toThrow(/message/)
  })

  it('throws error if there are no tunnel urls', async () => {
    // Given
    const config = new Config({root: ''})
    vi.mocked(runTunnelPlugin).mockResolvedValueOnce(err({provider: 'ngrok', type: 'handled-error'}))

    // When
    const got = generateURL(config, 3456)

    // Then
    await expect(got).rejects.toThrow(AbortSilentError)
  })
})

describe('updateURLs', () => {
  it('sends a request to update the URLs', async () => {
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

  it('throws an error if requests has a user error', async () => {
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
  it('sends a request to get the URLs', async () => {
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
    vi.mocked(renderSelectPrompt).mockResolvedValue('always')

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
    vi.mocked(renderSelectPrompt).mockResolvedValue('yes')

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
    vi.mocked(renderSelectPrompt).mockResolvedValue('never')

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
    vi.mocked(renderSelectPrompt).mockResolvedValue('no')

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

  it('returns tunnelUrl when there is a tunnelUrl ignoring all other false values', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: false,
      noTunnel: false,
      tunnelUrl: 'https://my-tunnel-provider.io:4242',
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://my-tunnel-provider.io', frontendPort: 4242, usingLocalhost: false})
  })

  it('returns tunnelUrl when there is a tunnelUrl ignoring all other true values', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => true}),
      tunnel: true,
      noTunnel: true,
      tunnelUrl: 'https://my-tunnel-provider.io:4242',
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://my-tunnel-provider.io', frontendPort: 4242, usingLocalhost: false})
  })

  it('generates a tunnel url when tunnel is true and there is no tunnelUrl and there are no extensions', async () => {
    // Given
    vi.mocked(runTunnelPlugin).mockResolvedValueOnce(ok('https://fake-url.ngrok.io'))
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: true,
      noTunnel: false,
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://fake-url.ngrok.io', frontendPort: 3042, usingLocalhost: false})
  })

  it('returns localhost if tunnel is false and there is no tunnelUrl nor extensions', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: false,
      noTunnel: false,
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'http://localhost', frontendPort: 3042, usingLocalhost: true})
    expect(renderSelectPrompt).not.toBeCalled()
  })

  it('returns localhost if noTunnel is true even if there are extensions', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => true}),
      tunnel: false,
      noTunnel: true,
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'http://localhost', frontendPort: 3042, usingLocalhost: true})
    expect(renderSelectPrompt).not.toBeCalled()
  })

  it('raises error if tunnelUrl does not include port', async () => {
    // Given
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: false,
      noTunnel: false,
      tunnelUrl: 'https://my-tunnel-provider.io',
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = generateFrontendURL(options)

    // Then
    await expect(got).rejects.toThrow(/Invalid tunnel URL/)
  })

  it('cancels execution if you select not to continue in the plugin prompt', async () => {
    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue('cancel')
    const options = {
      app: testApp({hasUIExtensions: () => true}),
      tunnel: true,
      noTunnel: false,
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = generateFrontendURL(options)

    // Then
    await expect(got).rejects.toThrow()
  })

  it('Reuses tunnel option if cached even if tunnel is false and there are no extensions', async () => {
    // Given
    vi.mocked(runTunnelPlugin).mockResolvedValueOnce(ok('https://fake-url.ngrok.io'))
    const options = {
      app: testApp({hasUIExtensions: () => false, directory: '/app-path'}),
      tunnel: false,
      noTunnel: false,
      cachedTunnelPlugin: 'ngrok',
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://fake-url.ngrok.io', frontendPort: 3042, usingLocalhost: false})
    expect(setAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  it('Returns a gitpod url if we are in a gitpod environment', async () => {
    // Given
    vi.mocked(gitpodURL).mockReturnValue('https://gitpod.url.fqdn.com')
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: false,
      noTunnel: false,
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://4040-gitpod.url.fqdn.com', frontendPort: 4040, usingLocalhost: false})
    expect(setAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  it('Returns a codespace url if we are in a codespace environment', async () => {
    // Given
    vi.mocked(codespaceURL).mockReturnValue('codespace.url.fqdn.com')
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: false,
      noTunnel: false,
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({
      frontendUrl: 'https://codespace.url.fqdn.com-4040.githubpreview.dev',
      frontendPort: 4040,
      usingLocalhost: false,
    })
    expect(setAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  it('Returns a spin url if we are in a spin environment', async () => {
    // Given
    vi.mocked(isSpin).mockReturnValue(true)
    vi.mocked(spinFqdn).mockResolvedValue('spin.domain.dev')
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: false,
      noTunnel: false,
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({
      frontendUrl: 'https://cli.spin.domain.dev',
      frontendPort: 4040,
      usingLocalhost: false,
    })
    expect(setAppInfo).not.toBeCalled()
    expect(renderSelectPrompt).not.toBeCalled()
  })

  it('Returns a custom tunnel url if we are in a spin environment but a custom tunnel option is active', async () => {
    // Given
    vi.mocked(isSpin).mockReturnValue(true)
    const options = {
      app: testApp({hasUIExtensions: () => false}),
      tunnel: true,
      noTunnel: false,
      tunnelUrl: 'https://my-tunnel-provider.io:4242',
      commandConfig: new Config({root: ''}),
    }

    // When
    const got = await generateFrontendURL(options)

    // Then
    expect(got).toEqual({frontendUrl: 'https://my-tunnel-provider.io', frontendPort: 4242, usingLocalhost: false})
  })
})

describe('generatePartnersURLs', () => {
  it('Returns the default values without an override', () => {
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

  it('Returns just the override value when set as a string', () => {
    const applicationUrl = 'http://my-base-url'
    const overridePath = '/my/custom/path'

    const got = generatePartnersURLs(applicationUrl, overridePath)

    expect(got).toMatchObject({
      applicationUrl,
      redirectUrlWhitelist: [`${applicationUrl}${overridePath}`],
    })
  })

  it('Returns just the override values when set as an array', () => {
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
  it('does not throw any error when the URLs are valid', () => {
    // Given
    const applicationUrl = 'http://example.com'
    const redirectUrlWhitelist = ['http://example.com/callback1', 'http://example.com/callback2']
    const urls: PartnersURLs = {applicationUrl, redirectUrlWhitelist}

    // When/Then
    validatePartnersURLs(urls)
  })

  it('it raises an error when the application URL is not valid', () => {
    // Given
    const applicationUrl = 'wrong'
    const redirectUrlWhitelist = ['http://example.com/callback1', 'http://example.com/callback2']
    const urls: PartnersURLs = {applicationUrl, redirectUrlWhitelist}

    // When/Then
    expect(() => validatePartnersURLs(urls)).toThrow(/Invalid application URL/)
  })

  it('it raises an error when the redirection URLs are not valid', () => {
    // Given
    const applicationUrl = 'http://example.com'
    const redirectUrlWhitelist = ['http://example.com/callback1', 'wrong']
    const urls: PartnersURLs = {applicationUrl, redirectUrlWhitelist}

    // When/Then
    expect(() => validatePartnersURLs(urls)).toThrow(/Invalid redirection URLs/)
  })
})
