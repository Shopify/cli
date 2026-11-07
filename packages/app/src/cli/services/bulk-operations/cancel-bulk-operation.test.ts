import {renderCancelBulkOperationResult} from './cancel-result.js'
import {logBulkOperationStart} from './progress.js'
import {cancelBulkOperation as runCancelBulkOperation} from './cancel-bulk-operation.js'
import {createAdminSessionAsApp, formatOperationInfo} from '../graphql/common.js'
import {OrganizationApp, Organization, OrganizationSource} from '../../models/organization.js'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {renderInfo, renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

vi.mock('../graphql/common.js')
vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/ui')

describe('cancelBulkOperation', () => {
  const mockOrganization: Organization = {
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
  const operationId = 'gid://shopify/BulkOperation/123'
  const mockAdminSession = {token: 'test-token', storeFqdn}

  beforeEach(() => {
    vi.mocked(createAdminSessionAsApp).mockResolvedValue(mockAdminSession)
    vi.mocked(formatOperationInfo).mockReturnValue([
      `Organization: ${mockOrganization.businessName}`,
      `App: ${mockRemoteApp.title}`,
      `Store: ${storeFqdn}`,
    ])
  })

  afterEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('returns the operation and user errors without presenting the result', async () => {
    const operation = {id: operationId, status: 'CANCELING', createdAt: '2024-01-01T00:00:00Z', completedAt: null}
    const userErrors = [{field: ['id'], message: 'Cannot cancel'}]
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperationCancel: {bulkOperation: operation, userErrors}})
    const output = mockAndCaptureOutput()

    await expect(runCancelBulkOperation({storeFqdn, operationId, remoteApp: mockRemoteApp})).resolves.toEqual({
      store: storeFqdn,
      apiVersion: '2026-01',
      operation,
      userErrors,
    })
    expect(output.output()).toBe('')
    expect(renderInfo).not.toHaveBeenCalled()
    expect(renderError).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders initial info message with operation details', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({
      bulkOperationCancel: {
        bulkOperation: {
          id: operationId,
          status: 'CANCELING',
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: null,
        },
        userErrors: [],
      },
    })

    await cancelAndPresentBulkOperation({
      organization: mockOrganization,
      storeFqdn,
      operationId,
      remoteApp: mockRemoteApp,
    })

    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Canceling bulk operation.',
      }),
    )
  })

  test('calls adminRequestDoc with correct parameters', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({
      bulkOperationCancel: {
        bulkOperation: {
          id: operationId,
          status: 'CANCELING',
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: null,
        },
        userErrors: [],
      },
    })

    await cancelAndPresentBulkOperation({
      organization: mockOrganization,
      storeFqdn,
      operationId,
      remoteApp: mockRemoteApp,
    })

    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: expect.any(Object),
      session: mockAdminSession,
      variables: {id: operationId},
      version: '2026-01',
    })
  })

  test.each([
    {
      status: 'CANCELING' as const,
      renderer: 'renderSuccess',
      headline: 'Bulk operation is being cancelled.',
    },
    {
      status: 'CANCELED' as const,
      renderer: 'renderWarning',
      headline: 'Bulk operation is already canceled.',
    },
    {
      status: 'COMPLETED' as const,
      renderer: 'renderWarning',
      headline: 'Bulk operation is already completed.',
    },
    {
      status: 'RUNNING' as const,
      renderer: 'renderInfo',
      headline: 'Bulk operation in progress',
    },
  ])('renders $renderer for $status status', async ({status, renderer, headline}) => {
    vi.mocked(adminRequestDoc).mockResolvedValue({
      bulkOperationCancel: {
        bulkOperation: {
          id: operationId,
          status,
          createdAt: '2024-01-01T00:00:00Z',
          completedAt: status === 'CANCELING' || status === 'RUNNING' ? null : '2024-01-01T01:00:00Z',
        },
        userErrors: [],
      },
    })

    await cancelAndPresentBulkOperation({
      organization: mockOrganization,
      storeFqdn,
      operationId,
      remoteApp: mockRemoteApp,
    })

    const rendererFn = {renderSuccess, renderWarning, renderInfo}[renderer]
    expect(rendererFn).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining(headline),
      }),
    )
  })

  test('renders user errors when present', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({
      bulkOperationCancel: {
        bulkOperation: null,
        userErrors: [{field: ['id'], message: 'Operation not found'}],
      },
    })

    await cancelAndPresentBulkOperation({
      organization: mockOrganization,
      storeFqdn,
      operationId,
      remoteApp: mockRemoteApp,
    })

    expect(renderError).toHaveBeenCalledWith({
      headline: 'Failed to cancel bulk operation.',
      body: 'id: Operation not found',
    })
  })

  test('renders error when no operation is returned and no user errors', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({
      bulkOperationCancel: {
        bulkOperation: null,
        userErrors: [],
      },
    })

    await cancelAndPresentBulkOperation({
      organization: mockOrganization,
      storeFqdn,
      operationId,
      remoteApp: mockRemoteApp,
    })

    expect(renderError).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Bulk operation not found or could not be canceled.',
      }),
    )
  })
})

async function cancelAndPresentBulkOperation(
  input: Parameters<typeof runCancelBulkOperation>[0] & {organization: Organization},
) {
  logBulkOperationStart('Canceling bulk operation.', input, 'text')
  const result = await runCancelBulkOperation(input)
  renderCancelBulkOperationResult(result, input.operationId, 'text')
  return result
}
