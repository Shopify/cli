import {describe, test, expect, vi, beforeEach} from 'vitest'
import StoreExecute, {readQuery} from './execute.js'
import {executeStoreOperation} from '../../services/store/execute.js'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'

vi.mock('../../services/store/execute.js')
vi.mock('@shopify/cli-kit/node/fs')

describe('store execute command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('passes the inline query through to the service', async () => {
    await StoreExecute.run(['--store', 'shop.myshopify.com', '--query', 'query { shop { name } }'])

    expect(executeStoreOperation).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      query: 'query { shop { name } }',
      variables: undefined,
      variableFile: undefined,
      outputFile: undefined,
      version: undefined,
      allowMutations: false,
      mock: false,
    })
  })

  test('reads the query from a file', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValue('query { shop { name } }' as any)

    await StoreExecute.run(['--store', 'shop.myshopify.com', '--query-file', './operation.graphql'])

    expect(executeStoreOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
        query: 'query { shop { name } }',
      }),
    )
  })

  test('throws when the query file does not exist', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)

    await expect(
      readQuery({
        store: 'shop.myshopify.com',
        'allow-mutations': false,
        mock: false,
        'query-file': './missing.graphql',
      }),
    ).rejects.toThrow('Query file not found')
  })

  test('throws when the inline query is empty', async () => {
    await expect(
      readQuery({
        store: 'shop.myshopify.com',
        'allow-mutations': false,
        mock: false,
        query: '   ',
      }),
    ).rejects.toThrow('--query flag value is empty')
  })

  test('defines the expected flags', () => {
    expect(StoreExecute.flags.store).toBeDefined()
    expect(StoreExecute.flags.query).toBeDefined()
    expect(StoreExecute.flags['query-file']).toBeDefined()
    expect(StoreExecute.flags.variables).toBeDefined()
    expect(StoreExecute.flags['variable-file']).toBeDefined()
    expect(StoreExecute.flags['allow-mutations']).toBeDefined()
    expect(StoreExecute.flags.mock).toBeDefined()
  })
})
