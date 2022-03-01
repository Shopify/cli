import {describe, test, expect, vi} from 'vitest'
import nodeFetch, {Response} from 'node-fetch'
import type {RequestInit, RequestInfo} from 'node-fetch'

import fetch from './fetch'

vi.mock('node-fetch')

describe('fetch', () => {
  test('delegates the fetch to node-fetch', async () => {
    // Given
    const url: RequestInfo = 'https://shopify.com'
    const init: RequestInit = {}
    const response = new Response(null, undefined)

    vi.mocked(nodeFetch).mockResolvedValue(response)

    // When
    const got = await fetch(url, init)

    // Then
    expect(vi.mocked(nodeFetch)).toHaveBeenCalledWith(url, init)
    expect(got).toBe(response)
  })
})
