import {executeStoreOperation} from './index.js'
import {prepareStoreExecuteRequest} from './request.js'
import {getStoreGraphQLTarget} from './targets.js'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('./request.js')
vi.mock('./targets.js')
vi.mock('@shopify/cli-kit/node/ui')

describe('executeStoreOperation', () => {
  const request = {
    query: 'query { shop { name } }',
    parsedOperation: {operationDefinition: {operation: 'query'}},
    parsedVariables: {id: 'gid://shopify/Shop/1'},
    requestedVersion: '2025-10',
  } as any
  const context = {kind: 'admin-context'} as any
  const result = {data: {shop: {name: 'Test shop'}}}
  const target = {
    prepareContext: vi.fn(),
    execute: vi.fn(),
  }

  beforeEach(() => {
    vi.mocked(prepareStoreExecuteRequest).mockResolvedValue(request)
    vi.mocked(getStoreGraphQLTarget).mockReturnValue(target as any)
    target.prepareContext.mockResolvedValue(context)
    target.execute.mockResolvedValue(result)
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  })

  afterEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('prepares the request, loads context, and returns the execution result', async () => {
    await expect(
      executeStoreOperation({
        store: 'shop.myshopify.com',
        query: 'query { shop { name } }',
        variables: '{"id":"gid://shopify/Shop/1"}',
        version: '2025-10',
      }),
    ).resolves.toEqual(result)

    expect(getStoreGraphQLTarget).toHaveBeenCalledWith('admin')
    expect(prepareStoreExecuteRequest).toHaveBeenCalledWith({
      query: 'query { shop { name } }',
      queryFile: undefined,
      variables: '{"id":"gid://shopify/Shop/1"}',
      variableFile: undefined,
      version: '2025-10',
      allowMutations: undefined,
    })
    expect(target.prepareContext).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      requestedVersion: '2025-10',
    })
    expect(target.execute).toHaveBeenCalledWith({context, request})
  })

  test('defaults to the admin target', async () => {
    await executeStoreOperation({
      store: 'shop.myshopify.com',
      query: 'query { shop { name } }',
    })

    expect(getStoreGraphQLTarget).toHaveBeenCalledWith('admin')
  })
})
