import {executePreviewStoreCommand} from './execute.js'
import {executePreviewStoreAdminQuery} from './client.js'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./client.js')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/output')

describe('executePreviewStoreCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(executePreviewStoreAdminQuery).mockResolvedValue({data: {shop: {name: 'Preview Shop'}}})
  })

  test('prefers store_auth_bootstrap.shop_domain when reading preview create json', async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({
      shop_permanent_domain: 'preview-shop.my.shop.dev',
      admin_api_token: 'admin-token',
      store_auth_bootstrap: {
        shop_domain: 'preview-shop.dev-api.shop.dev',
      },
    })))

    await executePreviewStoreCommand({
      fromFile: '/tmp/preview.json',
      query: 'query { shop { name } }',
      apiVersion: 'unstable',
      allowMutations: false,
      json: true,
    })

    expect(executePreviewStoreAdminQuery).toHaveBeenCalledWith({
      domain: 'preview-shop.dev-api.shop.dev',
      token: 'admin-token',
      apiVersion: 'unstable',
      query: 'query { shop { name } }',
      variables: undefined,
    })
    expect(outputResult).toHaveBeenCalledWith(JSON.stringify({data: {shop: {name: 'Preview Shop'}}}, null, 0))
  })

  test('falls back to shop_permanent_domain for older preview create json', async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from(JSON.stringify({
      shop_permanent_domain: 'preview-shop.myshopify.com',
      admin_api_token: 'admin-token',
    })))

    await executePreviewStoreCommand({
      fromFile: '/tmp/preview.json',
      query: 'query { shop { name } }',
      apiVersion: 'unstable',
      allowMutations: false,
      json: true,
    })

    expect(executePreviewStoreAdminQuery).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'preview-shop.myshopify.com',
    }))
  })

  test('maps preview-store permanent domains to the api host for manual input', async () => {
    await executePreviewStoreCommand({
      domain: 'preview-shop.my.shop.dev',
      token: 'admin-token',
      query: 'query { shop { name } }',
      apiVersion: 'unstable',
      allowMutations: false,
      json: true,
    })

    expect(executePreviewStoreAdminQuery).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'preview-shop.dev-api.shop.dev',
    }))
  })
})
