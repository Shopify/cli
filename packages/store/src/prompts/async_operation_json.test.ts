import {renderAsyncOperationJson} from './async_operation_json.js'
import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {describe, expect, vi, test} from 'vitest'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/output')

describe('renderAsyncOperationJson', () => {
  const mockOperation: BulkDataOperationByIdResponse = {
    organization: {
      id: 'org-1',
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
    const operationType = 'Copy'
    const destination = 'shop1'
    const source = 'shop2'

    renderAsyncOperationJson(operationType, mockOperation, destination, source)

    expect(outputInfo).toHaveBeenCalledWith(
      JSON.stringify(
        {
          ID: 'bulk-op-1',
          Type: 'Copy',
          From: 'shop2',
          To: 'shop1',
          Status: 'COMPLETED',
          TotalItems: 0,
          TotalProcessed: 0,
        },
        null,
        2,
      ),
    )
  })
})
