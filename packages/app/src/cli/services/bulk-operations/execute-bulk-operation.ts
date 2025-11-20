import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {renderSuccess, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {parse} from 'graphql'
import {readFile, fileExists} from '@shopify/cli-kit/node/fs'

interface ExecuteBulkOperationInput {
  app: AppLinkedInterface
  storeFqdn: string
  query: string
  variables?: string[]
  variableFile?: string
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
  const {app, storeFqdn, query, variables, variableFile} = input

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
