import StoreAuthList from './list.js'
import {listStoreAuthSessions} from '../../../services/store/auth/list.js'
import {writeStoreAuthListResult} from '../../../services/store/auth/list-result.js'
import {storeAuthListJsonOutputSchema} from '../../../services/store/auth/list-types.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store/auth/list.js')
vi.mock('../../../services/store/auth/list-result.js')

describe('store auth list command', () => {
  test('lists direct store-auth sessions and writes text output by default', async () => {
    vi.mocked(listStoreAuthSessions).mockReturnValue({sessions: [], message: 'No stores.'})

    await StoreAuthList.run([])

    expect(listStoreAuthSessions).toHaveBeenCalledWith()
    expect(writeStoreAuthListResult).toHaveBeenCalledWith({sessions: [], message: 'No stores.'}, 'text')
  })

  test('writes json output when requested', async () => {
    vi.mocked(listStoreAuthSessions).mockReturnValue({sessions: [], message: 'No stores.'})

    await StoreAuthList.run(['--json'])

    expect(writeStoreAuthListResult).toHaveBeenCalledWith({sessions: [], message: 'No stores.'}, 'json')
  })

  test('does not expose organization or source-selection flags', () => {
    expect(StoreAuthList.flags.json).toBeDefined()
    expect(StoreAuthList.flags).not.toHaveProperty('organization-id')
    expect(StoreAuthList.flags).not.toHaveProperty('from')
  })

  test('exposes the JSON output schema', () => {
    expect(StoreAuthList.jsonOutputSchema).toBe(storeAuthListJsonOutputSchema)
  })
})
