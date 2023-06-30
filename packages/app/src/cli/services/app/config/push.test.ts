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
          name: 'my app',
          api_contact_email: 'ryan@app.com',
          client_id: '12345',
          scopes: 'write_products',
          webhook_api_version: '04-2023',
          application_url: 'https://myapp.com',
        },
      }),
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

    expect(vi.mocked(partnersRequest).mock.calls[0]![2]!).toEqual({
      apiKey: '12345',
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Updated app configuration for my app',
      body: ['shopify.app.development.toml configuration is now live on Shopify.'],
    })
  })

  test('returns error when update mutation fails', async () => {
    const options: Options = {
      app: testApp({
        configurationPath: 'shopify.app.development.toml',
        configuration: {
          name: 'my app',
          api_contact_email: 'ryan@app.com',
          client_id: '12345',
          scopes: 'write_products',
          webhook_api_version: '04-2023',
          application_url: 'https://myapp.com',
        },
      }),
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
