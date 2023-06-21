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
    const options: Options = {
      app: testApp({
        configurationPath: 'shopify.app.development.toml',
        configuration: {
          client_id: 'my-key',
          name: 'my-app',
          scopes: 'read_products',
          application_url: 'https://my-apps-url.com',
          redirect_url_allowlist: ['https://my-apps-url.com/auth/shopify', 'https://my-apps-url.com/auth/callback'],
        },
      }),
    }

    vi.mocked(partnersRequest).mockResolvedValue({
      appUpdate: {
        userErrors: [],
      },
    })

    await pushConfig(options)

    expect(vi.mocked(partnersRequest).mock.calls[0]![2]!).toEqual({
      apiKey: 'my-key',
      title: 'my-app',
      applicationUrl: 'https://my-apps-url.com',
      redirectUrlAllowlist: ['https://my-apps-url.com/auth/shopify', 'https://my-apps-url.com/auth/callback'],
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my-app',
      body: ['shopify.app.development.toml configuration is now live on Shopify.'],
    })
  })

  test('returns error when update mutation fails', async () => {
    const options: Options = {
      app: testApp({
        configurationPath: 'shopify.app.development.toml',
        configuration: {
          client_id: 'my-key',
          name: 'my-app',
          scopes: 'read_products',
          application_url: 'https://my-apps-url.com',
          redirect_url_allowlist: ['https://my-apps-url.com/auth/shopify', 'https://my-apps-url.com/auth/callback'],
        },
      }),
    }

    vi.mocked(partnersRequest).mockResolvedValue({
      appUpdate: {
        userErrors: [{message: 'failed to update app'}],
      },
    })

    const result = pushConfig(options)

    await expect(result).rejects.toThrow(/failed to update app/)
  })

  test('returns error if there is no client id', async () => {
    const options: Options = {
      app: testApp({
        configurationPath: 'shopify.app.development.toml',
        configuration: {
          name: 'my-app',
          scopes: 'read_products',
          application_url: 'https://my-apps-url.com',
          redirect_url_allowlist: ['https://my-apps-url.com/auth/shopify', 'https://my-apps-url.com/auth/callback'],
        },
      }),
    }

    const result = pushConfig(options)

    await expect(result).rejects.toThrow(/shopify.app.development.toml does not contain a client_id./)
  })
})
