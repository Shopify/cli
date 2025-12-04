import {createAdminSessionAsApp, validateSingleOperation} from './graphql/common.js'
import {OrganizationApp} from '../models/organization.js'
import {renderSuccess, renderError, renderInfo, renderSingleTask} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {ClientError} from 'graphql-request'
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new AbortError(
      outputContent`Invalid JSON in ${outputToken.yellow('--variables')} flag: ${errorMessage}`,
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

  const adminSession = await createAdminSessionAsApp(remoteApp, storeFqdn)

  const parsedVariables = await parseVariables(variables)

  validateSingleOperation(query)

  try {
    const result = await renderSingleTask({
      title: outputContent`Executing GraphQL operation`,
      task: async () => {
        return adminRequestDoc({
          query: parse(query),
          session: adminSession,
          variables: parsedVariables,
          version: apiVersion,
          responseOptions: {handleErrors: false},
        })
      },
      renderOptions: {stdout: process.stderr},
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
