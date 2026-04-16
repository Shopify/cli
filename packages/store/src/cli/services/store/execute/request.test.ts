import {prepareStoreExecuteRequest} from './request.js'
import {describe, expect, test, vi} from 'vitest'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'

vi.mock('@shopify/cli-kit/node/fs')

describe('prepareStoreExecuteRequest', () => {
  test('returns a prepared request for an inline query', async () => {
    const request = await prepareStoreExecuteRequest({
      query: 'query { shop { name } }',
      variables: '{"id":"gid://shopify/Shop/1"}',
      version: '2025-07',
    })

    expect(request).toMatchObject({
      query: 'query { shop { name } }',
      parsedVariables: {id: 'gid://shopify/Shop/1'},
      requestedVersion: '2025-07',
    })
    expect(request).not.toHaveProperty('outputFile')
  })

  test('reads the query from a file', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValueOnce('query { shop { name } }' as any)

    const request = await prepareStoreExecuteRequest({
      queryFile: '/tmp/operation.graphql',
    })

    expect(request.query).toBe('query { shop { name } }')
  })

  test('throws when the query file does not exist', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)

    await expect(
      prepareStoreExecuteRequest({
        queryFile: '/tmp/missing.graphql',
      }),
    ).rejects.toThrow('Query file not found')
  })

  test('throws when the inline query is empty', async () => {
    await expect(
      prepareStoreExecuteRequest({
        query: '   ',
      }),
    ).rejects.toThrow('--query flag value is empty')
  })

  test('throws when the query file is empty', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValueOnce('   ' as any)

    await expect(
      prepareStoreExecuteRequest({
        queryFile: '/tmp/operation.graphql',
      }),
    ).rejects.toThrow('is empty')
  })

  test('throws when no query input is provided', async () => {
    await expect(prepareStoreExecuteRequest({})).rejects.toThrow('Query should have been provided')
  })

  test('throws when the GraphQL syntax is invalid', async () => {
    await expect(
      prepareStoreExecuteRequest({
        query: 'query {',
      }),
    ).rejects.toThrow('Invalid GraphQL syntax')
  })

  test('throws when the document has multiple operations', async () => {
    await expect(
      prepareStoreExecuteRequest({
        query: 'query First { shop { name } } query Second { shop { id } }',
      }),
    ).rejects.toThrow('exactly one operation definition')
  })

  test('throws when a mutation is not allowed', async () => {
    await expect(
      prepareStoreExecuteRequest({
        query: 'mutation { productCreate(product: {title: "Hat"}) { product { id } } }',
      }),
    ).rejects.toThrow('Mutations are disabled by default')
  })

  test('allows mutations when explicitly enabled', async () => {
    const request = await prepareStoreExecuteRequest({
      query: 'mutation { productCreate(product: {title: "Hat"}) { product { id } } }',
      allowMutations: true,
    })

    expect(request.parsedOperation.operationDefinition.operation).toBe('mutation')
  })

  test('throws when variables contain invalid JSON', async () => {
    await expect(
      prepareStoreExecuteRequest({
        query: 'query { shop { name } }',
        variables: '{invalid json}',
      }),
    ).rejects.toThrow('Invalid JSON')
  })

  test('reads variables from a file', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile)
      .mockResolvedValueOnce('query { shop { id } }' as any)
      .mockResolvedValueOnce('{"id":"gid://shopify/Shop/1"}' as any)

    const request = await prepareStoreExecuteRequest({
      queryFile: '/tmp/operation.graphql',
      variableFile: '/tmp/variables.json',
    })

    expect(request.parsedVariables).toEqual({id: 'gid://shopify/Shop/1'})
  })
})
