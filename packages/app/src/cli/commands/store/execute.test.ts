import StoreExecute from './execute.js'
import {storeExecuteOperation} from '../../services/store-execute-operation.js'
import {loadQuery} from '../../utilities/execute-command-helpers.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store-execute-operation.js')
vi.mock('../../utilities/execute-command-helpers.js')

describe('store execute command', () => {
  test('requires --store flag', async () => {
    vi.mocked(loadQuery).mockResolvedValue('query { shop { name } }')
    vi.mocked(storeExecuteOperation).mockResolvedValue()

    await expect(StoreExecute.run(['--query', 'query { shop { name } }'], import.meta.url)).rejects.toThrow()

    expect(storeExecuteOperation).not.toHaveBeenCalled()
  })

  test('calls storeExecuteOperation with correct arguments', async () => {
    vi.mocked(loadQuery).mockResolvedValue('query { shop { name } }')
    vi.mocked(storeExecuteOperation).mockResolvedValue()

    await StoreExecute.run(
      ['--store', 'test-store.myshopify.com', '--query', 'query { shop { name } }'],
      import.meta.url,
    )

    expect(loadQuery).toHaveBeenCalledWith(expect.objectContaining({query: 'query { shop { name } }'}))
    expect(storeExecuteOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        storeFqdn: 'test-store.myshopify.com',
        query: 'query { shop { name } }',
      }),
    )
  })

  test('passes version flag when provided', async () => {
    vi.mocked(loadQuery).mockResolvedValue('query { shop { name } }')
    vi.mocked(storeExecuteOperation).mockResolvedValue()

    await StoreExecute.run(
      ['--store', 'test-store.myshopify.com', '--query', 'query { shop { name } }', '--version', '2024-01'],
      import.meta.url,
    )

    expect(storeExecuteOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '2024-01',
      }),
    )
  })

  test('passes output-file flag when provided', async () => {
    vi.mocked(loadQuery).mockResolvedValue('query { shop { name } }')
    vi.mocked(storeExecuteOperation).mockResolvedValue()

    await StoreExecute.run(
      ['--store', 'test-store.myshopify.com', '--query', 'query { shop { name } }', '--output-file', '/tmp/out.json'],
      import.meta.url,
    )

    expect(storeExecuteOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        outputFile: '/tmp/out.json',
      }),
    )
  })
})
