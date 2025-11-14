import {
  BulkOperationRunQuery,
  BulkOperationRunQueryMutation,
} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-query.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface BulkOperationRunQueryOptions {
  adminSession: AdminSession
  query: string
}

export async function runBulkOperationQuery(
  options: BulkOperationRunQueryOptions,
): Promise<BulkOperationRunQueryMutation['bulkOperationRunQuery']> {
  const {adminSession, query, variables} = options

  if (variables) {
    throw new AbortError(
      outputContent`The ${outputToken.yellow('--variables')} flag can only be used with mutations, not queries.`,
    )
  }

  const response = await adminRequestDoc<BulkOperationRunQueryMutation, {query: string}>({
    query: BulkOperationRunQuery,
    session: adminSession,
  })

  return response.bulkOperationRunQuery
}
