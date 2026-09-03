import StoreList from './list.js'
import {listStores} from '../../services/store/list.js'
import {writeStoreListResult} from '../../services/store/list/result.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/list.js')
vi.mock('../../services/store/list/result.js')
vi.mock('../../services/store/attribution.js')

describe('store list command', () => {
  test('runs the list service and writes text output by default', async () => {
    vi.mocked(listStores).mockResolvedValue({stores: [], source: 'organization'})

    await StoreList.run([])

    expect(listStores).toHaveBeenCalledWith({organizationId: undefined, storeType: undefined})
    expect(writeStoreListResult).toHaveBeenCalledWith({stores: [], source: 'organization'}, 'text')
  })

  test('passes the organization id through to the list service', async () => {
    vi.mocked(listStores).mockResolvedValue({stores: [], source: 'organization'})

    await StoreList.run(['--organization-id', '1234567'])

    expect(listStores).toHaveBeenCalledWith({organizationId: 1234567, storeType: undefined})
  })

  test('passes the store type filter through to the list service', async () => {
    vi.mocked(listStores).mockResolvedValue({stores: [], source: 'organization'})

    await StoreList.run(['--type', 'client_transfer'])

    expect(listStores).toHaveBeenCalledWith({organizationId: undefined, storeType: 'client_transfer'})
  })

  test('writes json output when requested', async () => {
    vi.mocked(listStores).mockResolvedValue({stores: [], source: 'organization'})

    await StoreList.run(['--json'])

    expect(listStores).toHaveBeenCalledWith({organizationId: undefined, storeType: undefined})
    expect(writeStoreListResult).toHaveBeenCalledWith({stores: [], source: 'organization'}, 'json')
  })

  test('defines the expected flags', () => {
    expect(StoreList.flags.json).toBeDefined()
    expect(StoreList.flags['organization-id']).toBeDefined()
    expect(StoreList.flags.type?.options).toEqual(['dev', 'production', 'client_transfer', 'collaborator'])
    expect(StoreList.flags).not.toHaveProperty('from')
  })
})
