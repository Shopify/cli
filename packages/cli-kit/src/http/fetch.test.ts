import {describe, test, expect, vi} from 'vitest'
import crossFetch, {Response} from 'cross-fetch'

import fetch from './fetch'

vi.mock('cross-fetch')

describe('fetch', () => {
  test('delegates the fetch to cross-fetch', async () => {
    // Given
    const url: RequestInfo = 'https://shopify.com'
    const init: RequestInit = {}
    const response = new Response(null, undefined)

    vi.mocked(crossFetch).mockResolvedValue(response)

    // When
    const got = await fetch(url, init)

    // Then
    expect(vi.mocked(crossFetch)).toHaveBeenCalledWith(url, init)
    expect(got).toBe(response)
  })
})
