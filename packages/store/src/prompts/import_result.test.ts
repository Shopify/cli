import {renderImportResult} from './import_result.js'
import {Shop} from '../apis/destinations/index.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('renderImportResult', () => {
  const targetShop: Shop = {
    id: '1',
    domain: 'target-shop.myshopify.com',
    name: 'Target Shop',
    status: 'ACTIVE',
    webUrl: 'https://target-shop.myshopify.com',
    handle: 'target-shop',
    publicId: 'pub1',
    shortName: 'target',
    organizationId: 'org1',
  }

  test('renders success when no errors and no url', () => {
    const importOperation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'IMPORT',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Target Store',
            },
            targetStore: {
              id: '1',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Store 1',
                },
                remoteOperationType: 'IMPORT',
                remoteOperationStatus: 'COMPLETED',
                totalObjectCount: 100,
                completedObjectCount: 100,
                url: '',
              },
            ],
          },
        },
      },
    }

    renderImportResult(targetShop, importOperation)

    expect(renderSuccess).toHaveBeenCalledWith({
      body: ['Import operation to', {info: 'target-shop.myshopify.com'}, 'complete'],
    })
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders success with url when no errors', () => {
    const importOperation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'IMPORT',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Target Store',
            },
            targetStore: {
              id: '1',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Store 1',
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

    renderImportResult(targetShop, importOperation)

    expect(renderSuccess).toHaveBeenCalledWith({
      body: [
        'Import operation to',
        {info: 'target-shop.myshopify.com'},
        'complete',
        {link: {label: 'results file can be downloaded for more details', url: 'https://example.com/results'}},
      ],
    })
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders warning when errors exist without url', () => {
    const importOperation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'IMPORT',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Target Store',
            },
            targetStore: {
              id: '1',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Store 1',
                },
                remoteOperationType: 'IMPORT',
                remoteOperationStatus: 'FAILED',
                totalObjectCount: 100,
                completedObjectCount: 50,
                url: '',
              },
            ],
          },
        },
      },
    }

    renderImportResult(targetShop, importOperation)

    expect(renderWarning).toHaveBeenCalledWith({
      body: ['Import operation to', {info: 'target-shop.myshopify.com'}, 'completed with', {error: 'errors'}],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders warning with url when errors exist', () => {
    const importOperation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'IMPORT',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Target Store',
            },
            targetStore: {
              id: '1',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Store 1',
                },
                remoteOperationType: 'IMPORT',
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

    renderImportResult(targetShop, importOperation)

    expect(renderWarning).toHaveBeenCalledWith({
      body: [
        'Import operation to',
        {info: 'target-shop.myshopify.com'},
        'completed with',
        {error: 'errors'},
        {link: {label: 'results file can be downloaded for more details', url: 'https://example.com/results'}},
      ],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders warning when some operations fail', () => {
    const importOperation: BulkDataOperationByIdResponse = {
      organization: {
        name: 'Test Organization',
        bulkData: {
          operation: {
            id: 'bulk-op-1',
            operationType: 'IMPORT',
            status: 'COMPLETED',
            sourceStore: {
              id: '1',
              name: 'Target Store',
            },
            targetStore: {
              id: '1',
              name: 'Target Store',
            },
            storeOperations: [
              {
                id: 'op1',
                store: {
                  id: '1',
                  name: 'Store 1',
                },
                remoteOperationType: 'IMPORT',
                remoteOperationStatus: 'COMPLETED',
                totalObjectCount: 100,
                completedObjectCount: 100,
                url: 'https://example.com/results',
              },
              {
                id: 'op2',
                store: {
                  id: '2',
                  name: 'Store 2',
                },
                remoteOperationType: 'IMPORT',
                remoteOperationStatus: 'FAILED',
                totalObjectCount: 100,
                completedObjectCount: 50,
                url: '',
              },
            ],
          },
        },
      },
    }

    renderImportResult(targetShop, importOperation)

    expect(renderWarning).toHaveBeenCalledWith({
      body: [
        'Import operation to',
        {info: 'target-shop.myshopify.com'},
        'completed with',
        {error: 'errors'},
        {link: {label: 'results file can be downloaded for more details', url: 'https://example.com/results'}},
      ],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })
})
