import {writeStoreAuthListResult} from './list-result.js'
import {beforeEach, describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

describe('writeStoreAuthListResult', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('renders direct store-auth sessions with subdomain and connected date', () => {
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

    expect(output.info()).toContain('Subdomain')
    expect(output.info()).toContain('Connected')
    expect(output.info()).toContain('my-shop')
    expect(output.info()).not.toContain('my-shop.myshopify.com')
    expect(output.info()).toContain('May 22, 2026')
    expect(output.info()).not.toContain('merchant@example.com')
    expect(output.info()).not.toContain('read_products, write_products')
    expect(output.info()).not.toContain('shopify store list')
  })

  test('renders an empty state with auth and organization-list guidance', () => {
    const output = mockAndCaptureOutput()

    writeStoreAuthListResult({sessions: []}, 'text')

    expect(output.info()).toContain('No stores are authenticated directly with `shopify store auth`.')
    expect(output.info()).toContain('shopify store auth --store <domain> --scopes <scopes>')
    expect(output.info()).toContain('shopify store list')
  })

  test('writes a deterministic JSON document with only subdomain and connected date', () => {
    const output = mockAndCaptureOutput()

    writeStoreAuthListResult(
      {
        sessions: [
          {
            kind: 'store',
            store: 'shop.myshopify.com',
            userId: '42',
            scopes: ['read_products'],
            connectedAt: '2026-05-22T00:00:00Z',
            associatedUser: {id: 42, email: 'merchant@example.com'},
          },
        ],
      },
      'json',
    )

    expect(JSON.parse(output.output())).toEqual({
      sessions: [
        {
          subdomain: 'shop',
          connected: 'May 22, 2026',
        },
      ],
    })
  })

  test('includes empty-state guidance in JSON output when there are no sessions', () => {
    const output = mockAndCaptureOutput()

    writeStoreAuthListResult({sessions: []}, 'json')

    expect(JSON.parse(output.output())).toEqual({
      sessions: [],
      message: [
        'No stores are authenticated directly with `shopify store auth`.',
        '',
        'Run `shopify store auth --store <domain> --scopes <scopes>` to authenticate a store.',
        'Run `shopify store list` to list stores in a Shopify organization.',
      ].join('\n'),
    })
  })
})
