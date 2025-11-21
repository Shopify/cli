import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {watchBulkOperation, type BulkOperation} from './watch-bulk-operation.js'
import {formatBulkOperationStatus} from './format-bulk-operation-status.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {renderSuccess, renderInfo, renderError, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {parse} from 'graphql'

interface ExecuteBulkOperationInput {
  app: AppLinkedInterface
  storeFqdn: string
  query: string
  variables?: string[]
  watch?: boolean
}

export async function executeBulkOperation(input: ExecuteBulkOperationInput): Promise<void> {
  const {app, storeFqdn, query, variables, watch = false} = input

  renderInfo({
    headline: 'Starting bulk operation.',
    body: `App: ${app.name}\nStore: ${storeFqdn}`,
  })

  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)

  const operationIsMutation = isMutation(query)
  if (!operationIsMutation && variables) {
    throw new AbortError(
      outputContent`The ${outputToken.yellow('--variables')} flag can only be used with mutations, not queries.`,
    )
  }

  const bulkOperationResponse = operationIsMutation
    ? await runBulkOperationMutation({adminSession, query, variables})
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
      renderBulkOperationResult(finishedOperation)
    } else {
      renderBulkOperationResult(createdOperation)
    }
  }
}

function renderBulkOperationResult(operation: BulkOperation): void {
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
        const downloadMessage = outputContent`Download results ${outputToken.link('here.', operation.url)}`.value
        renderSuccess({headline, body: [downloadMessage], customSections})
      } else {
        renderSuccess({headline, customSections})
      }
      break
    default:
      renderError({headline, customSections})
      break
  }
}

function isMutation(graphqlOperation: string): boolean {
  const document = parse(graphqlOperation)
  const firstOperation = document.definitions.find((def) => def.kind === 'OperationDefinition')

  return firstOperation?.kind === 'OperationDefinition' && firstOperation.operation === 'mutation'
}
