import {searchService} from './search.js'
import {describe, expect, test, vi} from 'vitest'
import {system} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')

  return {
    ...cliKit,
    system: {
      open: vi.fn(),
    },
  }
})

describe('searchService', () => {
  test('the right URL is open in the system', async () => {
    // Given/When
    await searchService('deploy app')

    // Then
    expect(system.open).toBeCalledWith('https://shopify.dev?search=deploy+app')
  })
})
