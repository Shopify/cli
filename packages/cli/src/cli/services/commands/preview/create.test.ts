import {createPreviewStoreCommand} from './create.js'
import {createPreviewStore} from './client.js'
import {importPreviewStoreBootstrap} from './bootstrap.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./client.js')
vi.mock('./bootstrap.js')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

const previewResponse = {
  shop_id: 1,
  shop_permanent_domain: 'preview-shop.my.shop.dev',
  placeholder_account_uuid: 'placeholder-user-id',
  admin_api_token: 'admin-token',
  magic_link_url: 'https://example.com/magic-link',
  cli_identity_bootstrap: {
    access_token: 'identity-token',
    refresh_token: 'refresh-token',
    expires_in: 1800,
    user_id: 'placeholder-user-id',
  },
  store_auth_bootstrap: {
    access_token: 'store-token',
    scopes: ['read_products'],
    api_key: 'development-shop-merchant-key',
    shop_domain: 'preview-shop.dev-api.shop.dev',
  },
}

describe('createPreviewStoreCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createPreviewStore).mockResolvedValue(previewResponse)
    vi.mocked(importPreviewStoreBootstrap).mockResolvedValue({identityImported: true, storeAuthImported: true})
  })

  test('imports bootstrap payloads before rendering text output', async () => {
    await createPreviewStoreCommand({
      shopName: 'preview-shop',
      json: false,
    })

    expect(createPreviewStore).toHaveBeenCalled()
    expect(importPreviewStoreBootstrap).toHaveBeenCalledWith(previewResponse)
    expect(renderSuccess).toHaveBeenCalled()
    const renderCall = vi.mocked(renderSuccess).mock.calls[0]?.[0]
    expect(renderCall?.nextSteps).toContainEqual([
      'Run an Admin GraphQL query:',
      {command: "shopify preview execute --domain preview-shop.my.shop.dev --token admin-token --query '{ shop { name } }'"},
    ])
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('imports bootstrap payloads before emitting json output', async () => {
    await createPreviewStoreCommand({
      shopName: 'preview-shop',
      json: true,
    })

    expect(importPreviewStoreBootstrap).toHaveBeenCalledWith(previewResponse)
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify(previewResponse, null, 2))
    expect(renderSuccess).not.toHaveBeenCalled()
  })
})
