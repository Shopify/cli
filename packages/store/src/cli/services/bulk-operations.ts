import {AdminSession} from '@shopify/cli-kit/node/session'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {sleep} from '@shopify/cli-kit/node/system'
import {fetch} from '@shopify/cli-kit/node/http'

const BULK_QUERY_MUTATION = `
  mutation bulkOperationRunQuery($query: String!) {
    bulkOperationRunQuery(query: $query) {
      bulkOperation {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`

const BULK_OPERATION_STATUS_QUERY = `
  query {
    currentBulkOperation {
      id
      status
      errorCode
      objectCount
      url
    }
  }
`

interface BulkOperationStatus {
  currentBulkOperation: {
    id: string
    status: 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED'
    errorCode?: string
    objectCount: string
    url?: string
  }
}

export async function runBulkQuery(
  query: string,
  session: AdminSession,
): Promise<string> {
  const startResult = await adminRequest<any>(BULK_QUERY_MUTATION, session, {query})

  if (startResult.bulkOperationRunQuery.userErrors.length > 0) {
    const errors = startResult.bulkOperationRunQuery.userErrors.map((e: any) => e.message).join(', ')
    throw new Error(`bulk operation failed: ${errors}`)
  }

  while (true) {
    await sleep(1000)

    const statusResult = await adminRequest<BulkOperationStatus>(BULK_OPERATION_STATUS_QUERY, session)
    const operation = statusResult.currentBulkOperation

    if (operation.status === 'COMPLETED') {
      if (!operation.url) {
        throw new Error('bulk operation completed but no results url')
      }
      const response = await fetch(operation.url)
      return await response.text()
    }

    if (operation.status === 'FAILED') {
      throw new Error(`bulk operation failed: ${operation.errorCode}`)
    }
  }
}
