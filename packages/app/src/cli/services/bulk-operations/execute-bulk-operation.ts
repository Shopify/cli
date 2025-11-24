import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {OrganizationApp} from '../../models/organization.js'
import {renderSuccess, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readStdin} from '@shopify/cli-kit/node/system'
import {parse} from 'graphql'
import {readFile, fileExists} from '@shopify/cli-kit/node/fs'

interface ExecuteBulkOperationInput {
  remoteApp: OrganizationApp
  storeFqdn: string
  query?: string
  variables?: string[]
  variableFile?: string
}

/**
 * Resolves the query from the provided flag or stdin.
 * Follows the same pattern as parseVariablesToJsonl for consistency.
 */
async function resolveQuery(query?: string): Promise<string> {
  if (query) {
    return query
  }

  const stdinContent = await readStdin()
  if (stdinContent) {
    return stdinContent
  }

  throw new AbortError(
    'No query provided. Use the --query flag or pipe input via stdin.',
    'Example: echo "query { ... }" | shopify app execute',
  )
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
  const {remoteApp, storeFqdn, variables, variableFile} = input

  const query = await resolveQuery(input.query)

  renderInfo({
    headline: 'Starting bulk operation.',
    body: `App: ${remoteApp.title}\nStore: ${storeFqdn}`,
  })

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const apiSecret = remoteApp.apiSecretKeys.find((elm) => elm.secret)!.secret
  const adminSession = await ensureAuthenticatedAdminAsApp(storeFqdn, remoteApp.apiKey, apiSecret)

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
