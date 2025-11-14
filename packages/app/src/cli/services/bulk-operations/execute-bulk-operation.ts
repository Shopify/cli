import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {renderSuccess, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {parse} from 'graphql'

interface ExecuteBulkOperationInput {
  app: AppLinkedInterface
  storeFqdn: string
  query: string
  variables?: string[]
}

export async function executeBulkOperation(input: ExecuteBulkOperationInput): Promise<void> {
  const {app, storeFqdn, query, variables} = input

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

  const result = bulkOperationResponse?.bulkOperation
  if (result) {
    const infoSections = [
      {
        title: 'Bulk Operation Created',
        body: [
          {
            list: {
              items: [
                outputContent`ID: ${outputToken.cyan(result.id)}`.value,
                outputContent`Status: ${outputToken.yellow(result.status)}`.value,
                outputContent`Created: ${outputToken.gray(String(result.createdAt))}`.value,
              ],
            },
          },
        ],
      },
    ]

    renderInfo({customSections: infoSections})

    renderSuccess({
      headline: 'Bulk operation started successfully!',
      body: 'Congrats!',
    })
  }
}

function isMutation(graphqlOperation: string): boolean {
  const document = parse(graphqlOperation)
  const firstOperation = document.definitions.find((def) => def.kind === 'OperationDefinition')

  return firstOperation?.kind === 'OperationDefinition' && firstOperation.operation === 'mutation'
}
