import {writeStoreAuthListResult} from './list-result.js'
import {beforeEach, describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

describe('writeStoreAuthListResult', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('renders direct store-auth sessions with subdomain, account, scopes, and connected date', () => {
    const output = mockAndCaptureOutput()

    writeStoreAuthListResult(
      {
        sessions: [
          {
            kind: 'store',
            store: 'my-shop.myshopify.com',
            userId: '42',
            scopes: ['read_products', 'write_products'],
            connectedAt: '2026-05-22T00:00:00Z',
            associatedUser: {id: 42, email: 'merchant@example.com'},
          },
        ],
      },
      'text',
    )

    expect(output.info()).toContain('Stores authenticated directly with `shopify store auth`')
    expect(output.info()).toContain('Store')
    expect(output.info()).toContain('my-shop')
    expect(output.info()).not.toContain('my-shop.myshopify.com')
    expect(output.info()).toContain('merchant@example.com')
    expect(output.info()).toContain('read_products, write_products')
    expect(output.info()).toContain('May 22, 2026')
    expect(output.info()).toContain('shopify store list')
  })

  test('renders an empty state with auth and organization-list guidance', () => {
    const output = mockAndCaptureOutput()

    writeStoreAuthListResult({sessions: []}, 'text')

    expect(output.info()).toContain('No stores are authenticated directly with `shopify store auth`.')
    expect(output.info()).toContain('shopify store auth --store <domain> --scopes <scopes>')
    expect(output.info()).toContain('shopify store list')
  })

  test('writes a deterministic JSON document', () => {
    const output = mockAndCaptureOutput()
    const result = {
      sessions: [
        {
          kind: 'store' as const,
          store: 'shop.myshopify.com',
          userId: '42',
          scopes: ['read_products'],
          connectedAt: '2026-05-22T00:00:00Z',
        },
      ],
    }

    writeStoreAuthListResult(result, 'json')

    expect(JSON.parse(output.output())).toEqual(result)
  })
})
