import {validateMutationsAllowed} from './common.js'
import {prepareBulkAdminContext} from './bulk-admin-context.js'
import {executeBulkOperationJsonOutputSchema, type ExecuteBulkOperationResult} from './types.js'
import {
  runBulkOperationQuery,
  runBulkOperationMutation,
  watchBulkOperation,
  shortBulkOperationPoll,
  downloadBulkOperationResults,
  resolveApiVersion,
  isMutation,
  BULK_OPERATIONS_MIN_API_VERSION,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {readFile, fileExists} from '@shopify/cli-kit/node/fs'

interface ExecuteBulkOperationInput {
  store: string
  query: string
  variables?: string[]
  variableFile?: string
  watch?: boolean
  version?: string
  allowMutations?: boolean
}

async function parseVariablesToJsonl(variables?: string[], variableFile?: string): Promise<string | undefined> {
  if (variables) {
    return variables.join('\n')
  } else if (variableFile) {
    if (!(await fileExists(variableFile))) {
      throw new AbortError(
        outputContent`Variable file not found at ${outputToken.path(
          variableFile,
        )}. Please check the path and try again.`,
      )
    }
    return readFile(variableFile, {encoding: 'utf8'})
  } else {
    return undefined
  }
}

export async function prepareBulkOperation(input: ExecuteBulkOperationInput) {
  const {
    store,
    query,
    variables,
    variableFile,
    watch = false,
    version: userSpecifiedVersion,
    allowMutations = false,
  } = input

  validateMutationsAllowed(query, allowMutations)

  const {adminSession, version} = await renderSingleTask({
    title: outputContent`Authenticating`,
    task: async () => {
      const adminSession = await prepareBulkAdminContext(store)
      const version = await resolveApiVersion({
        adminSession,
        userSpecifiedVersion,
        minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
      })
      return {adminSession, version}
    },
    renderOptions: {stdout: process.stderr},
  })

  const variablesJsonl = await parseVariablesToJsonl(variables, variableFile)

  validateBulkOperationVariables(query, variablesJsonl)

  return {adminSession, version, query, variablesJsonl, watch}
}

export async function executeBulkOperation(
  input: Awaited<ReturnType<typeof prepareBulkOperation>>,
): Promise<ExecuteBulkOperationResult> {
  const {adminSession, version, query, variablesJsonl, watch} = input
  const response = isMutation(query)
    ? await runBulkOperationMutation({adminSession, query, variablesJsonl, version})
    : await runBulkOperationQuery({adminSession, query, version})

  if (response?.userErrors?.length || !response?.bulkOperation) {
    return executeBulkOperationJsonOutputSchema.validate({
      store: adminSession.storeFqdn,
      apiVersion: version,
      operation: response?.bulkOperation ?? null,
      userErrors: response?.userErrors ?? [],
      watchAborted: false,
    })
  }

  const abortController = new AbortController()
  const operation = watch
    ? await watchBulkOperation(adminSession, response.bulkOperation.id, abortController.signal, () =>
        abortController.abort(),
      )
    : await shortBulkOperationPoll(adminSession, response.bulkOperation.id)

  // Only --watch downloads completed results; a short poll keeps the existing background behavior.
  const results =
    watch && !abortController.signal.aborted && operation.status === 'COMPLETED' && operation.url
      ? await downloadBulkOperationResults(operation.url)
      : undefined

  return executeBulkOperationJsonOutputSchema.validate({
    store: adminSession.storeFqdn,
    apiVersion: version,
    operation,
    userErrors: [],
    watchAborted: abortController.signal.aborted,
    results,
  })
}

function validateBulkOperationVariables(graphqlOperation: string, variablesJsonl?: string): void {
  if (isMutation(graphqlOperation) && !variablesJsonl) {
    throw new AbortError(
      outputContent`Bulk mutations require variables. Provide a JSONL file with ${outputToken.yellow(
        '--variable-file',
      )} or individual JSON objects with ${outputToken.yellow('--variables')}.`,
    )
  }

  if (!isMutation(graphqlOperation) && variablesJsonl) {
    throw new AbortError(
      outputContent`The ${outputToken.yellow('--variables')} and ${outputToken.yellow(
        '--variable-file',
      )} flags can only be used with mutations, not queries.`,
    )
  }
}
