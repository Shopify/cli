import {LinkContentToken} from './content-tokens.js'
import {describe, expect, test} from 'vitest'

describe('LinkContentToken', () => {
  test('the link includes spaces between the URL and the parenthesis for command/control click to work', () => {
    // When
    const got = new LinkContentToken('Shopify Web', 'https://shopify.com')

    // Then
    expect(got.output()).toEqual('\u001b[32mShopify Web\u001b[39m ( https://shopify.com )')
  })
})
