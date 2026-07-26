import {stageFile} from './stage-file.js'
import {
  BulkOperationRunMutations as BulkOperationRunMutationsDoc,
  BulkOperationRunMutationsMutation,
  BulkOperationRunMutationsMutationVariables,
} from '../../../../cli/api/graphql/bulk-operations/generated/bulk-operation-run-mutations.js'
import {adminRequestDoc} from '../admin.js'
import {AdminSession} from '../../session.js'

/**
 * One operation within a `bulkOperationRunMutations` plan: a named GraphQL mutation document plus
 * the JSONL variables (one row per invocation) that operation runs over.
 */
export interface BulkMutationPlanOperation {
  mutation: string
  variablesJsonl: string
}

interface BulkOperationRunMutationsOptions {
  adminSession: AdminSession
  operations: BulkMutationPlanOperation[]
  version?: string
}

/**
 * Stages each operation's JSONL variables file, then starts a single bulk mutation *plan* on the
 * store via `bulkOperationRunMutations`. The returned bulk operation is the plan parent; each
 * operation runs as a hidden child through the existing bulk-mutation pipeline.
 *
 * Operations are staged sequentially, preserving the caller's order (order is significant: `$ref`
 * dependencies resolve against earlier operations). Sequential — not parallel — because each upload
 * renders its own progress task, and concurrent interactive renders clobber each other (leaving an
 * upload with no response).
 *
 * @param options - The admin session, the ordered operations (each a named mutation + JSONL
 * variables), and an optional API version.
 * @returns The bulkOperationRunMutations result, including the created plan parent and any user errors.
 */
export async function runBulkOperationMutations(
  options: BulkOperationRunMutationsOptions,
): Promise<BulkOperationRunMutationsMutation['bulkOperationRunMutations']> {
  const {adminSession, operations, version} = options

  const stagedOperations: {mutation: string; stagedUploadPath: string}[] = []
  for (const {mutation, variablesJsonl} of operations) {
    // Sequential on purpose: each upload renders its own progress task and concurrent interactive
    // renders clobber each other, leaving an upload with no response.
    // eslint-disable-next-line no-await-in-loop
    const stagedUploadPath = await stageFile({adminSession, variablesJsonl})
    stagedOperations.push({mutation, stagedUploadPath})
  }

  const response = await adminRequestDoc<BulkOperationRunMutationsMutation, BulkOperationRunMutationsMutationVariables>(
    {
      query: BulkOperationRunMutationsDoc,
      session: adminSession,
      variables: {operations: stagedOperations},
      ...(version && {version}),
    },
  )

  return response.bulkOperationRunMutations
}
