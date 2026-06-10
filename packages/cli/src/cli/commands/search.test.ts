import Search from './search.js'
import {searchService} from '../services/commands/search.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../services/commands/search.js')

describe('search command', () => {
  test('is marked deprecated and points users to agent-search', () => {
    expect(Search.state).toBe('deprecated')
    expect(Search.deprecationOptions).toEqual({to: 'agent-search'})
  })

  test('still runs the browser search service (behavior is unchanged)', async () => {
    await Search.run(['webhooks'], import.meta.url)

    expect(searchService).toHaveBeenCalledWith('webhooks')
  })
})
