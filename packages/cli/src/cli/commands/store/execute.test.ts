import {beforeEach, describe, expect, test, vi} from 'vitest'
import StoreExecute from './execute.js'
import {executeStoreOperation} from '../../services/store/execute/index.js'
import {writeOrOutputStoreExecuteResult} from '../../services/store/execute/result.js'

vi.mock('../../services/store/execute/index.js')
vi.mock('../../services/store/execute/result.js')

describe('store execute command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(executeStoreOperation).mockResolvedValue({data: {shop: {name: 'Test shop'}}})
  })

  test('passes the inline query through to the service and writes the result', async () => {
    await StoreExecute.run(['--store', 'shop.myshopify.com', '--query', 'query { shop { name } }'])

    expect(executeStoreOperation).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      query: 'query { shop { name } }',
      queryFile: undefined,
      variables: undefined,
      variableFile: undefined,
      version: undefined,
      allowMutations: false,
    })
    expect(writeOrOutputStoreExecuteResult).toHaveBeenCalledWith(
      {data: {shop: {name: 'Test shop'}}},
      undefined,
      'text',
    )
  })

  test('passes the query file through to the service', async () => {
    await StoreExecute.run(['--store', 'shop.myshopify.com', '--query-file', './operation.graphql'])

    expect(executeStoreOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        query: undefined,
        queryFile: expect.stringMatching(/operation\.graphql$/),
      }),
    )
  })

  test('writes json output when --json is provided', async () => {
    await StoreExecute.run(['--store', 'shop.myshopify.com', '--query', 'query { shop { name } }', '--json'])

    expect(writeOrOutputStoreExecuteResult).toHaveBeenCalledWith(
      {data: {shop: {name: 'Test shop'}}},
      undefined,
      'json',
    )
  })

  test('defines the expected flags', () => {
    expect(StoreExecute.flags.store).toBeDefined()
    expect(StoreExecute.flags.query).toBeDefined()
    expect(StoreExecute.flags['query-file']).toBeDefined()
    expect(StoreExecute.flags.variables).toBeDefined()
    expect(StoreExecute.flags['variable-file']).toBeDefined()
    expect(StoreExecute.flags['allow-mutations']).toBeDefined()
    expect(StoreExecute.flags.json).toBeDefined()
  })
})
