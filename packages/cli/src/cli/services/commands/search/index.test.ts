import {searchService} from './index.js'
import {describe, expect, test} from 'vitest'

describe('searchService', () => {
  test('returns the search URL when a query is passed', async () => {
    await expect(searchService('deploy app')).resolves.toEqual({url: 'https://shopify.dev/docs?search=deploy+app'})
  })

  test('returns the search URL when a query is not passed', async () => {
    await expect(searchService()).resolves.toEqual({url: 'https://shopify.dev/docs?search='})
  })

  test('encodes special characters without adding URL parameters', async () => {
    await expect(searchService('café & apps?')).resolves.toEqual({
      url: 'https://shopify.dev/docs?search=caf%C3%A9+%26+apps%3F',
    })
  })
})
