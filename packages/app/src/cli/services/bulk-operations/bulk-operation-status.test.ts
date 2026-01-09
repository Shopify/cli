import {
  getBulkOperationStatus,
  listBulkOperations,
  normalizeBulkOperationId,
  extractBulkOperationId,
} from './bulk-operation-status.js'
import {BULK_OPERATIONS_MIN_API_VERSION} from './constants.js'
import {GetBulkOperationByIdQuery} from '../../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {OrganizationApp, Organization, OrganizationSource} from '../../models/organization.js'
import {ListBulkOperationsQuery} from '../../api/graphql/bulk-operations/generated/list-bulk-operations.js'
import {resolveApiVersion} from '../graphql/common.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('../graphql/common.js', async () => {
  const actual = await vi.importActual('../graphql/common.js')
  return {
    ...actual,
    resolveApiVersion: vi.fn(),
  }
})

const storeFqdn = 'test-store.myshopify.com'
const operationId = 'gid://shopify/BulkOperation/123'
const mockOrganization: Organization = {
  id: 'test-org-id',
  businessName: 'Test Organization',
  source: OrganizationSource.BusinessPlatform,
}
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
  vi.mocked(resolveApiVersion).mockResolvedValue(BULK_OPERATIONS_MIN_API_VERSION)
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('normalizeBulkOperationId', () => {
  test('returns GID as-is when already in GID format', () => {
    const gid = 'gid://shopify/BulkOperation/123'
    expect(normalizeBulkOperationId(gid)).toBe(gid)
  })

  test('converts numeric ID to GID format', () => {
    expect(normalizeBulkOperationId('123')).toBe('gid://shopify/BulkOperation/123')
    expect(normalizeBulkOperationId('456789')).toBe('gid://shopify/BulkOperation/456789')
  })

  test('returns non-numeric, non-GID string as-is', () => {
    const invalidId = 'invalid-id'
    expect(normalizeBulkOperationId(invalidId)).toBe(invalidId)
  })
})

describe('extractBulkOperationId', () => {
  test('extracts numeric ID from GID', () => {
    expect(extractBulkOperationId('gid://shopify/BulkOperation/123')).toBe('123')
    expect(extractBulkOperationId('gid://shopify/BulkOperation/456789')).toBe('456789')
  })

  test('returns input as-is if not a valid GID format', () => {
    expect(extractBulkOperationId('gid://shopify/BulkOperation/ABC')).toBe('gid://shopify/BulkOperation/ABC')
    expect(extractBulkOperationId('BulkOperation/123')).toBe('BulkOperation/123')
    expect(extractBulkOperationId('invalid-id')).toBe('invalid-id')
    expect(extractBulkOperationId('123')).toBe('123')
  })
})

describe('getBulkOperationStatus', () => {
  function mockBulkOperation(
    overrides?: Partial<NonNullable<GetBulkOperationByIdQuery['bulkOperation']>>,
  ): GetBulkOperationByIdQuery {
    return {
      bulkOperation: {
        id: operationId,
        type: 'QUERY',
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
    await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

    expect(output.output()).toContain('Bulk operation succeeded:')
    expect(output.output()).toContain('100 objects')
    expect(output.output()).toContain(operationId)
    expect(output.output()).toContain('Finished')
    expect(output.output()).toContain('Download results')
  })

  test('renders info banner for running operation', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'RUNNING', objectCount: 500}))

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

    expect(output.info()).toContain('Checking bulk operation status.')
    expect(output.info()).toContain('Bulk operation in progress')
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
    await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

    expect(output.error()).toContain('Error: ACCESS_DENIED')
    expect(output.error()).toContain('Finished')
    expect(output.error()).toContain('Download partial results')
  })

  test('renders error banner when operation not found', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: null})

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

    expect(output.error()).toContain('Bulk operation not found.')
    expect(output.error()).toContain(operationId)
  })

  test('renders info banner for created operation', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'CREATED', objectCount: 0}))

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

    expect(output.info()).toContain('Starting')
  })

  test('renders info banner for canceled operation', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'CANCELED'}))

    const output = mockAndCaptureOutput()
    await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

    expect(output.info()).toContain('Bulk operation canceled.')
  })

  test('calls resolveApiVersion with minimum API version constant', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'RUNNING'}))

    await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

    expect(resolveApiVersion).toHaveBeenCalledWith({
      adminSession: {token: 'test-token', storeFqdn},
      minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
    })
  })

  test('uses resolved API version in admin request', async () => {
    vi.mocked(resolveApiVersion).mockResolvedValue('test-api-version')
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'RUNNING'}))

    await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

    expect(adminRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'test-api-version',
      }),
    )
  })

  describe('time formatting', () => {
    test('uses "Started" for running operations', async () => {
      vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperation({status: 'RUNNING'}))

      const output = mockAndCaptureOutput()
      await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

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
      await getBulkOperationStatus({organization: mockOrganization, storeFqdn, operationId, remoteApp})

      expect(output.output()).toContain('Finished')
    })
  })
})

