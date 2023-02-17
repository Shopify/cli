import {apiCallLimit, retryAfter} from './headers.js'
import {test, expect, describe, beforeEach} from 'vitest'
import {RestResponse} from '@shopify/cli-kit/node/api/admin'

let response: RestResponse

beforeEach(() => {
  response = {
    json: {},
    status: 200,
    headers: {},
  }
})

describe('retryAfter', () => {
  test('when the "retry-after" header value is valid', async () => {
    // Given
    response.headers = {
      'retry-after': ['2.0'],
    }

    // When
    const retryAfterDelay = retryAfter(response)

    // Then
    expect(retryAfterDelay).toBe(2)
  })

  test('when the "retry-after" header value is not present', async () => {
    // Given
    response.headers = {
      'retry-after': [],
    }

    // When
    const retryAfterDelay = retryAfter(response)

    // Then
    expect(retryAfterDelay).toBe(0)
  })

  test('when the "retry-after" header value is valid', async () => {
    // Given
    response.headers = {
      'retry-after': ['invalid'],
    }

    // When
    const retryAfterDelay = retryAfter(response)

    // Then
    expect(retryAfterDelay).toBe(0)
  })

  test('when the "retry-after" header is not present', async () => {
    // Given
    response.headers = {}

    // When
    const retryAfterDelay = retryAfter(response)

    // Then
    expect(retryAfterDelay).toBe(0)
  })
})

describe('apiCallLimit', () => {
  test('when the "x-shopify-shop-api-call-limit" header is valid', async () => {
    // Given
    response.headers = {
      'x-shopify-shop-api-call-limit': ['10/40'],
    }

    // When
    const callLimit = apiCallLimit(response)
    const [used, limit] = callLimit!

    // Then
    expect(used).toBe(10)
    expect(limit).toBe(40)
  })

  test('when the "x-shopify-shop-api-call-limit" header is invalid', async () => {
    // Given
    response.headers = {
      'x-shopify-shop-api-call-limit': ['foo/bar'],
    }

    // When
    const callLimit = apiCallLimit(response)

    // Then
    expect(callLimit).toBeUndefined()
  })

  test('when the "x-shopify-shop-api-call-limit" header is not formatted as expected', async () => {
    // Given
    response.headers = {
      'x-shopify-shop-api-call-limit': ['/10'],
    }

    // When
    const callLimit = apiCallLimit(response)

    // Then
    expect(callLimit).toBeUndefined()
  })
})
