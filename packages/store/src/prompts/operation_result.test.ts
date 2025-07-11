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
      headline: 'Copy completed',
      body: ['Base message'],
      nextSteps: undefined,
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
      headline: 'Copy completed',
      body: ['Base message'],
      nextSteps: [['Download', {link: {label: 'result data', url: 'https://example.com/results'}}]],
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
      headline: 'Copy completed with errors',
      body: ['Base message'],
      nextSteps: undefined,
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
      headline: 'Copy completed with errors',
      body: ['Base message'],
      nextSteps: [['Download', {link: {label: 'result data', url: 'https://example.com/results'}}]],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders success with target store link for STORE_COPY operation', () => {
    const targetShop = {
      id: '2',
      domain: 'target-shop.myshopify.com',
      name: 'Target Shop',
      status: 'ACTIVE',
      webUrl: 'https://target-shop.myshopify.com',
      handle: 'target-shop',
      publicId: 'pub2',
      shortName: 'target',
      organizationId: 'org1',
    }

    const operation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'STORE_COPY',
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

    renderOperationResult([...baseMsg], operation, targetShop)

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Copy completed',
      body: ['Base message'],
      nextSteps: [
        ['View', {link: {label: 'target shop', url: 'https://target-shop.myshopify.com'}}],
        ['Download', {link: {label: 'result data', url: 'https://example.com/results'}}],
      ],
    })
  })

  test('renders success with target store link for STORE_IMPORT operation', () => {
    const targetShop = {
      id: '2',
      domain: 'target-shop.myshopify.com',
      name: 'Target Shop',
      status: 'ACTIVE',
      webUrl: 'https://target-shop.myshopify.com',
      handle: 'target-shop',
      publicId: 'pub2',
      shortName: 'target',
      organizationId: 'org1',
    }

    const operation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'STORE_IMPORT',
            status: 'COMPLETED',
            sourceStore: {
              id: '2',
              name: 'Target Store',
            },
            targetStore: {
              id: '2',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '2',
                  name: 'Target Store',
                },
                remoteOperationType: 'IMPORT',
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

    renderOperationResult([...baseMsg], operation, targetShop)

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Copy completed',
      body: ['Base message'],
      nextSteps: [
        ['View', {link: {label: 'target shop', url: 'https://target-shop.myshopify.com'}}],
        ['Download', {link: {label: 'result data', url: 'https://example.com/results'}}],
      ],
    })
  })

  test('does not render target store link for STORE_EXPORT operation', () => {
    const targetShop = {
      id: '1',
      domain: 'source-shop.myshopify.com',
      name: 'Source Shop',
      status: 'ACTIVE',
      webUrl: 'https://source-shop.myshopify.com',
      handle: 'source-shop',
      publicId: 'pub1',
      shortName: 'source',
      organizationId: 'org1',
    }

    const operation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'STORE_EXPORT',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Source Store',
            },
            targetStore: {
              id: '1',
              name: 'Source Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Source Store',
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

    renderOperationResult([...baseMsg], operation, targetShop)

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Copy completed',
      body: ['Base message'],
      nextSteps: [['Download', {link: {label: 'result data', url: 'https://example.com/results'}}]],
    })
  })
})
