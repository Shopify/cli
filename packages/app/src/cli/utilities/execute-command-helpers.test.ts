import {prepareAppStoreContext, prepareExecuteContext} from './execute-command-helpers.js'
import {linkedAppContext} from '../services/app-context.js'
import {storeContext} from '../services/store-context.js'
import {validateSingleOperation} from '../services/graphql/common.js'
import {readFile, fileExists} from '@shopify/cli-kit/node/fs'
import {readStdinString} from '@shopify/cli-kit/node/system'
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
    vi.mocked(readStdinString).mockResolvedValue('')
  })

  test('uses query from flags when provided', async () => {
    const result = await prepareExecuteContext(mockFlags)

    expect(result.query).toBe(mockFlags.query)
    expect(readStdinString).not.toHaveBeenCalled()
  })

  test('reads query from stdin when flag not provided', async () => {
    const stdinQuery = 'query { products { edges { node { id } } } }'
    vi.mocked(readStdinString).mockResolvedValue(stdinQuery)

    const flagsWithoutQuery = {...mockFlags, query: undefined}
    const result = await prepareExecuteContext(flagsWithoutQuery)

    expect(readStdinString).toHaveBeenCalled()
    expect(result.query).toBe(stdinQuery)
  })

  test('throws AbortError when no query provided via flag or stdin', async () => {
    vi.mocked(readStdinString).mockResolvedValue('')

    const flagsWithoutQuery = {...mockFlags, query: undefined}

    await expect(prepareExecuteContext(flagsWithoutQuery)).rejects.toThrow('No query provided')
  })

  test('includes command name in error message', async () => {
    vi.mocked(readStdinString).mockResolvedValue('')

    const flagsWithoutQuery = {...mockFlags, query: undefined}

    try {
      await prepareExecuteContext(flagsWithoutQuery, 'bulk execute')
      expect.fail('Should have thrown an error')
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error: any) {
      expect(error.message).toContain('No query provided')
      expect(error.tryMessage).toMatch(/shopify app bulk execute/)
    }
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
    expect(readStdinString).not.toHaveBeenCalled()
  })

  test('throws AbortError when query file does not exist', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)

    const flagsWithQueryFile = {...mockFlags, query: undefined, 'query-file': '/path/to/nonexistent.graphql'}

    await expect(prepareExecuteContext(flagsWithQueryFile)).rejects.toThrow('Query file not found')
    expect(readFile).not.toHaveBeenCalled()
  })

  test('falls back to stdin when neither query nor query-file provided', async () => {
    const stdinQuery = 'query { shop { name } }'
    vi.mocked(readStdinString).mockResolvedValue(stdinQuery)

    const flagsWithoutQueryOrFile = {...mockFlags, query: undefined}
    const result = await prepareExecuteContext(flagsWithoutQueryOrFile)

    expect(readStdinString).toHaveBeenCalled()
    expect(result.query).toBe(stdinQuery)
  })

  test('validates GraphQL query using validateSingleOperation', async () => {
    await prepareExecuteContext(mockFlags)

    expect(validateSingleOperation).toHaveBeenCalledWith(mockFlags.query)
  })
})
