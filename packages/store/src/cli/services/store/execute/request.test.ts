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
      const queryFile = joinPath(tmpDir, 'operation.graphql')
      const queryContent = 'query { shop { name } }'
      await writeFile(queryFile, queryContent)

      // When
      const request = await prepareStoreExecuteRequest({
        queryFile,
      })

      // Then
      expect(request.query).toBe(queryContent)
    })
  })

  test('throws when the query file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const missingFile = joinPath(tmpDir, 'missing.graphql')

      // When/Then
      await expect(
        prepareStoreExecuteRequest({
          queryFile: missingFile,
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
      const queryFile = joinPath(tmpDir, 'operation.graphql')
      await writeFile(queryFile, '   ')

      // When/Then
      await expect(
        prepareStoreExecuteRequest({
          queryFile,
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
      const queryFile = joinPath(tmpDir, 'operation.graphql')
      const variablesFile = joinPath(tmpDir, 'variables.json')
      const queryContent = 'query { shop { id } }'
      const variablesContent = '{"id":"gid://shopify/Shop/1"}'

      await writeFile(queryFile, queryContent)
      await writeFile(variablesFile, variablesContent)

      // When
      const request = await prepareStoreExecuteRequest({
        queryFile,
        variableFile: variablesFile,
      })

      // Then
      expect(request.parsedVariables).toEqual({id: 'gid://shopify/Shop/1'})
    })
  })
})
