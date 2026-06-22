import StoreBulkExecute from './execute.js'
import {executeBulkOperation} from '../../../services/store/bulk/execute-bulk-operation.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store/bulk/execute-bulk-operation.js')

describe('store bulk execute command', () => {
  beforeEach(() => {
    vi.mocked(executeBulkOperation).mockResolvedValue()
  })

  test('passes the inline query through to the service', async () => {
    await StoreBulkExecute.run([
      '--store',
      'shop.myshopify.com',
      '--query',
      'query { products { edges { node { id } } } }',
    ])

    expect(executeBulkOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        query: 'query { products { edges { node { id } } } }',
        watch: false,
        allowMutations: false,
      }),
    )
  })

  test('forwards watch, output-file, and allow-mutations flags', async () => {
    await StoreBulkExecute.run([
      '--store',
      'shop.myshopify.com',
      '--query',
      'mutation { productUpdate(input: {}) { product { id } } }',
      '--variables',
      '{"input":{}}',
      '--allow-mutations',
      '--watch',
    ])

    expect(executeBulkOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        allowMutations: true,
        watch: true,
        variables: ['{"input":{}}'],
      }),
    )
  })

  test('rejects an empty query', async () => {
    await expect(StoreBulkExecute.run(['--store', 'shop.myshopify.com', '--query', '   '])).rejects.toThrow()
    expect(executeBulkOperation).not.toHaveBeenCalled()
  })

  test('defines the expected flags', () => {
    expect(StoreBulkExecute.flags.store).toBeDefined()
    expect(StoreBulkExecute.flags.query).toBeDefined()
    expect(StoreBulkExecute.flags['query-file']).toBeDefined()
    expect(StoreBulkExecute.flags.variables).toBeDefined()
    expect(StoreBulkExecute.flags['variable-file']).toBeDefined()
    expect(StoreBulkExecute.flags.watch).toBeDefined()
    expect(StoreBulkExecute.flags['output-file']).toBeDefined()
    expect(StoreBulkExecute.flags['allow-mutations']).toBeDefined()
  })
})
