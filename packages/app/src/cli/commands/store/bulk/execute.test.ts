import StoreBulkExecute from './execute.js'
import {storeExecuteBulkOperation} from '../../../services/store-bulk-execute-operation.js'
import {loadQuery} from '../../../utilities/execute-command-helpers.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store-bulk-execute-operation.js')
vi.mock('../../../utilities/execute-command-helpers.js')

describe('store bulk execute command', () => {
  test('requires --store flag', async () => {
    vi.mocked(loadQuery).mockResolvedValue('query { shop { name } }')
    vi.mocked(storeExecuteBulkOperation).mockResolvedValue()

    await expect(StoreBulkExecute.run(['--query', 'query { shop { name } }'], import.meta.url)).rejects.toThrow()

    expect(storeExecuteBulkOperation).not.toHaveBeenCalled()
  })

  test('calls storeExecuteBulkOperation with correct arguments', async () => {
    vi.mocked(loadQuery).mockResolvedValue('query { shop { name } }')
    vi.mocked(storeExecuteBulkOperation).mockResolvedValue()

    await StoreBulkExecute.run(
      ['--store', 'test-store.myshopify.com', '--query', 'query { shop { name } }'],
      import.meta.url,
    )

    expect(loadQuery).toHaveBeenCalledWith(expect.objectContaining({query: 'query { shop { name } }'}))
    expect(storeExecuteBulkOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        storeFqdn: 'test-store.myshopify.com',
        query: 'query { shop { name } }',
        watch: false,
      }),
    )
  })

  test('passes version flag when provided', async () => {
    vi.mocked(loadQuery).mockResolvedValue('query { shop { name } }')
    vi.mocked(storeExecuteBulkOperation).mockResolvedValue()

    await StoreBulkExecute.run(
      ['--store', 'test-store.myshopify.com', '--query', 'query { shop { name } }', '--version', '2024-01'],
      import.meta.url,
    )

    expect(storeExecuteBulkOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '2024-01',
      }),
    )
  })

  test('passes watch and output-file flags when provided', async () => {
    vi.mocked(loadQuery).mockResolvedValue('query { shop { name } }')
    vi.mocked(storeExecuteBulkOperation).mockResolvedValue()

    await StoreBulkExecute.run(
      [
        '--store',
        'test-store.myshopify.com',
        '--query',
        'query { shop { name } }',
        '--watch',
        '--output-file',
        '/tmp/out.jsonl',
      ],
      import.meta.url,
    )

    expect(storeExecuteBulkOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        watch: true,
        outputFile: '/tmp/out.jsonl',
      }),
    )
  })

  test('passes variables flag when provided', async () => {
    vi.mocked(loadQuery).mockResolvedValue('mutation { productCreate { product { id } } }')
    vi.mocked(storeExecuteBulkOperation).mockResolvedValue()

    await StoreBulkExecute.run(
      [
        '--store',
        'test-store.myshopify.com',
        '--query',
        'mutation { productCreate { product { id } } }',
        '--variables',
        '{"input": {"title": "test"}}',
      ],
      import.meta.url,
    )

    expect(storeExecuteBulkOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: ['{"input": {"title": "test"}}'],
      }),
    )
  })
})
