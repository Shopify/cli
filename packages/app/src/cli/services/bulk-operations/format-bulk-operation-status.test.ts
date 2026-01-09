import {
  formatBulkOperationStatus,
  renderBulkOperationUserErrors,
  formatBulkOperationCancellationResult,
} from './format-bulk-operation-status.js'
import {GetBulkOperationByIdQuery} from '../../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {describe, test, expect, afterEach} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

type BulkOperation = NonNullable<GetBulkOperationByIdQuery['bulkOperation']>

function createMockOperation(overrides: Partial<BulkOperation> = {}): BulkOperation {
  return {
    id: 'gid://shopify/BulkOperation/123',
    status: 'CREATED',
    type: 'QUERY',
    errorCode: null,
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: null,
    objectCount: '0',
    url: null,
    partialDataUrl: null,
    ...overrides,
  }
}

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('formatBulkOperationStatus', () => {
  test('formats RUNNING status for query with object count', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'RUNNING', type: 'QUERY', objectCount: '42'}))
    expect(result.value).toContain('Bulk operation in progress')
    expect(result.value).toContain('(42 objects read)')
  })

  test('formats RUNNING status for mutation with object count', () => {
    const result = formatBulkOperationStatus(
      createMockOperation({status: 'RUNNING', type: 'MUTATION', objectCount: '42'}),
    )
    expect(result.value).toContain('Bulk operation in progress')
    expect(result.value).toContain('(42 objects written)')
  })

  test('formats RUNNING status without object count when count is 0', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'RUNNING', type: 'QUERY', objectCount: '0'}))
    expect(result.value).toBe('Bulk operation in progress')
    expect(result.value).not.toContain('objects read')
  })

  test('formats CREATED status', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'CREATED'}))
    expect(result.value).toBe('Starting')
  })

  test('formats COMPLETED status', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'COMPLETED', objectCount: '100'}))
    expect(result.value).toContain('Bulk operation succeeded:')
    expect(result.value).toContain('100 objects')
  })

  test('formats FAILED status with error code', () => {
    const result = formatBulkOperationStatus(
      createMockOperation({status: 'FAILED', objectCount: '10', errorCode: 'ACCESS_DENIED'}),
    )
    expect(result.value).toContain('Bulk operation failed.')
    expect(result.value).toContain('Error: ACCESS_DENIED')
  })

  test('formats FAILED status without error code', () => {
    const result = formatBulkOperationStatus(
      createMockOperation({status: 'FAILED', objectCount: '10', errorCode: null}),
    )
    expect(result.value).toContain('Bulk operation failed.')
    expect(result.value).toContain('Error: unknown')
  })

  test('formats CANCELING status', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'CANCELING', objectCount: '5'}))
    expect(result.value).toBe('Bulk operation canceling...')
  })

  test('formats CANCELED status', () => {
    const result = formatBulkOperationStatus(createMockOperation({status: 'CANCELED', objectCount: '5'}))
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

describe('renderBulkOperationUserErrors', () => {
  test('renders user errors with field paths', () => {
    const userErrors = [
      {field: ['input', 'id'], message: 'Invalid ID format'},
      {field: ['variables'], message: 'Variables are required'},
    ]

    const output = mockAndCaptureOutput()
    renderBulkOperationUserErrors(userErrors, 'Test errors')

    expect(output.output()).toContain('Test errors')
    expect(output.output()).toContain('input.id: Invalid ID format')
    expect(output.output()).toContain('variables: Variables are required')
  })

  test('renders user errors without field paths as "unknown"', () => {
    const userErrors = [{field: null, message: 'Something went wrong'}]

    const output = mockAndCaptureOutput()
    renderBulkOperationUserErrors(userErrors, 'General errors')

    expect(output.output()).toContain('General errors')
    expect(output.output()).toContain('unknown: Something went wrong')
  })

  test('renders multiple user errors', () => {
    const userErrors = [
      {field: ['field1'], message: 'Error 1'},
      {field: ['field2'], message: 'Error 2'},
      {field: null, message: 'Error 3'},
    ]

    const output = mockAndCaptureOutput()
    renderBulkOperationUserErrors(userErrors, 'Multiple errors')

    expect(output.output()).toContain('field1: Error 1')
    expect(output.output()).toContain('field2: Error 2')
    expect(output.output()).toContain('unknown: Error 3')
  })
})

describe('formatBulkOperationCancellationResult', () => {
  test('formats CANCELING status with success render type and status command', () => {
    const operation = createMockOperation({
      id: 'gid://shopify/BulkOperation/6578182226092',
      status: 'CANCELING',
    })
    const result = formatBulkOperationCancellationResult(operation)

    expect(result.headline).toBe('Bulk operation is being cancelled.')
    expect(result.body).toEqual([
      'This may take a few moments. Check the status with:\n',
      {command: 'shopify app bulk status --id=6578182226092'},
    ])
    expect(result.customSections).toBeUndefined()
    expect(result.renderType).toBe('success')
  })

  test.each([
    {
      status: 'CANCELED' as const,
      headline: 'Bulk operation is already canceled.',
      body: "This operation has already finished and can't be canceled.",
      renderType: 'warning',
      hasCustomSections: true,
    },
    {
      status: 'COMPLETED' as const,
      headline: 'Bulk operation is already completed.',
      body: "This operation has already finished and can't be canceled.",
      renderType: 'warning',
      hasCustomSections: true,
    },
    {
      status: 'FAILED' as const,
      headline: 'Bulk operation is already failed.',
      body: "This operation has already finished and can't be canceled.",
      renderType: 'warning',
      hasCustomSections: true,
    },
    {
      status: 'RUNNING' as const,
      headline: 'Bulk operation in progress',
      body: undefined,
      renderType: 'info',
      hasCustomSections: false,
    },
  ])(
    'formats $status status with $renderType render type',
    ({status, headline, body, renderType, hasCustomSections}) => {
      const operation = createMockOperation({status})
      const result = formatBulkOperationCancellationResult(operation)

      expect(result.headline).toContain(headline)
      expect(result.body).toBe(body)
      expect(result.renderType).toBe(renderType)
      if (hasCustomSections) {
        expect(result.customSections).toBeDefined()
      } else {
        expect(result.customSections).toBeUndefined()
      }
    },
  )

  test('includes operation details in custom sections for finished operations', () => {
    const operation = createMockOperation({
      id: 'gid://shopify/BulkOperation/999',
      status: 'CANCELED',
      createdAt: '2024-01-01T00:00:00Z',
    })
    const result = formatBulkOperationCancellationResult(operation)

    const items = result.customSections?.[0]?.body[0]?.list.items ?? []
    expect(items.some((item) => item.includes('gid://shopify/BulkOperation/999'))).toBe(true)
    expect(items.some((item) => item.includes('CANCELED'))).toBe(true)
    expect(items.some((item) => item.includes('Created at'))).toBe(true)
  })

  test('includes completedAt when operation is finished', () => {
    const operation = createMockOperation({
      status: 'CANCELED',
      completedAt: '2024-01-01T01:00:00Z',
    })
    const result = formatBulkOperationCancellationResult(operation)

    const items = result.customSections?.[0]?.body[0]?.list.items ?? []
    expect(items.some((item) => item.includes('Completed at'))).toBe(true)
  })

  test('does not include completedAt when operation has no completedAt', () => {
    const operation = createMockOperation({status: 'CANCELED', completedAt: null})
    const result = formatBulkOperationCancellationResult(operation)

    const items = result.customSections?.[0]?.body[0]?.list.items ?? []
    expect(items.some((item) => item.includes('Completed at'))).toBe(false)
  })
})
