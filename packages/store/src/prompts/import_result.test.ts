import {renderImportResult} from './import_result.js'
import {renderOperationResult} from './operation_result.js'
import {Shop} from '../apis/destinations/index.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('./operation_result.js')

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

  const mockOperation: BulkDataOperationByIdResponse = {
    organization: {
      name: 'Test Organization',
      bulkData: {
        operation: {
          id: 'bulk-op-1',
          operationType: 'STORE_IMPORT',
          status: 'COMPLETED',
          sourceStore: {
            id: '1',
            name: 'Target Store',
          },
          targetStore: {
            id: '1',
            name: 'Target Store',
          },
          storeOperations: [],
        },
      },
    },
  }

  test('calls renderOperationResult with correct base message', () => {
    const filePath = 'input.sqlite'
    renderImportResult(filePath, targetShop.domain, mockOperation)

    expect(renderOperationResult).toHaveBeenCalledWith(
      [{subdued: 'From:'}, 'input.sqlite', {subdued: '\nTo:  '}, 'target-shop.myshopify.com'],
      mockOperation,
      targetShop.domain,
    )
  })
})
