import {formatBulkOperationStatus} from './format-bulk-operation-status.js'
import {GetBulkOperationByIdQuery} from '../../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {describe, test, expect} from 'vitest'

type BulkOperation = NonNullable<GetBulkOperationByIdQuery['bulkOperation']>

function createMockOperation(overrides: Partial<BulkOperation> = {}): BulkOperation {
  return {
    id: 'gid://shopify/BulkOperation/123',
    status: 'CREATED',
    errorCode: null,
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: null,
    objectCount: '0',
    url: null,
    ...overrides,
  }
}

describe('formatBulkOperationStatus', () => {
  test('formats RUNNING status with object count', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'RUNNING', objectCount: 42}))
    expect(result.value).toContain('Bulk operation in progress...')
    expect(result.value).toContain('(42 objects)')
  })

  test('formats CREATED status', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'CREATED'}))
    expect(result.value).toBe('Starting...')
  })

  test('formats COMPLETED status', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'COMPLETED', objectCount: 100}))
    expect(result.value).toContain('Bulk operation succeeded.')
    expect(result.value).toContain('(100 objects)')
  })

  test('formats FAILED status with error code', () => {
    const result = formatBulkOperationStatus(
      createMockOperation({status: 'FAILED', objectCount: 10, errorCode: 'ACCESS_DENIED'}),
    )
    expect(result.value).toContain('Bulk operation failed.')
    expect(result.value).toContain('(error: ACCESS_DENIED)')
  })

  test('formats FAILED status without error code', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'FAILED', objectCount: 10, errorCode: null}))
    expect(result.value).toContain('Bulk operation failed.')
    expect(result.value).toContain('(error: unknown)')
  })

  test('formats CANCELING status', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'CANCELING', objectCount: 5}))
    expect(result.value).toBe('Bulk operation canceling...')
  })

  test('formats CANCELED status', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'CANCELED', objectCount: 5}))
    expect(result.value).toBe('Bulk operation canceled.')
  })

  test('formats EXPIRED status', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'EXPIRED'}))
    expect(result.value).toBe('Bulk operation expired.')
  })

  test('formats unknown status', () => {
    const result = formatBulkOperationStatus({
      ...createMockOperation(),
      status: 'UNKNOWN_STATUS',
    } as unknown as BulkOperation)
    expect(result.value).toBe('Bulk operation status: UNKNOWN_STATUS')
  })
})
