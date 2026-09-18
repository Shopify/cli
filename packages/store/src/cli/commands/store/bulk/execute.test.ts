import StoreBulkExecute from './execute.js'
import {renderExecuteBulkOperationResult} from '../../../services/store/bulk/execute-result.js'
import {renderBulkOperationStart} from '../../../services/store/bulk/progress.js'
import {executeBulkOperation, prepareBulkOperation} from '../../../services/store/bulk/execute-bulk-operation.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store/bulk/execute-bulk-operation.js')
vi.mock('../../../services/store/bulk/execute-result.js')
vi.mock('../../../services/store/bulk/progress.js')

describe('store bulk execute command', () => {
  beforeEach(() => {
    vi.mocked(prepareBulkOperation).mockImplementation(async ({query, watch = false}) => ({
      adminSession: {token: 'token', storeFqdn: 'shop.myshopify.com'},
      version: '2026-01',
      query,
      variablesJsonl: undefined,
      watch,
    }))
    vi.mocked(executeBulkOperation).mockResolvedValue({operation: null, userErrors: [], watchAborted: false})
  })

  test('passes the inline query through to the service', async () => {
    await StoreBulkExecute.run([
      '--store',
      'shop.myshopify.com',
      '--query',
      'query { products { edges { node { id } } } }',
    ])

    expect(prepareBulkOperation).toHaveBeenCalledWith(
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
      '--output-file',
      './results.jsonl',
    ])

    expect(prepareBulkOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        allowMutations: true,
        watch: true,
        variables: ['{"input":{}}'],
      }),
    )
    expect(renderExecuteBulkOperationResult).toHaveBeenCalledWith(expect.anything(), {
      format: 'text',
      watch: true,
      outputFile: expect.stringMatching(/results\.jsonl$/),
    })
  })

  test('selects JSON presentation', async () => {
    await StoreBulkExecute.run(['--store', 'shop.myshopify.com', '--query', '{ shop { id } }', '--json'])
    expect(renderExecuteBulkOperationResult).toHaveBeenCalledWith(expect.anything(), {
      format: 'json',
      watch: false,
      outputFile: undefined,
    })
    expect(renderBulkOperationStart).toHaveBeenCalledWith('Starting bulk operation.', expect.any(Object), 'json')
  })

  test('rejects an empty query', async () => {
    await expect(StoreBulkExecute.run(['--store', 'shop.myshopify.com', '--query', '   '])).rejects.toThrow()
    expect(executeBulkOperation).not.toHaveBeenCalled()
  })

  test('defines the expected flags', () => {
    expect(StoreBulkExecute.flags.store).toBeDefined()
    expect(StoreBulkExecute.flags.json).toBeDefined()
    expect(StoreBulkExecute.jsonOutputSchema).toBeDefined()
    expect(StoreBulkExecute.flags.query).toBeDefined()
    expect(StoreBulkExecute.flags['query-file']).toBeDefined()
    expect(StoreBulkExecute.flags.variables).toBeDefined()
    expect(StoreBulkExecute.flags['variable-file']).toBeDefined()
    expect(StoreBulkExecute.flags.watch).toBeDefined()
    expect(StoreBulkExecute.flags['output-file']).toBeDefined()
    expect(StoreBulkExecute.flags['allow-mutations']).toBeDefined()
  })
})
