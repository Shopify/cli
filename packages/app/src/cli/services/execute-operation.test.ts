import {executeOperation} from './execute-operation.js'
import {createAdminSessionAsApp, validateApiVersion} from './graphql/common.js'
import {OrganizationApp, OrganizationSource} from '../models/organization.js'
import {renderSuccess, renderError, renderSingleTask} from '@shopify/cli-kit/node/ui'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {ClientError} from 'graphql-request'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('./graphql/common.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/fs')

describe('executeOperation', () => {
  const mockOrganization = {
    id: 'test-org-id',
    businessName: 'Test Organization',
    source: OrganizationSource.BusinessPlatform,
  }

  const mockRemoteApp = {
    apiKey: 'test-app-client-id',
    apiSecretKeys: [{secret: 'test-api-secret'}],
    title: 'Test App',
  } as OrganizationApp

  const storeFqdn = 'test-store.myshopify.com'
  const mockAdminSession = {token: 'test-token', storeFqdn}

  beforeEach(() => {
    vi.mocked(createAdminSessionAsApp).mockResolvedValue(mockAdminSession)
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => {
      return task(() => {})
    })
  })

  afterEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('executes GraphQL operation successfully', async () => {
    const query = 'query { shop { name } }'
    const mockResult = {data: {shop: {name: 'Test Shop'}}}
    vi.mocked(adminRequestDoc).mockResolvedValue(mockResult)

    await executeOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      storeFqdn,
      query,
    })

    expect(createAdminSessionAsApp).toHaveBeenCalledWith(mockRemoteApp, storeFqdn)
    expect(adminRequestDoc).toHaveBeenCalledWith({
      // parsed GraphQL document
      query: expect.any(Object),
      session: mockAdminSession,
      variables: undefined,
      version: undefined,
      responseOptions: {handleErrors: false},
    })
  })

  test('passes variables correctly when provided', async () => {
    const query = 'mutation UpdateProduct($input: ProductInput!) { productUpdate(input: $input) { product { id } } }'
    const variables = '{"input":{"id":"gid://shopify/Product/123","title":"Updated"}}'
    const mockResult = {data: {productUpdate: {product: {id: 'gid://shopify/Product/123'}}}}
    vi.mocked(adminRequestDoc).mockResolvedValue(mockResult)

    await executeOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      storeFqdn,
      query,
      variables,
    })

    expect(adminRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: JSON.parse(variables),
      }),
    )
  })

  test('throws AbortError when variables contain invalid JSON', async () => {
    const query = 'query { shop { name } }'
    const invalidVariables = '{invalid json}'

    await expect(
      executeOperation({
        organization: mockOrganization,
        remoteApp: mockRemoteApp,
        storeFqdn,
        query,
        variables: invalidVariables,
      }),
    ).rejects.toThrow('Invalid JSON')

    expect(adminRequestDoc).not.toHaveBeenCalled()
  })

  test('uses specified API version when provided', async () => {
    const query = 'query { shop { name } }'
    const version = '2024-01'
    const mockResult = {data: {shop: {name: 'Test Shop'}}}
    vi.mocked(adminRequestDoc).mockResolvedValue(mockResult)
    vi.mocked(validateApiVersion).mockResolvedValue()

    await executeOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      storeFqdn,
      query,
      version,
    })

    expect(validateApiVersion).toHaveBeenCalledWith(mockAdminSession, version)
    expect(adminRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        version,
      }),
    )
  })

  test('does not validate version when not provided', async () => {
    const query = 'query { shop { name } }'
    const mockResult = {data: {shop: {name: 'Test Shop'}}}
    vi.mocked(adminRequestDoc).mockResolvedValue(mockResult)
    vi.mocked(validateApiVersion).mockClear()

    await executeOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      storeFqdn,
      query,
    })

    expect(validateApiVersion).not.toHaveBeenCalled()
  })

  test('writes formatted JSON results to stdout by default', async () => {
    const query = 'query { shop { name } }'
    const mockResult = {data: {shop: {name: 'Test Shop'}}}
    vi.mocked(adminRequestDoc).mockResolvedValue(mockResult)

    const mockOutput = mockAndCaptureOutput()

    await executeOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      storeFqdn,
      query,
    })

    const expectedOutput = JSON.stringify(mockResult, null, 2)
    expect(mockOutput.info()).toContain(expectedOutput)
    expect(writeFile).not.toHaveBeenCalled()
  })

  test('writes results to file when outputFile is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const outputFile = joinPath(tmpDir, 'results.json')
      const query = 'query { shop { name } }'
      const mockResult = {data: {shop: {name: 'Test Shop'}}}
      vi.mocked(adminRequestDoc).mockResolvedValue(mockResult)

      await executeOperation({
        organization: mockOrganization,
        remoteApp: mockRemoteApp,
        storeFqdn,
        query,
        outputFile,
      })

      const expectedContent = JSON.stringify(mockResult, null, 2)
      expect(writeFile).toHaveBeenCalledWith(outputFile, expectedContent)
      expect(renderSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(outputFile),
        }),
      )
    })
  })

  test('renders success message after successful execution', async () => {
    const query = 'query { shop { name } }'
    const mockResult = {data: {shop: {name: 'Test Shop'}}}
    vi.mocked(adminRequestDoc).mockResolvedValue(mockResult)

    await executeOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      storeFqdn,
      query,
    })

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Operation succeeded.',
      }),
    )
  })

  test('throws when API request fails', async () => {
    const query = 'query { shop { name } }'
    const apiError = new Error('API request failed')
    vi.mocked(adminRequestDoc).mockRejectedValue(apiError)

    await expect(
      executeOperation({
        organization: mockOrganization,
        remoteApp: mockRemoteApp,
        storeFqdn,
        query,
      }),
    ).rejects.toThrow('API request failed')
  })

  test('handles GraphQL errors in response', async () => {
    const query = 'query { shop { name } }'
    const mockResult = {
      data: null,
      errors: [{message: 'Field "name" not found'}],
    }
    vi.mocked(adminRequestDoc).mockResolvedValue(mockResult)

    await executeOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      storeFqdn,
      query,
    })

    // Should still format and output the result with errors
    const mockOutput = mockAndCaptureOutput()
    const expectedOutput = JSON.stringify(mockResult, null, 2)
    expect(mockOutput.info()).toContain(expectedOutput)
  })

  test('handles ClientError from GraphQL validation failures', async () => {
    const query = 'query { invalidField }'
    const graphqlErrors = [
      {message: 'Field "invalidField" doesn\'t exist on type "QueryRoot"', locations: [{line: 1, column: 9}]},
    ]
    const clientError = new ClientError({errors: graphqlErrors} as any, {query: '', variables: {}})
    // Set response property that our code accesses
    ;(clientError as any).response = {errors: graphqlErrors}

    vi.mocked(adminRequestDoc).mockRejectedValue(clientError)

    await executeOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      storeFqdn,
      query,
    })

    expect(renderError).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'GraphQL operation failed.',
        body: expect.stringContaining('invalidField'),
      }),
    )
  })
})
