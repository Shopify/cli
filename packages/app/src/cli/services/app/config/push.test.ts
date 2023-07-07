import {Options, pushConfig} from './push.js'
import {testApp} from '../../../models/app/app.test-data.js'
import {describe, vi, test, expect} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/session')

describe('pushConfig', () => {
  test('successfully calls the update mutation when push is run and a file is present', async () => {
    const app = testApp({}, 'current')
    const options: Options = {
      configuration: app.configuration,
      configurationPath: app.configurationPath,
    }

    vi.mocked(partnersRequest).mockResolvedValue({
      app: {
        apiKey: '12345',
      },
      appUpdate: {
        userErrors: [],
      },
    })

    await pushConfig(options)

    expect(vi.mocked(partnersRequest).mock.calls[1]![2]!).toEqual({
      apiKey: '12345',
      applicationUrl: 'https://myapp.com',
      contactEmail: 'wils@bahan-lee.com',
      embedded: undefined,
      gdprWebhooks: {
        customerDataRequestUrl: undefined,
        customerDeletionUrl: undefined,
        shopDeletionUrl: undefined,
      },
      posEmbedded: null,
      preferencesUrl: null,
      redirectUrlAllowlist: null,
      requestedAccessScopes: [],
      title: 'my app',
      webhookApiVersion: '2023-04',
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my app',
      body: ['shopify.app.toml configuration is now live on Shopify.'],
    })
  })

  test('successfully calls the update mutation without scopes when legacy behavior. does not call scopes clear when upstream doesnt have scopes.', async () => {
    const app = testApp({}, 'current')

    app.configuration = {...app.configuration, access_scopes: {scopes: 'write_products', use_legacy_install_flow: true}}
    const options: Options = {
      configuration: app.configuration,
      configurationPath: app.configurationPath,
    }

    vi.mocked(partnersRequest).mockResolvedValue({
      app: {
        apiKey: '12345',
      },
      appUpdate: {
        userErrors: [],
      },
    })

    await pushConfig(options)

    expect(vi.mocked(partnersRequest).mock.calls[1]![2]!).toEqual({
      apiKey: '12345',
      applicationUrl: 'https://myapp.com',
      contactEmail: 'wils@bahan-lee.com',
      embedded: undefined,
      gdprWebhooks: {
        customerDataRequestUrl: undefined,
        customerDeletionUrl: undefined,
        shopDeletionUrl: undefined,
      },
      posEmbedded: null,
      preferencesUrl: null,
      redirectUrlAllowlist: null,
      title: 'my app',
      webhookApiVersion: '2023-04',
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my app',
      body: ['shopify.app.toml configuration is now live on Shopify.'],
    })
  })

  test('successfully calls the update mutation with empty scopes', async () => {
    const app = testApp({}, 'current')
    app.configuration = {...app.configuration, access_scopes: {scopes: ''}}

    const options: Options = {
      configuration: app.configuration,
      configurationPath: app.configurationPath,
    }

    vi.mocked(partnersRequest).mockResolvedValue({
      app: {
        apiKey: '12345',
      },
      appUpdate: {
        userErrors: [],
      },
    })

    await pushConfig(options)

    expect(vi.mocked(partnersRequest).mock.calls[1]![2]!).toEqual({
      apiKey: '12345',
      applicationUrl: 'https://myapp.com',
      contactEmail: 'wils@bahan-lee.com',
      embedded: undefined,
      gdprWebhooks: {
        customerDataRequestUrl: undefined,
        customerDeletionUrl: undefined,
        shopDeletionUrl: undefined,
      },
      posEmbedded: null,
      preferencesUrl: null,
      redirectUrlAllowlist: null,
      title: 'my app',
      requestedAccessScopes: [],
      webhookApiVersion: '2023-04',
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my app',
      body: ['shopify.app.toml configuration is now live on Shopify.'],
    })
  })

  test('returns error when update mutation fails', async () => {
    const app = testApp({}, 'current')
    const options: Options = {
      configuration: app.configuration,
      configurationPath: app.configurationPath,
    }

    vi.mocked(partnersRequest).mockResolvedValue({
      appUpdate: {
        userErrors: [{message: 'failed to update app'}],
      },
    })

    const result = pushConfig(options)

    await expect(result).rejects.toThrow("Couldn't find app. Make sure you have a valid client ID.")
  })

  test('app proxy is updated upstream when defined', async () => {
    const app = testApp({}, 'current')
    app.configuration = {
      ...app.configuration,
      app_proxy: {
        url: 'foo',
        subpath: 'foo',
        prefix: 'foo',
      },
    }

    const options: Options = {
      configuration: app.configuration,
      configurationPath: app.configurationPath,
    }

    vi.mocked(partnersRequest).mockResolvedValue({
      app: {
        apiKey: '12345',
      },
      appUpdate: {
        userErrors: [],
      },
    })

    await pushConfig(options)

    expect(vi.mocked(partnersRequest).mock.calls[1]![2]!).toEqual({
      apiKey: '12345',
      title: 'my app',
      applicationUrl: 'https://myapp.com',
      contactEmail: 'wils@bahan-lee.com',
      gdprWebhooks: {
        customerDataRequestUrl: undefined,
        customerDeletionUrl: undefined,
        shopDeletionUrl: undefined,
      },
      webhookApiVersion: '2023-04',
      redirectUrlAllowlist: null,
      embedded: undefined,
      posEmbedded: null,
      preferencesUrl: null,
      requestedAccessScopes: [],
      appProxy: {
        proxySubPath: 'foo',
        proxySubPathPrefix: 'foo',
        proxyUrl: 'foo',
      },
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my app',
      body: ['shopify.app.toml configuration is now live on Shopify.'],
    })
  })
})
