import {buildAppURLForAdmin, buildAppURLForMobile, buildAppURLForWeb, buildDevConsoleURL} from './app-url.js'
import {describe, expect, test} from 'vitest'

describe('buildAppURLForWeb', () => {
  test('builds the OAuth redirect URL from a store handle', () => {
    expect(buildAppURLForWeb('my-store', 'api-key')).toBe(
      'https://my-store.myshopify.com/admin/oauth/redirect_from_cli?client_id=api-key',
    )
  })

  test('keeps a store FQDN that already includes the domain', () => {
    expect(buildAppURLForWeb('my-store.myshopify.com', 'api-key')).toBe(
      'https://my-store.myshopify.com/admin/oauth/redirect_from_cli?client_id=api-key',
    )
  })

  test('throws when the store value is not a valid store', () => {
    expect(() => buildAppURLForWeb('https://my-store.myshopify.com/products', 'api-key')).toThrow('Invalid store value')
  })
})

describe('buildAppURLForAdmin', () => {
  test('uses only the store name within the admin domain', () => {
    expect(buildAppURLForAdmin('my-store.myshopify.com', 'api-key', 'admin.shopify.com')).toBe(
      'https://admin.shopify.com/store/my-store/apps/api-key?dev-console=show',
    )
  })
})

describe('buildDevConsoleURL', () => {
  test('points at the store admin with the dev console open', () => {
    expect(buildDevConsoleURL('my-store')).toBe('https://my-store.myshopify.com/admin?dev-console=show')
  })
})

describe('buildAppURLForMobile', () => {
  test('encodes the host parameter as unpadded base64', () => {
    const url = new URL(buildAppURLForMobile('my-store', 'api-key'))

    expect(url.searchParams.get('shop')).toBe('my-store.myshopify.com')
    expect(url.searchParams.get('host')).toBe('bXktc3RvcmUubXlzaG9waWZ5LmNvbS9hZG1pbi9hcHBzL2FwaS1rZXk')
    expect(Buffer.from(url.searchParams.get('host') ?? '', 'base64').toString()).toBe(
      'my-store.myshopify.com/admin/apps/api-key',
    )
  })
})
