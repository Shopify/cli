import {prepareAppStoreContext, prepareExecuteContext} from './execute-command-helpers.js'
import {linkedAppContext} from '../services/app-context.js'
import {storeContext} from '../services/store-context.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('../services/app-context.js')
vi.mock('../services/store-context.js')
vi.mock('@shopify/cli-kit/node/system')

describe('prepareAppStoreContext', () => {
  const mockFlags = {
    path: '/test/path',
    'client-id': 'test-client-id',
    reset: false,
    config: 'test-config',
    store: 'test-store.myshopify.com',
  }

  const mockAppContextResult = {
    app: {title: 'Test App'},
    remoteApp: {apiKey: 'test-key'},
    developerPlatformClient: {},
    organization: {id: 'org-123'},
    specifications: [],
  }

  const mockStore = {
    shopId: '123',
    shopDomain: 'test-store.myshopify.com',
    shopName: 'Test Store',
  }

  beforeEach(() => {
    vi.mocked(linkedAppContext).mockResolvedValue(mockAppContextResult as any)
    vi.mocked(storeContext).mockResolvedValue(mockStore as any)
  })

  test('calls linkedAppContext with correct parameters', async () => {
    await prepareAppStoreContext(mockFlags)

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: mockFlags.path,
      clientId: mockFlags['client-id'],
      forceRelink: mockFlags.reset,
      userProvidedConfigName: mockFlags.config,
    })
  })

  test('calls storeContext with correct parameters', async () => {
    await prepareAppStoreContext(mockFlags)

    expect(storeContext).toHaveBeenCalledWith({
      appContextResult: mockAppContextResult,
      storeFqdn: mockFlags.store,
      forceReselectStore: mockFlags.reset,
      storeTypes: ['APP_DEVELOPMENT', 'DEVELOPMENT', 'DEVELOPMENT_SUPERSET', 'PRODUCTION'],
    })
  })

  test('returns app context and store', async () => {
    const result = await prepareAppStoreContext(mockFlags)

    expect(result).toEqual({
      appContextResult: mockAppContextResult,
      store: mockStore,
    })
  })

  test('handles optional client-id and config flags', async () => {
    const flagsWithoutOptionals = {
      path: '/test/path',
      reset: false,
    }

    await prepareAppStoreContext(flagsWithoutOptionals)

    expect(linkedAppContext).toHaveBeenCalledWith({
      directory: flagsWithoutOptionals.path,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
  })
})

describe('prepareExecuteContext', () => {
  const mockFlags = {
    path: '/test/path',
    'client-id': 'test-client-id',
    reset: false,
    config: 'test-config',
    store: 'test-store.myshopify.com',
    query: 'query { shop { name } }',
  }

  const mockAppContextResult = {
    app: {title: 'Test App'},
    remoteApp: {apiKey: 'test-key'},
    developerPlatformClient: {},
    organization: {id: 'org-123'},
    specifications: [],
  }

  const mockStore = {
    shopId: '123',
    shopDomain: 'test-store.myshopify.com',
    shopName: 'Test Store',
  }

  beforeEach(() => {
    vi.mocked(linkedAppContext).mockResolvedValue(mockAppContextResult as any)
    vi.mocked(storeContext).mockResolvedValue(mockStore as any)
  })

  test('uses query from flags when provided', async () => {
    const result = await prepareExecuteContext(mockFlags)

    expect(result.query).toBe(mockFlags.query)
  })

  test('throws BugError when no query provided', async () => {
    const flagsWithoutQuery = {...mockFlags, query: undefined}

    await expect(prepareExecuteContext(flagsWithoutQuery)).rejects.toThrow('exactlyOne constraint')
  })

  test('throws AbortError when query flag is empty string', async () => {
    const flagsWithEmptyQuery = {...mockFlags, query: ''}

    await expect(prepareExecuteContext(flagsWithEmptyQuery)).rejects.toThrow('--query flag value is empty')
  })

  test('throws AbortError when query flag contains only whitespace', async () => {
    const flagsWithWhitespaceQuery = {...mockFlags, query: '   \n\t  '}

    await expect(prepareExecuteContext(flagsWithWhitespaceQuery)).rejects.toThrow('--query flag value is empty')
  })

  test('returns query, app context, and store', async () => {
    const result = await prepareExecuteContext(mockFlags)

    expect(result).toEqual({
      query: mockFlags.query,
      appContextResult: mockAppContextResult,
      store: mockStore,
    })
  })

  test('delegates to prepareAppStoreContext for context setup', async () => {
    await prepareExecuteContext(mockFlags)

    expect(linkedAppContext).toHaveBeenCalled()
    expect(storeContext).toHaveBeenCalled()
  })

  test('reads query from file when query-file flag is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const queryFileContent = 'query { shop { name } }'
      const queryFilePath = joinPath(tmpDir, 'query.graphql')
      await writeFile(queryFilePath, queryFileContent)

      const flagsWithQueryFile = {...mockFlags, query: undefined, 'query-file': queryFilePath}

      // When
      const result = await prepareExecuteContext(flagsWithQueryFile)

      // Then
      expect(result.query).toBe(queryFileContent)
    })
  })

  test('throws AbortError when query file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const queryFilePath = joinPath(tmpDir, 'nonexistent.graphql')
      const flagsWithQueryFile = {...mockFlags, query: undefined, 'query-file': queryFilePath}

      // When/Then
      await expect(prepareExecuteContext(flagsWithQueryFile)).rejects.toThrow('Query file not found')
    })
  })

  test('throws AbortError when query file is empty', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const queryFilePath = joinPath(tmpDir, 'empty.graphql')
      await writeFile(queryFilePath, '')
      const flagsWithQueryFile = {...mockFlags, query: undefined, 'query-file': queryFilePath}

      // When/Then
      await expect(prepareExecuteContext(flagsWithQueryFile)).rejects.toThrow('is empty')
    })
  })

  test('throws AbortError when query file contains only whitespace', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const queryFilePath = joinPath(tmpDir, 'whitespace.graphql')
      await writeFile(queryFilePath, '   \n\t  ')
      const flagsWithQueryFile = {...mockFlags, query: undefined, 'query-file': queryFilePath}

      // When/Then
      await expect(prepareExecuteContext(flagsWithQueryFile)).rejects.toThrow('is empty')
    })
  })

  test('rejects a query that contains multiple operations', async () => {
    const flagsWithMultipleOperations = {...mockFlags, query: 'query A { a } query B { b }'}

    await expect(prepareExecuteContext(flagsWithMultipleOperations)).rejects.toThrow(
      'must contain exactly one operation',
    )
  })
})
