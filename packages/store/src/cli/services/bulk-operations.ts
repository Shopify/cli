import {AdminSession} from '@shopify/cli-kit/node/session'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {sleep} from '@shopify/cli-kit/node/system'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputInfo} from '@shopify/cli-kit/node/output'

/* eslint-disable @shopify/cli/no-inline-graphql */
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
/* eslint-enable @shopify/cli/no-inline-graphql */

interface BulkOperationStartResult {
  bulkOperationRunQuery: {
    bulkOperation: {
      id: string
      status: string
    }
    userErrors: {
      field: string
      message: string
    }[]
  }
}

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
  onProgress?: (status: string, objectCount: string, rate: number, spinner: string) => void,
): Promise<{content: string; totalObjects: number; totalTimeSeconds: number; averageRate: number}> {
  const startResult = await adminRequest<BulkOperationStartResult>(BULK_QUERY_MUTATION, session, {query})

  if (startResult.bulkOperationRunQuery.userErrors.length > 0) {
    const errors = startResult.bulkOperationRunQuery.userErrors.map((err) => err.message).join(', ')
    throw new Error(`bulk operation failed: ${errors}`)
  }

  outputInfo(`bulk operation started: ${startResult.bulkOperationRunQuery.bulkOperation.id}`)

  const operationStartTime = Date.now()
  let lastObjectCount = '0'
  let lastUpdateTime = Date.now()
  let rate = 0
  const spinnerFrames = ['.', '..', '...']
  let spinnerIndex = 0

  /* eslint-disable no-await-in-loop */
  while (true) {
    await sleep(1)

    const statusResult = await adminRequest<BulkOperationStatus>(BULK_OPERATION_STATUS_QUERY, session)
    const operation = statusResult.currentBulkOperation

    if (operation.status === 'CREATED' || operation.status === 'RUNNING') {
      const currentCount = parseInt(operation.objectCount, 10)
      const lastCount = parseInt(lastObjectCount, 10)
      const timeDiff = (Date.now() - lastUpdateTime) / 1000

      if (timeDiff > 0 && currentCount > lastCount) {
        rate = (currentCount - lastCount) / timeDiff
        lastUpdateTime = Date.now()
      }

      lastObjectCount = operation.objectCount

      const spinner = spinnerFrames[spinnerIndex] ?? '...'
      if (onProgress) {
        onProgress(operation.status, operation.objectCount, rate, spinner)
      }
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length
    }

    if (operation.status === 'COMPLETED') {
      if (!operation.url) {
        throw new Error('bulk operation completed but no results url')
      }
      const totalTimeSeconds = (Date.now() - operationStartTime) / 1000
      const totalObjects = parseInt(operation.objectCount, 10)
      const averageRate = totalObjects / totalTimeSeconds

      const response = await fetch(operation.url)
      const content = await response.text()

      return {
        content,
        totalObjects,
        totalTimeSeconds,
        averageRate,
      }
    }

    if (operation.status === 'FAILED') {
      throw new Error(`bulk operation failed: ${operation.errorCode}`)
    }
  }
  /* eslint-enable no-await-in-loop */
}
