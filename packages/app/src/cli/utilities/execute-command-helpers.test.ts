import {prepareAppStoreContext, prepareExecuteContext, loadQuery} from './execute-command-helpers.js'
import {linkedAppContext} from '../services/app-context.js'
import {storeContext} from '../services/store-context.js'
import {validateSingleOperation} from '../services/graphql/common.js'
import {readFile, fileExists} from '@shopify/cli-kit/node/fs'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('../services/app-context.js')
vi.mock('../services/store-context.js')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('../services/graphql/common.js', () => ({
  validateSingleOperation: vi.fn(),
}))

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

describe('loadQuery', () => {
  test('returns query from --query flag', async () => {
    const result = await loadQuery({query: 'query { shop { name } }'})
    expect(result).toBe('query { shop { name } }')
  })

  test('throws AbortError when query flag is empty', async () => {
    await expect(loadQuery({query: ''})).rejects.toThrow('--query flag value is empty')
  })

  test('throws AbortError when query flag is whitespace', async () => {
    await expect(loadQuery({query: '   \n\t  '})).rejects.toThrow('--query flag value is empty')
  })

  test('reads query from file', async () => {
    const queryFileContent = 'query { shop { name } }'
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValue(queryFileContent as any)

    const result = await loadQuery({'query-file': '/path/to/query.graphql'})

    expect(fileExists).toHaveBeenCalledWith('/path/to/query.graphql')
    expect(readFile).toHaveBeenCalledWith('/path/to/query.graphql', {encoding: 'utf8'})
    expect(result).toBe(queryFileContent)
  })

  test('throws when query file does not exist', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)
    await expect(loadQuery({'query-file': '/path/to/missing.graphql'})).rejects.toThrow('Query file not found')
  })

  test('throws when query file is empty', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValue('' as any)
    await expect(loadQuery({'query-file': '/path/to/empty.graphql'})).rejects.toThrow('is empty')
  })

  test('throws BugError when no query provided', async () => {
    await expect(loadQuery({})).rejects.toThrow('exactlyOne constraint')
  })

  test('validates GraphQL syntax via validateSingleOperation', async () => {
    await loadQuery({query: 'query { shop { name } }'})
    expect(validateSingleOperation).toHaveBeenCalledWith('query { shop { name } }')
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
    const queryFileContent = 'query { shop { name } }'
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValue(queryFileContent as any)

    const flagsWithQueryFile = {...mockFlags, query: undefined, 'query-file': '/path/to/query.graphql'}
    const result = await prepareExecuteContext(flagsWithQueryFile)

    expect(fileExists).toHaveBeenCalledWith('/path/to/query.graphql')
    expect(readFile).toHaveBeenCalledWith('/path/to/query.graphql', {encoding: 'utf8'})
    expect(result.query).toBe(queryFileContent)
  })

  test('throws AbortError when query file does not exist', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)

    const flagsWithQueryFile = {...mockFlags, query: undefined, 'query-file': '/path/to/nonexistent.graphql'}

    await expect(prepareExecuteContext(flagsWithQueryFile)).rejects.toThrow('Query file not found')
    expect(readFile).not.toHaveBeenCalled()
  })

  test('throws AbortError when query file is empty', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValue('' as any)

    const flagsWithQueryFile = {...mockFlags, query: undefined, 'query-file': '/path/to/empty.graphql'}

    await expect(prepareExecuteContext(flagsWithQueryFile)).rejects.toThrow('is empty')
  })

  test('throws AbortError when query file contains only whitespace', async () => {
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValue('   \n\t  ' as any)

    const flagsWithQueryFile = {...mockFlags, query: undefined, 'query-file': '/path/to/whitespace.graphql'}

    await expect(prepareExecuteContext(flagsWithQueryFile)).rejects.toThrow('is empty')
  })

  test('validates GraphQL query using validateSingleOperation', async () => {
    await prepareExecuteContext(mockFlags)

    expect(validateSingleOperation).toHaveBeenCalledWith(mockFlags.query)
  })
})
