import {describe, test, expect, vi, beforeEach} from 'vitest'
import StoreExecute from './execute.js'
import {executeStoreOperation} from '../../services/store/execute.js'

vi.mock('../../services/store/execute.js')

describe('store execute command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('passes the inline query through to the service', async () => {
    await StoreExecute.run(['--store', 'shop.myshopify.com', '--query', 'query { shop { name } }'])

    expect(executeStoreOperation).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      query: 'query { shop { name } }',
      queryFile: undefined,
      variables: undefined,
      variableFile: undefined,
      outputFile: undefined,
      version: undefined,
      allowMutations: false,
    })
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

  test('defines the expected flags', () => {
    expect(StoreExecute.flags.store).toBeDefined()
    expect(StoreExecute.flags.query).toBeDefined()
    expect(StoreExecute.flags['query-file']).toBeDefined()
    expect(StoreExecute.flags.variables).toBeDefined()
    expect(StoreExecute.flags['variable-file']).toBeDefined()
    expect(StoreExecute.flags['allow-mutations']).toBeDefined()
  })
})
