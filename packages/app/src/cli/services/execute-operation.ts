import {
  createAdminSessionAsApp,
  validateSingleOperation,
  resolveApiVersion,
  validateMutationStore,
} from './graphql/common.js'
import {ExecuteOperationResult} from './execute-operation/types.js'
import {OrganizationApp, Organization, OrganizationStore} from '../models/organization.js'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {ClientError} from 'graphql-request'
import {parse} from 'graphql'
import {readFile, fileExists} from '@shopify/cli-kit/node/fs'

interface ExecuteOperationInput {
  organization: Organization
  remoteApp: OrganizationApp
  store: OrganizationStore
  query: string
  variables?: string
  variableFile?: string
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

export async function executeOperation(input: ExecuteOperationInput): Promise<ExecuteOperationResult> {
  const {remoteApp, store, query, variables, variableFile, version: userSpecifiedVersion} = input

  const {adminSession, version} = await renderSingleTask({
    title: outputContent`Authenticating`,
    task: async (): Promise<{adminSession: AdminSession; version: string}> => {
      const adminSession = await createAdminSessionAsApp(remoteApp, store.shopDomain)
      const version = await resolveApiVersion({adminSession, userSpecifiedVersion})
      return {adminSession, version}
    },
    renderOptions: {stdout: process.stderr},
  })

  const parsedVariables = await parseVariables(variables, variableFile)

  validateSingleOperation(query)
  validateMutationStore(query, store)

  try {
    let extensions: Record<string, unknown> | undefined
    const data = await renderSingleTask({
      title: outputContent`Executing GraphQL operation`,
      task: async () => {
        return adminRequestDoc<Record<string, unknown> | null, Record<string, unknown>>({
          query: parse(query),
          session: adminSession,
          variables: parsedVariables,
          version,
          responseOptions: {
            handleErrors: false,
            onResponse: (response) => {
              extensions = response.extensions as Record<string, unknown> | undefined
            },
          },
        })
      },
      renderOptions: {stdout: process.stderr},
    })

    return {status: 'success', result: {data, ...(extensions === undefined ? {} : {extensions})}}
  } catch (error) {
    if (error instanceof ClientError) {
      const {errors, extensions, data} = error.response
      return {
        status: 'failed',
        details: {
          ...(errors === undefined ? {} : {errors}),
          ...(extensions === undefined ? {} : {extensions}),
          ...(data === undefined ? {} : {data}),
        },
      }
    }
    // Network/system errors - let them propagate
    throw error
  }
}
