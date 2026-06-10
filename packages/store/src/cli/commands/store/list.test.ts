import StoreList from './list.js'
import {listStores} from '../../services/store/list/index.js'
import {writeStoreListResult} from '../../services/store/list/result.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/list/index.js')
vi.mock('../../services/store/list/result.js')
vi.mock('../../services/store/attribution.js')

describe('store list command', () => {
  test('passes the parsed --from flag through to the list service', async () => {
    vi.mocked(listStores).mockResolvedValue({stores: [], source: 'store-auth'})

    await StoreList.run(['--from', 'store-auth'])

    expect(listStores).toHaveBeenCalledWith({source: 'store-auth'})
    expect(writeStoreListResult).toHaveBeenCalledWith({stores: [], source: 'store-auth'}, 'text')
  })

  test('defaults to the auto source and writes json output when requested', async () => {
    vi.mocked(listStores).mockResolvedValue({stores: [], source: 'organization'})

    await StoreList.run(['--json'])

    expect(listStores).toHaveBeenCalledWith({source: 'auto', organizationId: undefined})
    expect(writeStoreListResult).toHaveBeenCalledWith({stores: [], source: 'organization'}, 'json')
  })

  test('passes the organization id through to the list service', async () => {
    vi.mocked(listStores).mockResolvedValue({stores: [], source: 'organization'})

    await StoreList.run(['--organization-id', '1234567'])

    expect(listStores).toHaveBeenCalledWith({source: 'auto', organizationId: '1234567'})
  })

  test('defines the expected flags', () => {
    expect(StoreList.flags.from).toBeDefined()
    expect(StoreList.flags['organization-id']).toBeDefined()
    expect(StoreList.flags.json).toBeDefined()
  })
})
