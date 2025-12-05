import {
  createAdminSessionAsApp,
  validateSingleOperation,
  resolveApiVersion,
  formatOperationInfo,
  validateMutationStore,
} from './graphql/common.js'
import {OrganizationApp, Organization, OrganizationStore} from '../models/organization.js'
import {renderSuccess, renderError, renderInfo, renderSingleTask} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {ClientError} from 'graphql-request'
import {parse} from 'graphql'
import {writeFile, readFile, fileExists} from '@shopify/cli-kit/node/fs'

interface ExecuteOperationInput {
  organization: Organization
  remoteApp: OrganizationApp
  store: OrganizationStore
  query: string
  variables?: string
  variableFile?: string
  outputFile?: string
  version?: string
}

async function parseVariables(
  variables?: string,
  variableFile?: string,
): Promise<{[key: string]: unknown} | undefined> {
  if (variables) {
    try {
      return JSON.parse(variables)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new AbortError(
        outputContent`Invalid JSON in ${outputToken.yellow('--variables')} flag: ${errorMessage}`,
        'Please provide valid JSON format.',
      )
    }
  } else if (variableFile) {
    if (!(await fileExists(variableFile))) {
      throw new AbortError(
        outputContent`Variable file not found at ${outputToken.path(
          variableFile,
        )}. Please check the path and try again.`,
      )
    }
    const fileContent = await readFile(variableFile, {encoding: 'utf8'})
    try {
      return JSON.parse(fileContent)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new AbortError(
        outputContent`Invalid JSON in variable file ${outputToken.path(variableFile)}: ${errorMessage}`,
        'Please provide valid JSON format.',
      )
    }
  }
  return undefined
}

export async function executeOperation(input: ExecuteOperationInput): Promise<void> {
  const {
    organization,
    remoteApp,
    store,
    query,
    variables,
    variableFile,
    version: userSpecifiedVersion,
    outputFile,
  } = input

  const adminSession = await createAdminSessionAsApp(remoteApp, store.shopDomain)

  const version = await resolveApiVersion({adminSession, userSpecifiedVersion})

  renderInfo({
    headline: 'Executing GraphQL operation.',
    body: [
      {
        list: {
          items: formatOperationInfo({organization, remoteApp, storeFqdn: store.shopDomain, version}),
        },
      },
    ],
  })

  const parsedVariables = await parseVariables(variables, variableFile)

  validateSingleOperation(query)
  validateMutationStore(query, store)

  try {
    const result = await renderSingleTask({
      title: outputContent`Executing GraphQL operation`,
      task: async () => {
        return adminRequestDoc({
          query: parse(query),
          session: adminSession,
          variables: parsedVariables,
          version,
          responseOptions: {handleErrors: false},
        })
      },
      renderOptions: {stdout: process.stderr},
    })

    const resultString = JSON.stringify(result, null, 2)

    if (outputFile) {
      await writeFile(outputFile, resultString)
      renderSuccess({
        headline: 'Operation succeeded.',
        body: `Results written to ${outputFile}`,
      })
    } else {
      renderSuccess({
        headline: 'Operation succeeded.',
      })
      outputResult(resultString)
    }
  } catch (error) {
    if (error instanceof ClientError) {
      // GraphQL errors from user's query - render as error
      const errorResult = {
        errors: error.response.errors,
      }
      const errorString = JSON.stringify(errorResult, null, 2)

      renderError({
        headline: 'GraphQL operation failed.',
        body: errorString,
      })
      return
    }
    // Network/system errors - let them propagate
    throw error
  }
}
