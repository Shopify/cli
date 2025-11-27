import {getBulkOperationStatus} from './bulk-operation-status.js'
import {GetBulkOperationByIdQuery} from '../../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {OrganizationApp} from '../../models/organization.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/api/admin')

const storeFqdn = 'test-store.myshopify.com'
const operationId = 'gid://shopify/BulkOperation/123'
const remoteApp = {
  id: '123',
  title: 'Test App',
  apiKey: 'test-key',
  organizationId: 'org-123',
  apiSecretKeys: [{secret: 'test-secret'}],
  grantedScopes: [],
  flags: [],
  developerPlatformClient: {} as any,
} as OrganizationApp

beforeEach(() => {
  vi.mocked(ensureAuthenticatedAdminAsApp).mockResolvedValue({token: 'test-token', storeFqdn})
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('getBulkOperationStatus', () => {
  function mockBulkOperation(
    overrides?: Partial<NonNullable<GetBulkOperationByIdQuery['bulkOperation']>>,
  ): GetBulkOperationByIdQuery {
    return {
      bulkOperation: {
        id: operationId,
        status: 'RUNNING',
        errorCode: null,
        objectCount: 100,
        createdAt: new Date(Date.now() - 120000).toISOString(),
        completedAt: null,
        url: null,
        partialDataUrl: null,
        ...overrides,
      },
    }
  }

  test('renders success banner for completed operation', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(
      mockBulkOperation({
        status: 'COMPLETED',
        completedAt: new Date(Date.now() - 60000).toISOString(),
        url: 'https://example.com/results.jsonl',
      }),
    )

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({storeFqdn, operationId, remoteApp})

    expect(output.output()).toContain('Bulk operation succeeded:')
    expect(output.output()).toContain('100 objects')
    expect(output.output()).toContain(operationId)
    expect(output.output()).toContain('Finished')
    expect(output.output()).toContain('Download results')
  })

  test('renders info banner for running operation', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'RUNNING', objectCount: 500}))

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({storeFqdn, operationId, remoteApp})

    expect(output.info()).toContain('Bulk operation in progress...')
    expect(output.info()).toContain('500 objects')
    expect(output.info()).toContain('Started')
  })

  test('renders error banner for failed operation', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(
      mockBulkOperation({
        status: 'FAILED',
        errorCode: 'ACCESS_DENIED',
        completedAt: new Date(Date.now() - 60000).toISOString(),
        partialDataUrl: 'https://example.com/partial.jsonl',
      }),
    )

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({storeFqdn, operationId, remoteApp})

    expect(output.error()).toContain('Error: ACCESS_DENIED')
    expect(output.error()).toContain('Finished')
    expect(output.error()).toContain('Download partial results')
  })

  test('renders error banner when operation not found', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: null})

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({storeFqdn, operationId, remoteApp})

    expect(output.error()).toContain('Bulk operation not found.')
    expect(output.error()).toContain(operationId)
  })

  test('renders info banner for created operation', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'CREATED', objectCount: 0}))

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({storeFqdn, operationId, remoteApp})

    expect(output.info()).toContain('Starting...')
  })

  test('renders info banner for canceled operation', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'CANCELED'}))

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({storeFqdn, operationId, remoteApp})

    expect(output.info()).toContain('Bulk operation canceled.')
  })

  describe('time formatting', () => {
    test('uses "Started" for running operations', async () => {
      vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'RUNNING'}))

      const output = mockAndCaptureOutput()
      await getBulkOperationStatus({storeFqdn, operationId, remoteApp})

      expect(output.output()).toContain('Started')
    })

    test('uses "Finished" for completed operations', async () => {
      vi.mocked(adminRequestDoc).mockResolvedValue(
        mockBulkOperation({
          status: 'COMPLETED',
          completedAt: new Date(Date.now() - 60000).toISOString(),
        }),
      )

      const output = mockAndCaptureOutput()
      await getBulkOperationStatus({storeFqdn, operationId, remoteApp})

      expect(output.output()).toContain('Finished')
    })
  })
})
