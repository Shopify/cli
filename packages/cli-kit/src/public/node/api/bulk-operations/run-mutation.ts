import {stageFile} from './stage-file.js'
import {
  BulkOperationRunMutation as BulkOperationRunMutationDoc,
  BulkOperationRunMutationMutation,
  BulkOperationRunMutationMutationVariables,
} from '../../../../cli/api/graphql/bulk-operations/generated/bulk-operation-run-mutation.js'
import {adminRequestDoc} from '../admin.js'
import {AdminSession} from '../../session.js'

interface BulkOperationRunMutationOptions {
  adminSession: AdminSession
  query: string
  variablesJsonl?: string
  version?: string
}

/**
 * Stages a JSONL variables file then starts a bulk mutation operation on the store.
 *
 * @param options - The admin session, mutation, JSONL variables, and optional API version.
 * @returns The bulkOperationRunMutation result, including the created operation and any user errors.
 */
export async function runBulkOperationMutation(
  options: BulkOperationRunMutationOptions,
): Promise<BulkOperationRunMutationMutation['bulkOperationRunMutation']> {
  const {adminSession, query: mutation, variablesJsonl, version} = options

  const stagedUploadPath = await stageFile({
    adminSession,
    variablesJsonl,
  })

  const response = await adminRequestDoc<BulkOperationRunMutationMutation, BulkOperationRunMutationMutationVariables>({
    query: BulkOperationRunMutationDoc,
    session: adminSession,
    variables: {
      mutation,
      stagedUploadPath,
    },
    ...(version && {version}),
  })

  return response.bulkOperationRunMutation
}
