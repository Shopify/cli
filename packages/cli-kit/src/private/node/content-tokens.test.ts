import {LinkContentToken} from './content-tokens.js'
import supportsHyperlink from 'supports-hyperlinks'
import {describe, expect, test} from 'vitest'

describe('LinkContentToken', () => {
  // Different test environments give different answers to whether hyperlinks are supported -- its not possible to standardise in this case.
  const environmentSupportsDirectLinks = supportsHyperlink.stdout
  test.skipIf(environmentSupportsDirectLinks)(
    'the link includes spaces between the URL and the parenthesis for command/control click to work',
    () => {
      // When
      const got = new LinkContentToken('Shopify Web', 'https://shopify.com')

      // Then
      expect(got.output()).toEqual('\u001b[32mShopify Web\u001b[39m ( https://shopify.com )')
    },
  )
})
