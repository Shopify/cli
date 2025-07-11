import {renderCopyResult} from './copy_result.js'
import {Shop} from '../apis/destinations/index.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {renderWarning, renderSuccess} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('renderCopyResult', () => {
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

  const targetShop: Shop = {
    id: '2',
    domain: 'target-shop.myshopify.com',
    name: 'Target Shop',
    status: 'ACTIVE',
    webUrl: 'https://target-shop.myshopify.com',
    handle: 'target-shop',
    publicId: 'pub2',
    shortName: 'target',
    organizationId: 'org2',
  }

  test('renders success when no errors', () => {
    const copyOperation: BulkDataOperationByIdResponse = {
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

    renderCopyResult(sourceShop, targetShop, copyOperation)

    expect(renderSuccess).toHaveBeenCalledWith({
      body: [
        'Copy operation from',
        {info: 'source-shop.myshopify.com'},
        'to',
        {info: 'target-shop.myshopify.com'},
        'complete',
      ],
    })
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders warning when errors exist', () => {
    const copyOperation: BulkDataOperationByIdResponse = {
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

    renderCopyResult(sourceShop, targetShop, copyOperation)

    expect(renderWarning).toHaveBeenCalledWith({
      body: [
        'Copy operation from',
        {info: 'source-shop.myshopify.com'},
        'to',
        {info: 'target-shop.myshopify.com'},
        'completed with',
        {error: 'errors'},
      ],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders warning when some operations fail', () => {
    const copyOperation: BulkDataOperationByIdResponse = {
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
                url: 'https://example.com/results1',
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
                url: 'https://example.com/results2',
              },
            ],
          },
        },
      },
    }

    renderCopyResult(sourceShop, targetShop, copyOperation)

    expect(renderWarning).toHaveBeenCalledWith({
      body: [
        'Copy operation from',
        {info: 'source-shop.myshopify.com'},
        'to',
        {info: 'target-shop.myshopify.com'},
        'completed with',
        {error: 'errors'},
      ],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })
})
