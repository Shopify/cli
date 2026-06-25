import {resolveBulkOperationQuery} from './query.js'
import {fileExists, readFile} from '../../fs.js'
import {AbortError, BugError} from '../../error.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('../../fs.js')

describe('resolveBulkOperationQuery', () => {
  beforeEach(() => {
    vi.mocked(fileExists).mockResolvedValue(true)
  })

  test('returns a valid inline query', async () => {
    await expect(resolveBulkOperationQuery({query: 'query { shop { name } }'})).resolves.toBe('query { shop { name } }')
  })

  test('throws when the inline query is blank', async () => {
    await expect(resolveBulkOperationQuery({query: '   '})).rejects.toThrow(AbortError)
  })

  test('reads and returns a valid query file', async () => {
    vi.mocked(readFile).mockResolvedValue('query { shop { name } }' as never)
    await expect(resolveBulkOperationQuery({queryFile: './op.graphql'})).resolves.toBe('query { shop { name } }')
    expect(readFile).toHaveBeenCalledWith('./op.graphql', {encoding: 'utf8'})
  })

  test('throws when the query file does not exist', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)
    await expect(resolveBulkOperationQuery({queryFile: './missing.graphql'})).rejects.toThrow(AbortError)
  })

  test('throws when the query file is empty', async () => {
    vi.mocked(readFile).mockResolvedValue('   \n' as never)
    await expect(resolveBulkOperationQuery({queryFile: './empty.graphql'})).rejects.toThrow(AbortError)
  })

  test('throws a BugError when neither query nor query file is provided', async () => {
    await expect(resolveBulkOperationQuery({})).rejects.toThrow(BugError)
  })

  test('throws when the query has multiple operations', async () => {
    await expect(resolveBulkOperationQuery({query: 'query A { a } query B { b }'})).rejects.toThrow(AbortError)
  })
})
