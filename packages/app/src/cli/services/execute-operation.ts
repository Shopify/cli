import {
  createAdminSessionAsApp,
  validateSingleOperation,
  resolveApiVersion,
  formatOperationInfo,
} from './graphql/common.js'
import {OrganizationApp, Organization} from '../models/organization.js'
import {renderSuccess, renderError, renderInfo, renderSingleTask} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {ClientError} from 'graphql-request'
import {parse} from 'graphql'
import {writeFile} from '@shopify/cli-kit/node/fs'

interface ExecuteOperationInput {
  organization: Organization
  remoteApp: OrganizationApp
  storeFqdn: string
  query: string
  variables?: string
  outputFile?: string
  version?: string
  headers?: string[]
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

function parseHeaders(headers?: string[]): {[header: string]: string} | undefined {
  if (!headers || headers.length === 0) return undefined

  const parsedHeaders: {[header: string]: string} = {}

  for (const header of headers) {
    const separatorIndex = header.indexOf(':')
    if (separatorIndex === -1) {
      throw new AbortError(
        outputContent`Invalid header format: ${outputToken.yellow(header)}`,
        'Headers must be in "Key: Value" format.',
      )
    }

    const key = header.slice(0, separatorIndex).trim()
    const value = header.slice(separatorIndex + 1).trim()

    if (!key) {
      throw new AbortError(
        outputContent`Invalid header format: ${outputToken.yellow(header)}`,
        "Header key can't be empty.",
      )
    }

    parsedHeaders[key] = value
  }

  return parsedHeaders
}

export async function executeOperation(input: ExecuteOperationInput): Promise<void> {
  const {
    organization,
    remoteApp,
    storeFqdn,
    query,
    variables,
    version: userSpecifiedVersion,
    outputFile,
    headers,
  } = input

  const adminSession = await createAdminSessionAsApp(remoteApp, storeFqdn)

  const version = await resolveApiVersion({adminSession, userSpecifiedVersion})

  renderInfo({
    headline: 'Executing GraphQL operation.',
    body: [
      {
        list: {
          items: formatOperationInfo({organization, remoteApp, storeFqdn, version}),
        },
      },
    ],
  })

  const parsedVariables = await parseVariables(variables)
  const parsedHeaders = parseHeaders(headers)

  validateSingleOperation(query)

  try {
    let extensions: unknown

    const result = await renderSingleTask({
      title: outputContent`Executing GraphQL operation`,
      task: async () => {
        return adminRequestDoc({
          query: parse(query),
          session: adminSession,
          variables: parsedVariables,
          version,
          responseOptions: {
            handleErrors: false,
            onResponse: (response) => {
              extensions = response.extensions
            },
          },
          addedHeaders: parsedHeaders,
        })
      },
      renderOptions: {stdout: process.stderr},
    })

    const output = extensions ? {data: result, extensions} : result
    const resultString = JSON.stringify(output, null, 2)

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
