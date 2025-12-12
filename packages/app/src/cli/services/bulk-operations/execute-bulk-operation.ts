import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {watchBulkOperation, shortBulkOperationPoll, type BulkOperation} from './watch-bulk-operation.js'
import {formatBulkOperationStatus} from './format-bulk-operation-status.js'
import {downloadBulkOperationResults} from './download-bulk-operation-results.js'
import {extractBulkOperationId} from './bulk-operation-status.js'
import {
  createAdminSessionAsApp,
  validateSingleOperation,
  validateApiVersion,
  formatOperationInfo,
} from '../graphql/common.js'
import {OrganizationApp, Organization} from '../../models/organization.js'
import {renderSuccess, renderInfo, renderError, renderWarning, TokenItem} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {parse} from 'graphql'
import {readFile, writeFile, fileExists} from '@shopify/cli-kit/node/fs'

interface ExecuteBulkOperationInput {
  organization: Organization
  remoteApp: OrganizationApp
  storeFqdn: string
  query: string
  variables?: string[]
  variableFile?: string
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
  const {organization, remoteApp, storeFqdn, query, variables, variableFile, outputFile, watch = false, version} = input

  const adminSession = await createAdminSessionAsApp(remoteApp, storeFqdn)

  if (version) await validateApiVersion(adminSession, version)

  const variablesJsonl = await parseVariablesToJsonl(variables, variableFile)

  validateGraphQLDocument(query, variablesJsonl)

  renderInfo({
    headline: 'Starting bulk operation.',
    body: [
      {
        list: {
          items: formatOperationInfo({organization, remoteApp, storeFqdn, version}),
        },
      },
    ],
  })

  const bulkOperationResponse = isMutation(query)
    ? await runBulkOperationMutation({adminSession, query, variablesJsonl, version})
    : await runBulkOperationQuery({adminSession, query, version})

  if (bulkOperationResponse?.userErrors?.length) {
    const errorMessages = bulkOperationResponse.userErrors
      .map(
        (error: {field?: string[] | null; message: string}) =>
          `${error.field?.join('.') ?? 'unknown'}: ${error.message}`,
      )
      .join('\n')
    renderWarning({
      headline: 'Bulk operation errors.',
      body: errorMessages,
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
      await renderBulkOperationResult(operation, outputFile)
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
    default:
      renderError({headline, customSections})
      break
  }
}

function resultsContainUserErrors(results: string): boolean {
  const lines = results.trim().split('\n')

  return lines.some((line) => {
    const parsed = JSON.parse(line)
    if (!parsed.data) return false
    const result = Object.values(parsed.data)[0] as {userErrors?: unknown[]} | undefined
    return result?.userErrors !== undefined && result.userErrors.length > 0
  })
}

function validateGraphQLDocument(graphqlOperation: string, variablesJsonl?: string): void {
  validateSingleOperation(graphqlOperation)

  if (!isMutation(graphqlOperation) && variablesJsonl) {
    throw new AbortError(
      outputContent`The ${outputToken.yellow('--variables')} and ${outputToken.yellow(
        '--variable-file',
      )} flags can only be used with mutations, not queries.`,
    )
  }
}

function statusCommandHelpMessage(operationId: string): TokenItem {
  return [
    'Monitor its progress with:\n',
    {command: `shopify app bulk status --id=${extractBulkOperationId(operationId)}`},
  ]
}

function isMutation(graphqlOperation: string): boolean {
  const document = parse(graphqlOperation)
  const operation = document.definitions.find((def) => def.kind === 'OperationDefinition')
  return operation?.kind === 'OperationDefinition' && operation.operation === 'mutation'
}
