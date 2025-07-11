import {renderOperationResult} from './operation_result.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('renderOperationResult', () => {
  const baseMsg = ['Base message']

  test('renders success when no errors and no url', () => {
    const operation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'COPY',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Source Store',
            },
            targetStore: {
              id: '2',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Store 1',
                },
                remoteOperationType: 'EXPORT',
                remoteOperationStatus: 'COMPLETED',
                totalObjectCount: 100,
                completedObjectCount: 100,
              },
            ],
          },
        },
      },
    }

    renderOperationResult([...baseMsg], operation)

    expect(renderSuccess).toHaveBeenCalledWith({
      body: ['Base message', 'complete. '],
    })
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders success with download link when no errors and url provided', () => {
    const operation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'COPY',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Source Store',
            },
            targetStore: {
              id: '2',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Store 1',
                },
                remoteOperationType: 'EXPORT',
                remoteOperationStatus: 'COMPLETED',
                totalObjectCount: 100,
                completedObjectCount: 100,
                url: 'https://example.com/results',
              },
            ],
          },
        },
      },
    }

    renderOperationResult([...baseMsg], operation)

    expect(renderSuccess).toHaveBeenCalledWith({
      body: [
        'Base message',
        'complete. ',
        {link: {label: 'Results file can be downloaded for more details', url: 'https://example.com/results'}},
      ],
    })
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders warning when errors exist and no url', () => {
    const operation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'COPY',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Source Store',
            },
            targetStore: {
              id: '2',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Store 1',
                },
                remoteOperationType: 'EXPORT',
                remoteOperationStatus: 'FAILED',
                totalObjectCount: 100,
                completedObjectCount: 50,
              },
            ],
          },
        },
      },
    }

    renderOperationResult([...baseMsg], operation)

    expect(renderWarning).toHaveBeenCalledWith({
      body: ['Base message', 'completed with', {error: 'errors. '}],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders warning with download link when errors exist and url provided', () => {
    const operation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'COPY',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Source Store',
            },
            targetStore: {
              id: '2',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Store 1',
                },
                remoteOperationType: 'EXPORT',
                remoteOperationStatus: 'FAILED',
                totalObjectCount: 100,
                completedObjectCount: 50,
                url: 'https://example.com/results',
              },
            ],
          },
        },
      },
    }

    renderOperationResult([...baseMsg], operation)

    expect(renderWarning).toHaveBeenCalledWith({
      body: [
        'Base message',
        'completed with',
        {error: 'errors. '},
        {link: {label: 'Results file can be downloaded for more details', url: 'https://example.com/results'}},
      ],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })
})
