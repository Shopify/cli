import {renderCopyResult} from './copy_result.js'
import {renderOperationResult} from './operation_result.js'
import {Shop} from '../apis/destinations/index.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('./operation_result.js')

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

  const mockOperation: BulkDataOperationByIdResponse = {
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
          storeOperations: [],
        },
      },
    },
  }

  test('calls renderOperationResult with correct base message', () => {
    renderCopyResult(sourceShop.domain, targetShop.domain, mockOperation)

    expect(renderOperationResult).toHaveBeenCalledWith(
      [{subdued: 'From:'}, 'source-shop.myshopify.com', {subdued: '\nTo:  '}, 'target-shop.myshopify.com'],
      mockOperation,
      targetShop.domain,
    )
  })
})
