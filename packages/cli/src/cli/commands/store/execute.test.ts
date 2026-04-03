import {describe, test, expect, vi, beforeEach} from 'vitest'
import StoreExecute from './execute.js'
import {writeOrOutputStoreExecuteResult} from '../../services/store/execute-result.js'
import {executeStoreOperation} from '../../services/store/execute.js'

vi.mock('../../services/store/execute-result.js', () => ({
  writeOrOutputStoreExecuteResult: vi.fn(),
}))
vi.mock('../../services/store/execute.js', () => ({
  executeStoreOperation: vi.fn().mockResolvedValue({data: {shop: {name: 'Test shop'}}}),
}))

describe('store execute command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(executeStoreOperation).mockResolvedValue({data: {shop: {name: 'Test shop'}}})
  })

  test('passes the inline query through to the service', async () => {
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
    expect(writeOrOutputStoreExecuteResult).toHaveBeenCalledWith({data: {shop: {name: 'Test shop'}}}, undefined, 'text')
  })

  test('supports json output', async () => {
    await StoreExecute.run(['--store', 'shop.myshopify.com', '--query', 'query { shop { name } }', '--json'])

    expect(executeStoreOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
      }),
    )
    expect(writeOrOutputStoreExecuteResult).toHaveBeenCalledWith({data: {shop: {name: 'Test shop'}}}, undefined, 'json')
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

  test('passes the output file through to the output writer', async () => {
    await StoreExecute.run(['--store', 'shop.myshopify.com', '--query', 'query { shop { name } }', '--output-file', './result.json'])

    expect(writeOrOutputStoreExecuteResult).toHaveBeenCalledWith(
      {data: {shop: {name: 'Test shop'}}},
      expect.stringMatching(/result\.json$/),
      'text',
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
