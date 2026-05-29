import {prepareStoreExecuteRequest} from './request.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const queryPath = joinPath(tmpDir, 'operation.graphql')
      await writeFile(queryPath, 'query { shop { name } }')

      // When
      const request = await prepareStoreExecuteRequest({
        queryFile: queryPath,
      })

      // Then
      expect(request.query).toBe('query { shop { name } }')
    })
  })

  test('throws when the query file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const queryPath = joinPath(tmpDir, 'missing.graphql')

      // When/Then
      await expect(
        prepareStoreExecuteRequest({
          queryFile: queryPath,
        }),
      ).rejects.toThrow('Query file not found')
    })
  })

  test('throws when the inline query is empty', async () => {
    await expect(
      prepareStoreExecuteRequest({
        query: '   ',
      }),
    ).rejects.toThrow('--query flag value is empty')
  })

  test('throws when the query file is empty', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const queryPath = joinPath(tmpDir, 'operation.graphql')
      await writeFile(queryPath, '   ')

      // When/Then
      await expect(
        prepareStoreExecuteRequest({
          queryFile: queryPath,
        }),
      ).rejects.toThrow('is empty')
    })
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
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const queryPath = joinPath(tmpDir, 'operation.graphql')
      const variablesPath = joinPath(tmpDir, 'variables.json')
      await writeFile(queryPath, 'query { shop { id } }')
      await writeFile(variablesPath, '{"id":"gid://shopify/Shop/1"}')

      // When
      const request = await prepareStoreExecuteRequest({
        queryFile: queryPath,
        variableFile: variablesPath,
      })

      // Then
      expect(request.parsedVariables).toEqual({id: 'gid://shopify/Shop/1'})
    })
  })
})
