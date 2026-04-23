import StoreExecute from './execute.js'
import {executeStoreOperation} from '../../services/store/execute/index.js'
import {openStoreGraphiQL} from '../../services/store/execute/graphiql.js'
import {writeOrOutputStoreExecuteResult} from '../../services/store/execute/result.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/execute/index.js')
vi.mock('../../services/store/execute/result.js')
vi.mock('../../services/store/execute/graphiql.js')

describe('store execute command', () => {
  beforeEach(() => {
    vi.mocked(executeStoreOperation).mockResolvedValue({data: {shop: {name: 'Test shop'}}})
    vi.mocked(openStoreGraphiQL).mockResolvedValue()
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
    expect(writeOrOutputStoreExecuteResult).toHaveBeenCalledWith({data: {shop: {name: 'Test shop'}}}, undefined, 'text')
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

    expect(writeOrOutputStoreExecuteResult).toHaveBeenCalledWith({data: {shop: {name: 'Test shop'}}}, undefined, 'json')
  })

  test('defines the expected flags', () => {
    expect(StoreExecute.flags.store).toBeDefined()
    expect(StoreExecute.flags.query).toBeDefined()
    expect(StoreExecute.flags['query-file']).toBeDefined()
    expect(StoreExecute.flags.variables).toBeDefined()
    expect(StoreExecute.flags['variable-file']).toBeDefined()
    expect(StoreExecute.flags['allow-mutations']).toBeDefined()
    expect(StoreExecute.flags.json).toBeDefined()
    expect(StoreExecute.flags['graphiql-port']).toBeDefined()
    expect(StoreExecute.flags['no-open']).toBeDefined()
  })

  describe('GraphiQL mode (no --query / --query-file)', () => {
    test('opens GraphiQL with --allow-mutations false by default', async () => {
      await StoreExecute.run(['--store', 'shop.myshopify.com'])

      expect(openStoreGraphiQL).toHaveBeenCalledWith({
        store: 'shop.myshopify.com',
        port: undefined,
        open: true,
        allowMutations: false,
        query: undefined,
        variables: undefined,
        apiVersion: undefined,
      })
      expect(executeStoreOperation).not.toHaveBeenCalled()
      expect(writeOrOutputStoreExecuteResult).not.toHaveBeenCalled()
    })

    test('forwards --variables and --version as prefilled values for GraphiQL', async () => {
      await StoreExecute.run([
        '--store',
        'shop.myshopify.com',
        '--variables',
        '{"id":"gid://shopify/Product/1"}',
        '--version',
        '2024-10',
      ])

      expect(openStoreGraphiQL).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: '{"id":"gid://shopify/Product/1"}',
          apiVersion: '2024-10',
        }),
      )
    })

    test('respects --graphiql-port and --no-open', async () => {
      await StoreExecute.run(['--store', 'shop.myshopify.com', '--graphiql-port', '9123', '--no-open'])

      expect(openStoreGraphiQL).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 9123,
          open: false,
        }),
      )
    })

    test('forwards --allow-mutations to the GraphiQL session', async () => {
      await StoreExecute.run(['--store', 'shop.myshopify.com', '--allow-mutations'])

      expect(openStoreGraphiQL).toHaveBeenCalledWith(
        expect.objectContaining({
          allowMutations: true,
        }),
      )
    })
  })
})
