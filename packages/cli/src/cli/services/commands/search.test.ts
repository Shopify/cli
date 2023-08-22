import {searchService} from './search.js'
import {describe, expect, test, vi} from 'vitest'
import {openURL} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/system')

describe('searchService', () => {
  test('the right URL is open in the system when a query is passed', async () => {
    await searchService('deploy app')

    expect(openURL).toBeCalledWith('https://shopify.dev?search=deploy+app')
  })

  test('the right URL is open in the system when a query is not passed', async () => {
    await searchService()

    expect(openURL).toBeCalledWith('https://shopify.dev?search=')
  })
})
