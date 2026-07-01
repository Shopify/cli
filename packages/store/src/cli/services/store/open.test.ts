import {openStore} from './open.js'
import {getStoreInfo} from './info/index.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./info/index.js')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/ui')

describe('openStore', () => {
  beforeEach(() => {
    vi.mocked(openURL).mockResolvedValue(true)
  })

  test('opens the canonical storefront URL for a regular store', async () => {
    vi.mocked(getStoreInfo).mockResolvedValue({subdomain: 'shop.myshopify.com'})

    await openStore({store: 'shop.myshopify.com'})

    expect(getStoreInfo).toHaveBeenCalledWith({store: 'shop.myshopify.com'})
    expect(openURL).toHaveBeenCalledWith('https://shop.myshopify.com')
    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({headline: expect.stringContaining('Opening the storefront')}),
    )
  })

  test('prefers the preview-store access URL when present', async () => {
    vi.mocked(getStoreInfo).mockResolvedValue({
      subdomain: 'preview.myshopify.com',
      accessUrl: 'https://preview.myshopify.com/?token=abc',
    })

    await openStore({store: 'preview.myshopify.com'})

    expect(openURL).toHaveBeenCalledWith('https://preview.myshopify.com/?token=abc')
  })

  test('prints the URL manually when the browser does not open', async () => {
    vi.mocked(getStoreInfo).mockResolvedValue({subdomain: 'shop.myshopify.com'})
    vi.mocked(openURL).mockResolvedValue(false)

    await openStore({store: 'shop.myshopify.com'})

    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({headline: expect.stringContaining("didn't open automatically")}),
    )
  })

  test('opens the admin URL when admin is requested', async () => {
    vi.mocked(getStoreInfo).mockResolvedValue({
      subdomain: 'shop.myshopify.com',
      adminUrl: 'https://admin.shopify.com/store/shop',
    })

    await openStore({store: 'shop.myshopify.com', admin: true})

    expect(openURL).toHaveBeenCalledWith('https://admin.shopify.com/store/shop')
    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({headline: expect.stringContaining('the Shopify admin')}),
    )
  })

  test('routes through the save URL for a preview store with admin, opening the admin after saving', async () => {
    vi.mocked(getStoreInfo).mockResolvedValue({
      subdomain: 'preview.myshopify.com',
      accessUrl: 'https://preview.myshopify.com/?token=abc',
      saveUrl: 'https://app.shopify.com/auth/preview-store/123?preview_store_auth_token=xyz',
    })

    await openStore({store: 'preview.myshopify.com', admin: true})

    expect(openURL).toHaveBeenCalledWith('https://app.shopify.com/auth/preview-store/123?preview_store_auth_token=xyz')
    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({headline: expect.stringContaining('the Shopify admin (saving your store first)')}),
    )
  })

  test('throws when admin is requested but no admin or save URL is available', async () => {
    vi.mocked(getStoreInfo).mockResolvedValue({subdomain: 'shop.myshopify.com'})

    await expect(openStore({store: 'shop.myshopify.com', admin: true})).rejects.toThrow(
      /Couldn't determine an admin URL/,
    )
    expect(openURL).not.toHaveBeenCalled()
  })
})
