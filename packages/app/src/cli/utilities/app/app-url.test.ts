import {buildAppURLForWeb} from './app-url.js'
import {describe, expect, test, vi} from 'vitest'
import {normalizeStoreFqdn, storeAdminUrl} from '@shopify/cli-kit/node/context/fqdn'

vi.mock('@shopify/cli-kit/node/context/fqdn', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shopify/cli-kit/node/context/fqdn')>()
  return {
    ...original,
    normalizeStoreFqdn: vi.fn(original.normalizeStoreFqdn),
    storeAdminUrl: vi.fn(original.storeAdminUrl),
  }
})

describe('buildAppURLForWeb', () => {
  test('builds the admin-web preflight preview URL for production stores', () => {
    const url = buildAppURLForWeb('my-store.myshopify.com', 'api-key')

    expect(url).toBe('https://admin.shopify.com/store/my-store/extensions-dev/preview?client_id=api-key')
  })

  test('uses the same admin-web path in local development with the admin.shop.dev host', () => {
    vi.mocked(normalizeStoreFqdn).mockReturnValue('my-store.my.shop.dev')
    vi.mocked(storeAdminUrl).mockReturnValue('admin.shop.dev/store/my-store')

    const url = buildAppURLForWeb('my-store.my.shop.dev', 'api-key')

    expect(url).toBe('https://admin.shop.dev/store/my-store/extensions-dev/preview?client_id=api-key')
  })
})
