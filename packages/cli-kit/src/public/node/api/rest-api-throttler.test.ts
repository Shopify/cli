import {extractRetryDelayMsFromResponse, extractApiCallLimitFromResponse} from './rest-api-throttler.js'
import {describe, test, expect, beforeEach} from 'vitest'
import type {RestResponse} from './admin.js'

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
    response.headers = {
      'retry-after': ['2.0'],
    }
    const retryAfterDelay = extractRetryDelayMsFromResponse(response)
    expect(retryAfterDelay).toBe(2)
  })

  test('when the "retry-after" header value is not present', async () => {
    response.headers = {
      'retry-after': [],
    }
    const retryAfterDelay = extractRetryDelayMsFromResponse(response)
    expect(retryAfterDelay).toBe(0)
  })

  test('when the "retry-after" header value is valid', async () => {
    response.headers = {
      'retry-after': ['invalid'],
    }
    const retryAfterDelay = extractRetryDelayMsFromResponse(response)
    expect(retryAfterDelay).toBe(0)
  })

  test('when the "retry-after" header is not present', async () => {
    response.headers = {}
    const retryAfterDelay = extractRetryDelayMsFromResponse(response)
    expect(retryAfterDelay).toBe(0)
  })
})

describe('apiCallLimit', () => {
  test('when the "x-shopify-shop-api-call-limit" header is valid', async () => {
    response.headers = {
      'x-shopify-shop-api-call-limit': ['10/40'],
    }
    const callLimit = extractApiCallLimitFromResponse(response)
    const [used, limit] = callLimit!
    expect(used).toBe(10)
    expect(limit).toBe(40)
  })

  test('when the "x-shopify-shop-api-call-limit" header is invalid', async () => {
    response.headers = {
      'x-shopify-shop-api-call-limit': ['foo/bar'],
    }
    const callLimit = extractApiCallLimitFromResponse(response)
    expect(callLimit).toBeUndefined()
  })

  test('when the "x-shopify-shop-api-call-limit" header is not formatted as expected', async () => {
    response.headers = {
      'x-shopify-shop-api-call-limit': ['/10'],
    }
    const callLimit = extractApiCallLimitFromResponse(response)
    expect(callLimit).toBeUndefined()
  })
})
