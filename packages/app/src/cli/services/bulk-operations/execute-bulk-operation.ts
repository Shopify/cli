import {
  createAdminSessionAsApp,
  formatOperationInfo,
  resolveApiVersion,
  validateMutationStore,
  isMutation,
} from '../graphql/common.js'
import {OrganizationApp, Organization, OrganizationStore} from '../../models/organization.js'
import {
  runBulkOperationQuery,
  runBulkOperationMutation,
  runBulkOperationMutations,
  validateBulkOperations,
  watchBulkOperation,
  shortBulkOperationPoll,
  formatBulkOperationStatus,
  downloadBulkOperationResults,
  resultsContainUserErrors,
  extractBulkOperationId,
  BULK_OPERATIONS_MIN_API_VERSION,
  type BulkOperation,
  type BulkMutationPlanOperation,
  type OperationToValidate,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {
  renderSuccess,
  renderInfo,
  renderError,
  renderWarning,
  renderSingleTask,
  TokenItem,
} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {readFile, writeFile, fileExists} from '@shopify/cli-kit/node/fs'

interface ExecuteBulkOperationInput {
  organization: Organization
  remoteApp: OrganizationApp
  store: OrganizationStore
  // Single-operation path: a query or a single mutation (+ its variables).
  query?: string
  variables?: string[]
  variableFile?: string
  // Plan path: an ordered set of named mutations run together (bulkOperationRunMutations).
  operations?: BulkMutationPlanOperation[]
  // Validate operations against the store's Admin schema before submitting (defaults to true).
  validate?: boolean
  watch?: boolean
  outputFile?: string
  version?: string
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

export async function executeBulkOperation(input: ExecuteBulkOperationInput): Promise<void> {
  const {
    organization,
    remoteApp,
    store,
    query,
    variables,
    variableFile,
    operations,
    validate = true,
    outputFile,
    watch = false,
    version: userSpecifiedVersion,
  } = input

  const {adminSession, version} = await renderSingleTask({
    title: outputContent`Authenticating`,
    task: async () => {
      const adminSession = await createAdminSessionAsApp(remoteApp, store.shopDomain)
      const version = await resolveApiVersion({
        adminSession,
        userSpecifiedVersion,
        minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
      })
      return {adminSession, version}
    },
    renderOptions: {stdout: process.stderr},
  })

  // Fail fast: validate operation documents against the store's Admin schema before submitting.
  if (validate) {
    const validationOperations = await operationsToValidate({query, variables, variableFile, operations})
    if (validationOperations.length > 0) {
      const passed = await renderValidation({adminSession, version, operations: validationOperations})
      if (!passed) return
    }
  }

  const infoItems = formatOperationInfo({organization, remoteApp, storeFqdn: store.shopDomain, version})

  let bulkOperationResponse

  if (operations) {
    // Plan path. Every operation is a mutation; mutations are only allowed on dev stores.
    operations.forEach((operation) => validateMutationStore(operation.mutation, store))

    renderInfo({
      headline:
        operations.length > 1
          ? `Starting bulk operation plan (${operations.length} operations).`
          : 'Starting bulk operation.',
      body: [{list: {items: infoItems}}],
    })

    // Hybrid routing: a single operation uses the existing bulkOperationRunMutation; 2+ operations
    // run as one plan via bulkOperationRunMutations.
    if (operations.length === 1) {
      const [operation] = operations
      bulkOperationResponse = await runBulkOperationMutation({
        adminSession,
        query: operation!.mutation,
        variablesJsonl: operation!.variablesJsonl,
        version,
      })
    } else {
      bulkOperationResponse = await runBulkOperationMutations({adminSession, operations, version})
    }
  } else {
    // Single-operation path (query or single mutation).
    if (query === undefined) {
      throw new BugError('executeBulkOperation requires either a query or operations.')
    }
    const variablesJsonl = await parseVariablesToJsonl(variables, variableFile)

    validateBulkOperationVariables(query, variablesJsonl)
    validateMutationStore(query, store)

    renderInfo({
      headline: 'Starting bulk operation.',
      body: [{list: {items: infoItems}}],
    })

    bulkOperationResponse = isMutation(query)
      ? await runBulkOperationMutation({adminSession, query, variablesJsonl, version})
      : await runBulkOperationQuery({adminSession, query, version})
  }

  if (bulkOperationResponse?.userErrors?.length) {
    renderError({
      headline: 'Error creating bulk operation.',
      body: {
        list: {
          items: bulkOperationResponse.userErrors.map((error) => formatUserError(error)),
        },
      },
    })
    return
  }

  const createdOperation = bulkOperationResponse?.bulkOperation
  if (createdOperation) {
    if (watch) {
      const abortController = new AbortController()
      const operation = await watchBulkOperation(adminSession, createdOperation.id, abortController.signal, () =>
        abortController.abort(),
      )

      if (abortController.signal.aborted) {
        renderInfo({
          headline: `Bulk operation ${operation.id} is still running in the background.`,
          body: statusCommandHelpMessage(operation.id),
        })
      } else {
        await renderBulkOperationResult(operation, outputFile)
      }
    } else {
      const operation = await shortBulkOperationPoll(adminSession, createdOperation.id)
      const errorStatuses = ['FAILED', 'CANCELED', 'EXPIRED']
      if (errorStatuses.includes(operation.status)) {
        await renderBulkOperationResult(operation, outputFile)
      } else {
        renderSuccess({
          headline: 'Bulk operation is running.',
          body: statusCommandHelpMessage(operation.id),
          customSections: [{body: [{list: {items: [outputContent`ID: ${outputToken.cyan(operation.id)}`.value]}}]}],
        })
      }
    }
  } else {
    renderWarning({
      headline: 'Bulk operation not created successfully.',
      body: 'This is an unexpected error. Please try again later.',
    })
    throw new BugError('Bulk operation response returned null with no error message.')
  }
}

async function renderBulkOperationResult(operation: BulkOperation, outputFile?: string): Promise<void> {
  const headline = formatBulkOperationStatus(operation).value
  const items = [
    outputContent`ID: ${outputToken.cyan(operation.id)}`.value,
    outputContent`Status: ${outputToken.yellow(operation.status)}`.value,
    outputContent`Created at: ${outputToken.gray(String(operation.createdAt))}`.value,
    ...(operation.completedAt
      ? [outputContent`Completed at: ${outputToken.gray(String(operation.completedAt))}`.value]
      : []),
  ]

  const customSections = [{body: [{list: {items}}]}]

  switch (operation.status) {
    case 'CREATED':
      renderSuccess({
        headline: 'Bulk operation started.',
        body: statusCommandHelpMessage(operation.id),
        customSections,
      })
      break
    case 'RUNNING':
      renderSuccess({
        headline: 'Bulk operation is running.',
        body: statusCommandHelpMessage(operation.id),
        customSections,
      })
      break
    case 'COMPLETED':
      if (operation.url) {
        const results = await downloadBulkOperationResults(operation.url)
        const hasUserErrors = resultsContainUserErrors(results)

        if (outputFile) {
          await writeFile(outputFile, results)
        } else {
          outputResult(results)
        }

        if (hasUserErrors) {
          renderWarning({
            headline: 'Bulk operation completed with errors.',
            body: outputFile
              ? `Results written to ${outputFile}. Check file for error details.`
              : 'Check results for error details.',
            customSections,
          })
        } else {
          renderSuccess({
            headline,
            body: outputFile ? [`Results written to ${outputFile}`] : undefined,
            customSections,
          })
        }
      } else {
        renderSuccess({headline, customSections})
      }
      break
    case 'CANCELED':
    case 'CANCELING':
    case 'EXPIRED':
    case 'FAILED':
      renderError({headline, customSections})
      break
  }
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

async function operationsToValidate(input: {
  query?: string
  variables?: string[]
  variableFile?: string
  operations?: BulkMutationPlanOperation[]
}): Promise<OperationToValidate[]> {
  const {query, variables, variableFile, operations} = input
  if (operations) {
    return operations.map((operation, index) => ({
      label: `operation ${index + 1}`,
      operation: operation.mutation,
      representativeRow: firstJsonlRow(operation.variablesJsonl),
    }))
  }
  if (query === undefined) return []
  const variablesJsonl = await parseVariablesToJsonl(variables, variableFile)
  return [{label: 'operation', operation: query, representativeRow: firstJsonlRow(variablesJsonl)}]
}

async function renderValidation(args: Parameters<typeof validateBulkOperations>[0]): Promise<boolean> {
  const results = await validateBulkOperations(args)
  const failures = results.filter((result) => result.errors.length > 0)
  if (failures.length === 0) return true

  renderError({
    headline: 'Bulk operation validation failed.',
    body: {
      list: {
        items: failures.flatMap((failure) => failure.errors.map((error) => `${failure.label}: ${error}`)),
      },
    },
  })
  return false
}

function firstJsonlRow(variablesJsonl?: string): {[key: string]: unknown} | undefined {
  if (!variablesJsonl) return undefined
  const line = variablesJsonl
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0)
  if (!line) return undefined
  try {
    const parsed = JSON.parse(line)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : undefined
  } catch (error) {
    if (error instanceof SyntaxError) return undefined
    throw error
  }
}

function formatUserError(error: {code?: string | null; field?: ReadonlyArray<string> | null; message: string}): string {
  const code = error.code ? `[${error.code}] ` : ''
  const location = error.field && error.field.length > 0 ? `${error.field.join('.')}: ` : ''
  return `${code}${location}${error.message}`
}

function statusCommandHelpMessage(operationId: string): TokenItem {
  return [
    'Monitor its progress with:\n',
    {command: `shopify app bulk status --id=${extractBulkOperationId(operationId)}`},
  ]
}
