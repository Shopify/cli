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

// The labels of rows whose value cell is a plain string (i.e. not a link token).
function stringRowLabels(): string[] {
  return storeDetailRows()
    .filter((row) => typeof row[1] === 'string')
    .map((row) => row[0] as string)
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
        accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
        saveUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
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
    expect(rows).toContainEqual([
      'Admin URL',
      {
        link: {
          label: 'Link',
          url: 'https://admin.shopify.com/store/acme-widgets',
        },
      },
    ])
    expect(rows).toContainEqual([
      'Access URL',
      {
        link: {
          label: 'Link',
          url: 'https://app.shopify.com/auth/preview-store?token=access-token',
        },
      },
    ])
    expect(rows).toContainEqual([
      'Save URL',
      {
        link: {
          label: 'Link',
          url: 'https://admin.shopify.com/store-transfer/accept/claim-token',
        },
      },
    ])
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
    const labels = stringRowLabels()
    expect(labels).not.toContain('Feature Preview')
    expect(labels).not.toContain('Store owner')
    expect(labels).not.toContain('Type')
    expect(labels).not.toContain('Plan')
    expect(storeDetailRows()).toHaveLength(2)
  })
})
