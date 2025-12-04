import {OrganizationApp} from '../models/organization.js'
import {renderSuccess, renderError, renderInfo} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {parse} from 'graphql'
import {writeFile} from '@shopify/cli-kit/node/fs'

interface ExecuteOperationInput {
  remoteApp: OrganizationApp
  storeFqdn: string
  query: string
  variables?: string
  apiVersion?: string
  outputFile?: string
}

async function parseVariables(variables?: string): Promise<{[key: string]: unknown} | undefined> {
  if (!variables) return undefined

  try {
    return JSON.parse(variables)
  } catch (error) {
    throw new AbortError(
      outputContent`Invalid JSON in ${outputToken.yellow('--variables')} flag.`,
      'Please provide valid JSON format.',
    )
  }
}

export async function executeOperation(input: ExecuteOperationInput): Promise<void> {
  const {remoteApp, storeFqdn, query, variables, apiVersion, outputFile} = input

  renderInfo({
    headline: 'Executing GraphQL operation.',
    body: `App: ${remoteApp.title}\nStore: ${storeFqdn}`,
  })

  const appSecret = remoteApp.apiSecretKeys[0]?.secret
  if (!appSecret) throw new BugError('No API secret keys found for app')

  const adminSession = await ensureAuthenticatedAdminAsApp(storeFqdn, remoteApp.apiKey, appSecret)

  const parsedVariables = await parseVariables(variables)

  validateGraphQLDocument(query)

  try {
    const result = await adminRequestDoc({
      query: parse(query),
      session: adminSession,
      variables: parsedVariables,
      version: apiVersion,
      responseOptions: {handleErrors: false},
    })

    const resultString = JSON.stringify(result, null, 2)

    if (outputFile) {
      await writeFile(outputFile, resultString)
      renderSuccess({
        headline: 'Operation completed successfully.',
        body: `Results written to ${outputFile}`,
      })
    } else {
      renderSuccess({
        headline: 'Operation completed successfully.',
      })
      outputResult(resultString)
    }
  } catch (error) {
    if (error instanceof Error) {
      renderError({
        headline: 'Operation failed.',
        body: error.message,
      })
    }
    throw error
  }
}

function validateGraphQLDocument(graphqlOperation: string): void {
  const document = parse(graphqlOperation)
  const operationDefinitions = document.definitions.filter((def) => def.kind === 'OperationDefinition')

  if (operationDefinitions.length !== 1) {
    throw new AbortError(
      'GraphQL document must contain exactly one operation definition. Multiple operations are not supported.',
    )
  }
}