describe('listBulkOperations', () => {
  function mockBulkOperationsList(
    operations: Partial<NonNullable<ListBulkOperationsQuery['bulkOperations']['nodes'][0]>>[],
  ): ListBulkOperationsQuery {
    return {
      bulkOperations: {
        nodes: operations.map((op) => ({
          id: 'gid://shopify/BulkOperation/123',
          type: 'QUERY',
          status: 'RUNNING',
          errorCode: null,
          objectCount: 100,
          createdAt: new Date().toISOString(),
          completedAt: null,
          url: null,
          partialDataUrl: null,
          ...op,
        })),
      },
    }
  }

  test('renders table with bulk operations', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(
      mockBulkOperationsList([
        {
          id: 'gid://shopify/BulkOperation/1',
          status: 'COMPLETED',
          objectCount: 123500,
          createdAt: '2025-11-10T12:37:52Z',
          completedAt: '2025-11-10T16:37:12Z',
          url: 'https://example.com/results.jsonl',
        },
        {
          id: 'gid://shopify/BulkOperation/2',
          status: 'RUNNING',
          objectCount: 100,
          createdAt: '2025-11-11T15:37:52Z',
        },
      ]),
    )

    const output = mockAndCaptureOutput()
    await listBulkOperations({organization: mockOrganization, storeFqdn, remoteApp})

    const outputLinesWithoutTrailingWhitespace = output
      .output()
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')

    // terminal width in test environment is quite narrow, so values in the snapshot get wrapped
    expect(outputLinesWithoutTrailingWhitespace).toMatchInlineSnapshot(`
      "╭─ info ───────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Listing bulk operations.                                                    │
      │                                                                              │
      │    • Organization: Test Organization                                         │
      │    • App: Test App                                                           │
      │    • Store: test-store.myshopify.com                                         │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯

      I STATUS  COUNT DATE CREATED   DATE FINISHED  RESULTS

      ─ ─────── ───── ────────────── ────────────── ──────────────────────────────────
        ─             ────           ────           ────────────
      1 COMPLET 123.5 2025-11-10     2025-11-10     download (
        D             12:37:52       16:37:12       https://example.com/results.jsonl
                                                    )
      2 RUNNING 100   2025-11-11
                      15:37:52"
    `)
  })

  test('formats large counts as thousands or millions for readability', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(
      mockBulkOperationsList([{objectCount: 1200000}, {objectCount: 5500}, {objectCount: 42}]),
    )

    const output = mockAndCaptureOutput()
    await listBulkOperations({organization: mockOrganization, storeFqdn, remoteApp})

    expect(output.output()).toContain('1.2M')
    expect(output.output()).toContain('5.5K')
    expect(output.output()).toContain('42')
  })

  test('shows download for failed operations with partial results', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(
      mockBulkOperationsList([
        {
          status: 'FAILED',
          errorCode: 'ACCESS_DENIED',
          partialDataUrl: 'https://example.com/partial.jsonl',
          completedAt: '2025-11-10T16:37:12Z',
        },
      ]),
    )

    const output = mockAndCaptureOutput()
    await listBulkOperations({organization: mockOrganization, storeFqdn, remoteApp})

    expect(output.output()).toContain('download')
    expect(output.output()).toContain('partial.jsonl')
  })

  test('shows download for completed operations with results', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(
      mockBulkOperationsList([
        {
          status: 'COMPLETED',
          url: 'https://example.com/results.jsonl',
        },
      ]),
    )

    const output = mockAndCaptureOutput()
    await listBulkOperations({organization: mockOrganization, storeFqdn, remoteApp})

    expect(output.output()).toContain('download')
    expect(output.output()).toContain('results.jsonl')
  })

  test('shows empty state when no bulk operations found', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperationsList([]))

    const output = mockAndCaptureOutput()
    await listBulkOperations({organization: mockOrganization, storeFqdn, remoteApp})

    expect(output.info()).toContain('Listing bulk operations.')
    expect(output.info()).toContain('No bulk operations found in the last 7 days.')
  })

  test('calls resolveApiVersion with minimum API version constant', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperationsList([]))

    await listBulkOperations({organization: mockOrganization, storeFqdn, remoteApp})

    expect(resolveApiVersion).toHaveBeenCalledWith({
      adminSession: {token: 'test-token', storeFqdn},
      minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
    })
  })

  test('uses resolved API version in admin request', async () => {
    vi.mocked(resolveApiVersion).mockResolvedValue('test-api-version')
    vi.mocked(adminRequestDoc).mockResolvedValue(mockBulkOperationsList([]))

    await listBulkOperations({organization: mockOrganization, storeFqdn, remoteApp})

    expect(adminRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'test-api-version',
      }),
    )
  })
})
