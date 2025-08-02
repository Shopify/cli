import {BulkDataOperationByIdResponse} from '../apis/organizations/types.js'
import {outputInfo} from '@shopify/cli-kit/node/output'

export function renderAsyncOperationJson(
  operationType: string,
  operation: BulkDataOperationByIdResponse,
  destination: string,
  source: string,
  selector?: (op: BulkDataOperationByIdResponse) => unknown,
): void {
  const dataToOutput = selector ? selector(operation) : getDefaultFields(operationType, operation, destination, source)
  outputInfo(JSON.stringify(dataToOutput, null, 2))
}

function getDefaultFields(
  operationType: string,
  operation: BulkDataOperationByIdResponse,
  destination: string,
  source: string,
) {
  const bulkOp = operation.organization.bulkData.operation
  const storeOp = bulkOp.storeOperations?.[0]

  return {
    ID: bulkOp.id,
    Type: operationType,
    From: source,
    To: destination,
    Status: bulkOp.status,
    TotalItems: storeOp?.totalObjectCount || 0,
    TotalProcessed: storeOp?.completedObjectCount || 0,
  }
}
