import {openStore} from './open.js'
import {getStoreInfo} from './info/index.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./info/index.js')
vi.mock('@shopify/cli-kit/node/system')

describe('openStore', () => {
  beforeEach(() => {
    vi.mocked(openURL).mockResolvedValue(true)
  })

  test('opens the canonical storefront URL for a regular store', async () => {
    vi.mocked(getStoreInfo).mockResolvedValue({subdomain: 'shop.myshopify.com'})

    const result = await openStore({store: 'shop.myshopify.com'})

    expect(getStoreInfo).toHaveBeenCalledWith({store: 'shop.myshopify.com'})
    expect(openURL).toHaveBeenCalledWith('https://shop.myshopify.com')
    expect(result).toEqual({store: 'shop.myshopify.com', url: 'https://shop.myshopify.com', opened: true})
  })

  test('prefers the preview-store access URL when present', async () => {
    vi.mocked(getStoreInfo).mockResolvedValue({
      subdomain: 'preview.myshopify.com',
      accessUrl: 'https://preview.myshopify.com/?token=abc',
    })

    const result = await openStore({store: 'preview.myshopify.com'})

    expect(openURL).toHaveBeenCalledWith('https://preview.myshopify.com/?token=abc')
    expect(result.url).toBe('https://preview.myshopify.com/?token=abc')
  })

  test('returns the URL when the browser does not open', async () => {
    vi.mocked(getStoreInfo).mockResolvedValue({subdomain: 'shop.myshopify.com'})
    vi.mocked(openURL).mockResolvedValue(false)

    const result = await openStore({store: 'shop.myshopify.com'})

    expect(result).toEqual({store: 'shop.myshopify.com', url: 'https://shop.myshopify.com', opened: false})
  })
})
