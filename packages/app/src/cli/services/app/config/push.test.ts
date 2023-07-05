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
    const app = testApp({
      configurationPath: 'shopify.app.development.toml',
      configuration: {
        name: 'my app',
        api_contact_email: 'ryan@app.com',
        client_id: '12345',
        scopes: 'write_products',
        webhook_api_version: '04-2023',
        application_url: 'https://myapp.com',
      },
    })
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
      contactEmail: 'ryan@app.com',
      embedded: undefined,
      gdprWebhooks: {
        customerDataRequestUrl: undefined,
        customerDeletionUrl: undefined,
        shopDeletionUrl: undefined,
      },
      posEmbedded: undefined,
      preferencesUrl: undefined,
      redirectUrlAllowlist: undefined,
      requestedAccessScopes: ['write_products'],
      title: 'my app',
      webhookApiVersion: '04-2023',
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my app',
      body: ['shopify.app.development.toml configuration is now live on Shopify.'],
    })
  })

  test('successfully calls the update mutation without scopes when legacy behavior', async () => {
    const app = testApp({
      configurationPath: 'shopify.app.development.toml',
      configuration: {
        name: 'my app',
        api_contact_email: 'ryan@app.com',
        client_id: '12345',
        scopes: 'write_products',
        webhook_api_version: '04-2023',
        application_url: 'https://myapp.com',
        legacy_scopes_behavior: true,
      },
    })
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
      contactEmail: 'ryan@app.com',
      embedded: undefined,
      gdprWebhooks: {
        customerDataRequestUrl: undefined,
        customerDeletionUrl: undefined,
        shopDeletionUrl: undefined,
      },
      posEmbedded: undefined,
      preferencesUrl: undefined,
      redirectUrlAllowlist: undefined,
      title: 'my app',
      webhookApiVersion: '04-2023',
    })

    expect(vi.mocked(partnersRequest).mock.calls[2]![2]!).toEqual({
      apiKey: '12345',
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my app',
      body: ['shopify.app.development.toml configuration is now live on Shopify.'],
    })
  })

  test('successfully calls the update mutation with empty scopes', async () => {
    const app = testApp({
      configurationPath: 'shopify.app.development.toml',
      configuration: {
        name: 'my app',
        api_contact_email: 'ryan@app.com',
        client_id: '12345',
        scopes: '',
        webhook_api_version: '04-2023',
        application_url: 'https://myapp.com',
      },
    })
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
      contactEmail: 'ryan@app.com',
      embedded: undefined,
      gdprWebhooks: {
        customerDataRequestUrl: undefined,
        customerDeletionUrl: undefined,
        shopDeletionUrl: undefined,
      },
      posEmbedded: undefined,
      preferencesUrl: undefined,
      redirectUrlAllowlist: undefined,
      requestedAccessScopes: [],
      title: 'my app',
      webhookApiVersion: '04-2023',
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my app',
      body: ['shopify.app.development.toml configuration is now live on Shopify.'],
    })
  })

  test('app proxy is updated upstream when defined', async () => {
    const app = testApp({
      configurationPath: 'shopify.app.development.toml',
      configuration: {
        name: 'my app',
        api_contact_email: 'ryan@app.com',
        client_id: '12345',
        webhook_api_version: '04-2023',
        application_url: 'https://myapp.com',
        proxy: {
          url: 'https://proxy.com',
          subpath: '/my-app',
          prefix: 'apps',
        },
      },
    })
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
      appProxy: {
        proxySubPath: '/my-app',
        proxySubPathPrefix: 'apps',
        proxyUrl: 'https://proxy.com',
      },
      applicationUrl: 'https://myapp.com',
      contactEmail: 'ryan@app.com',
      embedded: undefined,
      gdprWebhooks: {
        customerDataRequestUrl: undefined,
        customerDeletionUrl: undefined,
        shopDeletionUrl: undefined,
      },
      posEmbedded: undefined,
      preferencesUrl: undefined,
      redirectUrlAllowlist: undefined,
      requestedAccessScopes: [],
      title: 'my app',
      webhookApiVersion: '04-2023',
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my app',
      body: ['shopify.app.development.toml configuration is now live on Shopify.'],
    })
  })

  test('returns error when update mutation fails', async () => {
    const app = testApp({
      configurationPath: 'shopify.app.development.toml',
      configuration: {
        name: 'my app',
        api_contact_email: 'ryan@app.com',
        client_id: '12345',
        scopes: 'write_products',
        webhook_api_version: '04-2023',
        application_url: 'https://myapp.com',
      },
    })
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
})
