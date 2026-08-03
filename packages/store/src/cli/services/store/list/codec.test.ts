import {encodeStoreListJson, toStoreListDocument} from './codec.js'
import {describe, expect, test} from 'vitest'

describe('store:list codec', () => {
  test('preserves the current JSON wire document and omits internal fields', () => {
    const result = {
      source: 'organization' as const,
      stores: [
        {
          id: 'gid://shopify/Shop/1',
          store: 'shop.myshopify.com',
          createdAt: '2026-05-22T00:00:00Z',
          organizationId: '1234',
          organizationName: 'Acme',
          name: 'My Shop',
          type: 'dev',
        },
      ],
      organization: {id: '1234', name: 'Acme'},
      notice: 'A notice',
      truncated: true,
    }

    expect(encodeStoreListJson(result)).toBe(`{
  "stores": [
    {
      "id": "gid://shopify/Shop/1",
      "store": "shop.myshopify.com",
      "createdAt": "2026-05-22T00:00:00Z",
      "organizationId": "1234",
      "organizationName": "Acme",
      "name": "My Shop",
      "type": "dev"
    }
  ],
  "organization": {
    "id": "1234",
    "name": "Acme"
  },
  "notice": "A notice",
  "truncated": true
}`)
    expect(toStoreListDocument(result)).not.toHaveProperty('source')
  })

  test('omits optional fields when execution data does not provide them', () => {
    expect(toStoreListDocument({source: 'organization', stores: []})).toEqual({stores: []})
  })
})
