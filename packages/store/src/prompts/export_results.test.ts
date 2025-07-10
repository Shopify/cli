import {renderExportResult} from './export_results.js'
import {Shop} from '../apis/destinations/index.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('renderExportResult', () => {
  const sourceShop: Shop = {
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

  test('renders success when no errors', () => {
    const exportOperation: BulkDataOperationByIdResponse = {
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

    renderExportResult(sourceShop, exportOperation)

    expect(renderSuccess).toHaveBeenCalledWith({
      body: [
        'Export operation from',
        {info: 'source-shop.myshopify.com'},
        'complete',
        {link: {label: 'export file available for download', url: 'https://example.com/results'}},
      ],
    })
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders warning when errors exist', () => {
    const exportOperation: BulkDataOperationByIdResponse = {
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

    renderExportResult(sourceShop, exportOperation)

    expect(renderWarning).toHaveBeenCalledWith({
      body: ['Export operation from', {info: 'source-shop.myshopify.com'}, 'completed with', {error: 'errors'}],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders warning when some operations fail', () => {
    const exportOperation: BulkDataOperationByIdResponse = {
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
                  name: 'Store 1',
                },
                remoteOperationType: 'EXPORT',
                remoteOperationStatus: 'COMPLETED',
                totalObjectCount: 100,
                completedObjectCount: 100,
                url: 'https://example.com/results1',
              },
              {
                id: 'op2',
                store: {
                  id: '2',
                  name: 'Store 2',
                },
                remoteOperationType: 'EXPORT',
                remoteOperationStatus: 'FAILED',
                totalObjectCount: 100,
                completedObjectCount: 50,
                url: 'https://example.com/results2',
              },
            ],
          },
        },
      },
    }

    renderExportResult(sourceShop, exportOperation)

    expect(renderWarning).toHaveBeenCalledWith({
      body: ['Export operation from', {info: 'source-shop.myshopify.com'}, 'completed with', {error: 'errors'}],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })
})
