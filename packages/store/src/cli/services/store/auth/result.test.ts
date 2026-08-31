import {presentStoreAuthResult} from './result.js'
import {beforeEach, describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

const result = {
  store: 'shop.myshopify.com',
  userId: '42',
  scopes: ['read_products'],
  acquiredAt: '2026-04-02T00:00:00.000Z',
  hasRefreshToken: true,
  associatedUser: {id: 42, email: 'merchant@example.com'},
}

describe('store auth result presenter', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('renders human success output in text mode', () => {
    const output = mockAndCaptureOutput()

    presentStoreAuthResult(result, 'text')

    expect(output.completed()).toContain('Logged in.')
    expect(output.completed()).toContain('Authenticated as merchant@example.com against shop.myshopify.com.')
    expect(output.info()).toContain(
      "shopify store execute --store shop.myshopify.com --query 'query { shop { name id } }'",
    )
    expect(output.output()).not.toContain('"store": "shop.myshopify.com"')
  })

  test('writes validated JSON through the result channel', () => {
    const output = mockAndCaptureOutput()

    presentStoreAuthResult(result, 'json')

    expect(JSON.parse(output.output())).toEqual(result)
    expect(output.completed()).not.toContain('Authenticated')
    expect(output.info()).not.toContain('shopify store execute')
  })
})
