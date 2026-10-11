import {resolveBulkOperationQuery} from './query.js'
import {writeFile} from '../../fs.js'
import * as fs from '../../fs.js'
import {joinPath} from '../../path.js'
import {testWithTempDir as test} from '../../testing/test-with-temp-dir.js'
import {AbortError, BugError} from '../../error.js'
import {describe, expect, vi} from 'vitest'

describe('resolveBulkOperationQuery', () => {
  test('returns a valid inline query', async () => {
    await expect(resolveBulkOperationQuery({query: 'query { shop { name } }'})).resolves.toBe('query { shop { name } }')
  })

  test('throws when the inline query is blank', async () => {
    await expect(resolveBulkOperationQuery({query: '   '})).rejects.toThrow(AbortError)
  })

  test('reads and returns a valid query file', async ({tempDir}) => {
    const queryFile = joinPath(tempDir, 'op.graphql')
    await writeFile(queryFile, 'query { shop { name } }')
    const readFile = vi.spyOn(fs, 'readFile')
    await expect(resolveBulkOperationQuery({queryFile})).resolves.toBe('query { shop { name } }')
    expect(readFile).toHaveBeenCalledWith(queryFile, {encoding: 'utf8'})
  })

  test('throws when the query file does not exist', async ({tempDir}) => {
    await expect(resolveBulkOperationQuery({queryFile: joinPath(tempDir, 'missing.graphql')})).rejects.toThrow(
      AbortError,
    )
  })

  test('throws when the query file is empty', async ({tempDir}) => {
    const queryFile = joinPath(tempDir, 'empty.graphql')
    await writeFile(queryFile, '   \n')
    await expect(resolveBulkOperationQuery({queryFile})).rejects.toThrow(AbortError)
  })

  test('throws a BugError when neither query nor query file is provided', async () => {
    await expect(resolveBulkOperationQuery({})).rejects.toThrow(BugError)
  })

  test('throws when the query has multiple operations', async () => {
    await expect(resolveBulkOperationQuery({query: 'query A { a } query B { b }'})).rejects.toThrow(AbortError)
  })
})
