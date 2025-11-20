import {stageFile} from './stage-file.js'
import {
  BulkOperationRunMutation as BulkOperationRunMutationDoc,
  BulkOperationRunMutationMutation,
  BulkOperationRunMutationMutationVariables,
} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-mutation.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'

interface BulkOperationRunMutationOptions {
  adminSession: AdminSession
  query: string
  variables?: string[]
}

export async function runBulkOperationMutation(
  options: BulkOperationRunMutationOptions,
): Promise<BulkOperationRunMutationMutation['bulkOperationRunMutation']> {
  const {adminSession, query: mutation, variables} = options

  const stagedUploadPath = await stageFile({
    adminSession,
    jsonVariables: variables,
  })

  const response = await adminRequestDoc<BulkOperationRunMutationMutation, BulkOperationRunMutationMutationVariables>({
    query: BulkOperationRunMutationDoc,
    session: adminSession,
    variables: {
      mutation,
      stagedUploadPath,
    },
  })

  return response.bulkOperationRunMutation
}
