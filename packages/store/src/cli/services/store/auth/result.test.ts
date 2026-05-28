import {createStoreAuthPresenter} from './result.js'
import {beforeEach, describe, expect, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

describe('store auth presenter', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('renders human success output in text mode', () => {
    const output = mockAndCaptureOutput()
    const presenter = createStoreAuthPresenter('text')

    presenter.success({
      store: 'shop.myshopify.com',
      userId: '42',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
      hasRefreshToken: true,
      associatedUser: {id: 42, email: 'merchant@example.com'},
    })

    expect(output.completed()).toContain('Logged in.')
    expect(output.completed()).toContain('Authenticated as merchant@example.com against shop.myshopify.com.')
    expect(output.info()).toContain(
      "shopify store execute --store shop.myshopify.com --query 'query { shop { name id } }'",
    )
    expect(output.output()).not.toContain('"store": "shop.myshopify.com"')
  })

  test('writes json success output through the result channel', () => {
    const output = mockAndCaptureOutput()
    const presenter = createStoreAuthPresenter('json')

    presenter.success({
      store: 'shop.myshopify.com',
      userId: '42',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
      hasRefreshToken: true,
      associatedUser: {id: 42, email: 'merchant@example.com'},
    })

    expect(output.output()).toContain('"store": "shop.myshopify.com"')
    expect(output.completed()).not.toContain('Authenticated')
    expect(output.info()).not.toContain('shopify store execute')
  })

  test('writes browser guidance and json success output', () => {
    const output = mockAndCaptureOutput()
    const presenter = createStoreAuthPresenter('json')

    presenter.openingBrowser()
    presenter.manualAuthUrl('https://shop.myshopify.com/admin/oauth/authorize?client_id=test')
    presenter.success({
      store: 'shop.myshopify.com',
      userId: '42',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
      hasRefreshToken: true,
      associatedUser: {id: 42, email: 'merchant@example.com'},
    })

    expect(output.info()).toContain('Shopify CLI will open the app authorization page in your browser.')
    expect(output.info()).toContain('Keep this command running until authentication completes in the browser.')
    expect(output.info()).toContain('Browser did not open automatically. Open this URL manually:')
    expect(output.info()).toContain('https://shop.myshopify.com/admin/oauth/authorize?client_id=test')
    expect(output.output()).toContain('"store": "shop.myshopify.com"')
    expect(output.output()).not.toContain('Authenticated')
  })
})
