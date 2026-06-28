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

function storeDetailRows(): unknown[][] {
  const opts = vi.mocked(renderInfo).mock.calls[0]?.[0] as {
    customSections: {title: string; body: {tabularData: unknown[][]}}[]
  }
  const section = opts.customSections.find((sec) => sec.title === 'Store details')
  return section?.body.tabularData ?? []
}

function storeActions(): unknown[] {
  const opts = vi.mocked(renderInfo).mock.calls[0]?.[0] as {
    customSections: {title?: string; body: {list?: {items: unknown[]}}}[]
  }
  const section = opts.customSections.find((sec) => sec.body?.list)
  return section?.body.list?.items ?? []
}

// The labels of the detail rows (first cell of each row).
function rowLabels(): string[] {
  return storeDetailRows().map((row) => row[0] as string)
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
        accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
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
      accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
      saveUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
    })
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('includes authScopes in the JSON output when present', () => {
    renderStoreInfoResult(baseResult({authScopes: ['read_themes', 'write_themes']}), 'json')

    const payload = vi.mocked(outputResult).mock.calls[0]?.[0] as string
    expect(JSON.parse(payload).authScopes).toEqual(['read_themes', 'write_themes'])
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
      }),
      'text',
    )

    const rows = storeDetailRows()
    expect(rows).toContainEqual(['ID', 'gid://shopify/Shop/1'])
    expect(rows).toContainEqual(['Display Name', 'My Shop'])
    expect(rows).toContainEqual(['Subdomain', 'shop.myshopify.com'])
    expect(rows).toContainEqual(['Organization', 'Acme Holdings'])
    expect(rows).toContainEqual(['Type', 'Dev'])
    expect(rows).toContainEqual(['Plan', 'Grow'])
    expect(rows).toContainEqual(['Feature Preview', 'extended_variants'])
  })

  test('renders store URLs as next-step action links', () => {
    renderStoreInfoResult(
      baseResult({
        adminUrl: 'https://admin.shopify.com/store/acme-widgets',
        accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
        saveUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
      }),
      'text',
    )

    const actions = storeActions()
    expect(actions).toEqual([
      {link: {label: 'Manage this store in the Shopify admin', url: 'https://admin.shopify.com/store/acme-widgets'}},
      {link: {label: 'View the storefront', url: 'https://app.shopify.com/auth/preview-store?token=access-token'}},
      {
        link: {
          label: 'Save your progress on this store',
          url: 'https://admin.shopify.com/store-transfer/accept/claim-token',
        },
      },
    ])
    // URLs are no longer rendered as detail rows.
    expect(rowLabels()).not.toContain('Admin URL')
    expect(rowLabels()).not.toContain('Access URL')
    expect(rowLabels()).not.toContain('Save URL')
  })

  test('omits action links for URLs that are not present', () => {
    renderStoreInfoResult(baseResult({adminUrl: 'https://admin.shopify.com/store/acme-widgets'}), 'text')
    expect(storeActions()).toEqual([
      {link: {label: 'Manage this store in the Shopify admin', url: 'https://admin.shopify.com/store/acme-widgets'}},
    ])
  })

  test('omits next steps entirely when no URLs are present', () => {
    renderStoreInfoResult(baseResult(), 'text')
    expect(storeActions()).toEqual([])
  })

  test('formats the store owner as "name (email)" when both are present', () => {
    renderStoreInfoResult(baseResult({storeOwner: {name: 'Jane Doe', email: 'jane@acme.com'}}), 'text')
    expect(storeDetailRows()).toContainEqual(['Store owner', 'Jane Doe (jane@acme.com)'])
  })

  test('falls back to the available store owner field when only one is present', () => {
    renderStoreInfoResult(baseResult({storeOwner: {name: 'Jane Doe'}}), 'text')
    expect(storeDetailRows()).toContainEqual(['Store owner', 'Jane Doe'])
  })

  test('falls back to the email when the store owner has no name', () => {
    renderStoreInfoResult(baseResult({storeOwner: {email: 'jane@acme.com'}}), 'text')
    expect(storeDetailRows()).toContainEqual(['Store owner', 'jane@acme.com'])
  })

  test('omits fields that are not present', () => {
    renderStoreInfoResult(baseResult(), 'text')
    const labels = rowLabels()
    expect(labels).not.toContain('Feature Preview')
    expect(labels).not.toContain('Store owner')
    expect(labels).not.toContain('Type')
    expect(labels).not.toContain('Plan')
    expect(storeDetailRows()).toHaveLength(2)
  })
})
