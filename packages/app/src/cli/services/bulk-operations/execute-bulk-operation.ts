import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {watchBulkOperation, type BulkOperation} from './watch-bulk-operation.js'
import {formatBulkOperationStatus} from './format-bulk-operation-status.js'
import {downloadBulkOperationResults} from './download-bulk-operation-results.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {renderSuccess, renderInfo, renderError, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {parse} from 'graphql'
import {readFile, writeFile, fileExists} from '@shopify/cli-kit/node/fs'

interface ExecuteBulkOperationInput {
  app: AppLinkedInterface
  storeFqdn: string
  query: string
  variables?: string[]
  variableFile?: string
  watch?: boolean
  outputFile?: string
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
  const {app, storeFqdn, query, variables, variableFile, outputFile, watch = false} = input

  renderInfo({
    headline: 'Starting bulk operation.',
    body: `App: ${app.name}\nStore: ${storeFqdn}`,
  })
  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)

  const variablesJsonl = await parseVariablesToJsonl(variables, variableFile)

  validateGraphQLDocument(query, variablesJsonl)

  const bulkOperationResponse = isMutation(query)
    ? await runBulkOperationMutation({adminSession, query, variablesJsonl})
    : await runBulkOperationQuery({adminSession, query})

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
      const finishedOperation = await watchBulkOperation(adminSession, createdOperation.id)
      await renderBulkOperationResult(finishedOperation, outputFile)
    } else {
      await renderBulkOperationResult(createdOperation, outputFile)
    }
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
      renderSuccess({headline: 'Bulk operation started.', customSections})
      break
    case 'COMPLETED':
      if (operation.url) {
        const results = await downloadBulkOperationResults(operation.url)

        if (outputFile) {
          await writeFile(outputFile, results)
          renderSuccess({headline, body: [`Results written to ${outputFile}`], customSections})
        } else {
          outputResult(results)
          renderSuccess({headline, customSections})
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

function validateGraphQLDocument(graphqlOperation: string, variablesJsonl?: string): void {
  const document = parse(graphqlOperation)
  const operationDefinitions = document.definitions.filter((def) => def.kind === 'OperationDefinition')

  if (operationDefinitions.length !== 1) {
    throw new AbortError(
      'GraphQL document must contain exactly one operation definition. Multiple operations are not supported.',
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

function isMutation(graphqlOperation: string): boolean {
  const document = parse(graphqlOperation)
  const operation = document.definitions.find((def) => def.kind === 'OperationDefinition')
  return operation?.kind === 'OperationDefinition' && operation.operation === 'mutation'
}
