import {retryStoreAuthWithPermanentDomainError} from './recovery.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test} from 'vitest'

describe('retryStoreAuthWithPermanentDomainError', () => {
  test('returns (rather than throws) an AbortError pointing at the permanent domain with a scopes placeholder', () => {
    const error = retryStoreAuthWithPermanentDomainError('permanent-shop.myshopify.com')

    expect(error).toBeInstanceOf(AbortError)
    expect(error).toMatchObject({
      message: 'OAuth callback store does not match the requested store.',
      tryMessage:
        'Shopify returned permanent-shop.myshopify.com during authentication. Re-run using the permanent store domain:',
      nextSteps: [
        [{command: 'shopify store auth --store permanent-shop.myshopify.com --scopes <comma-separated-scopes>'}],
      ],
    })
  })
})
