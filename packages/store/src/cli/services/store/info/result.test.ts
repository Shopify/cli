import {renderStoreInfoResult} from './result.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {describe, test, expect, vi} from 'vitest'
import type {StoreInfoResult} from './types.js'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

function baseResult(overrides: Partial<StoreInfoResult> = {}): StoreInfoResult {
  return {
    subdomain: 'shop.myshopify.com',
    displayName: 'My Shop',
    ...overrides,
  }
}

function storeDetailItems(): string[] {
  const opts = vi.mocked(renderInfo).mock.calls[0]?.[0] as {
    customSections: {title: string; body: {list: {items: string[]}}}[]
  }
  const section = opts.customSections.find((sec) => sec.title === 'Store details')
  return section?.body.list.items ?? []
}

describe('renderStoreInfoResult', () => {
  test('emits the doc-shaped JSON via outputResult when format is json', () => {
    renderStoreInfoResult(
      baseResult({
        id: 'gid://shopify/Shop/72193245184',
        organizationId: '149572536',
        organizationName: 'Acme Holdings',
        storeOwner: {name: 'Jane Doe', email: 'jane@acme.com'},
        type: 'dev',
        plan: 'grow',
        featurePreview: 'extended_variants',
        adminUrl: 'https://admin.shopify.com/store/acme-widgets',
        saveUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
      }),
      'json',
    )

    expect(outputResult).toHaveBeenCalledOnce()
    const payload = vi.mocked(outputResult).mock.calls[0]?.[0] as string
    expect(JSON.parse(payload)).toEqual({
      id: 'gid://shopify/Shop/72193245184',
      displayName: 'My Shop',
      subdomain: 'shop.myshopify.com',
      organizationId: '149572536',
      organizationName: 'Acme Holdings',
      storeOwner: {name: 'Jane Doe', email: 'jane@acme.com'},
      type: 'dev',
      plan: 'grow',
      featurePreview: 'extended_variants',
      adminUrl: 'https://admin.shopify.com/store/acme-widgets',
      saveUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
    })
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('renders a Store details section in text format', () => {
    renderStoreInfoResult(baseResult(), 'text')

    expect(renderInfo).toHaveBeenCalledOnce()
    const opts = vi.mocked(renderInfo).mock.calls[0]?.[0] as {customSections: {title: string}[]}
    expect(opts.customSections.map((sec) => sec.title)).toEqual(['Store details'])
  })

  test('capitalizes the type and includes the doc fields', () => {
    renderStoreInfoResult(
      baseResult({
        id: 'gid://shopify/Shop/1',
        organizationName: 'Acme Holdings',
        type: 'dev',
        plan: 'grow',
        featurePreview: 'extended_variants',
        adminUrl: 'https://admin.shopify.com/store/acme-widgets',
        saveUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
      }),
      'text',
    )

    const items = storeDetailItems()
    expect(items).toContain('ID: gid://shopify/Shop/1')
    expect(items).toContain('Display Name: My Shop')
    expect(items).toContain('Subdomain: shop.myshopify.com')
    expect(items).toContain('Organization: Acme Holdings')
    expect(items).toContain('Type: Dev')
    expect(items).toContain('Plan: Grow')
    expect(items).toContain('Feature Preview: extended_variants')
    expect(items).toContain('Admin URL: https://admin.shopify.com/store/acme-widgets')
    expect(items).toContain('Save URL: https://admin.shopify.com/store-transfer/accept/claim-token')
  })

  test('formats the store owner as "name (email)" when both are present', () => {
    renderStoreInfoResult(baseResult({storeOwner: {name: 'Jane Doe', email: 'jane@acme.com'}}), 'text')
    expect(storeDetailItems()).toContain('Store owner: Jane Doe (jane@acme.com)')
  })

  test('falls back to the available store owner field when only one is present', () => {
    renderStoreInfoResult(baseResult({storeOwner: {name: 'Jane Doe'}}), 'text')
    expect(storeDetailItems()).toContain('Store owner: Jane Doe')
  })

  test('falls back to the email when the store owner has no name', () => {
    renderStoreInfoResult(baseResult({storeOwner: {email: 'jane@acme.com'}}), 'text')
    expect(storeDetailItems()).toContain('Store owner: jane@acme.com')
  })

  test('omits fields that are not present', () => {
    renderStoreInfoResult(baseResult(), 'text')
    const items = storeDetailItems()
    expect(items.some((item) => item.startsWith('Feature Preview'))).toBe(false)
    expect(items.some((item) => item.startsWith('Store owner'))).toBe(false)
    expect(items.some((item) => item.startsWith('Type'))).toBe(false)
    expect(items.some((item) => item.startsWith('Plan'))).toBe(false)
    expect(items.some((item) => item.startsWith('Save URL'))).toBe(false)
  })
})
