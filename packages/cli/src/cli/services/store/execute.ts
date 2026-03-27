import {ensureAuthenticatedAdmin, AdminSession} from '@shopify/cli-kit/node/session'
import {fetchApiVersions, adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {renderError, renderSingleTask, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputResult, outputToken} from '@shopify/cli-kit/node/output'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {parse} from 'graphql'

interface ExecuteStoreOperationInput {
  store: string
  query: string
  variables?: string
  variableFile?: string
  outputFile?: string
  version?: string
  allowMutations?: boolean
  mock?: boolean
}

const DEFAULT_MOCK_API_VERSION = '2025-10'

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

function validateSingleOperation(graphqlOperation: string): void {
  let document

  try {
    document = parse(graphqlOperation)
  } catch (error) {
    if (error instanceof Error) {
      throw new AbortError(`Invalid GraphQL syntax: ${error.message}`)
    }

    throw error
  }

  const operationDefinitions = document.definitions.filter((definition) => definition.kind === 'OperationDefinition')

  if (operationDefinitions.length !== 1) {
    throw new AbortError(
      'GraphQL document must contain exactly one operation definition. Multiple operations are not supported.',
    )
  }
}

function isMutation(graphqlOperation: string): boolean {
  const document = parse(graphqlOperation)
  const operationDefinition = document.definitions.find((definition) => definition.kind === 'OperationDefinition')

  return operationDefinition?.operation === 'mutation'
}

function validateMutationsAllowed(graphqlOperation: string, allowMutations = false): void {
  if (isMutation(graphqlOperation) && !allowMutations) {
    throw new AbortError(
      'Mutations are disabled by default for shopify store execute.',
      'Re-run with --allow-mutations if you intend to modify store data.',
    )
  }
}

async function resolveApiVersion(options: {
  adminSession: AdminSession
  userSpecifiedVersion?: string
}): Promise<string> {
  const {adminSession, userSpecifiedVersion} = options

  if (userSpecifiedVersion === 'unstable') return userSpecifiedVersion

  const availableVersions = await fetchApiVersions(adminSession)

  if (!userSpecifiedVersion) {
    const supportedVersions = availableVersions.filter((version) => version.supported).map((version) => version.handle)
    return supportedVersions.sort().reverse()[0]!
  }

  const versionList = availableVersions.map((version) => version.handle)
  if (versionList.includes(userSpecifiedVersion)) return userSpecifiedVersion

  throw new AbortError(`Invalid API version: ${userSpecifiedVersion}`, `Allowed versions: ${versionList.join(', ')}`)
}

function buildMockResponse(input: {
  store: string
  query: string
  variables?: {[key: string]: unknown}
  version?: string
}) {
  return {
    data: {
      mockExecute: {
        store: input.store,
        version: input.version ?? DEFAULT_MOCK_API_VERSION,
        operation: isMutation(input.query) ? 'mutation' : 'query',
        query: input.query,
        variables: input.variables ?? null,
      },
    },
    extensions: {
      mock: true,
    },
  }
}

function isGraphQLClientError(error: unknown): error is {response: {errors: unknown}} {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = (error as {response?: unknown}).response
  return !!response && typeof response === 'object' && 'errors' in response
}

async function writeOrOutputResult(result: unknown, outputFile?: string): Promise<void> {
  const resultString = JSON.stringify(result, null, 2)

  if (outputFile) {
    await writeFile(outputFile, resultString)
    renderSuccess({
      headline: 'Operation succeeded.',
      body: `Results written to ${outputFile}`,
    })
  } else {
    renderSuccess({headline: 'Operation succeeded.'})
    outputResult(resultString)
  }
}

export async function executeStoreOperation(input: ExecuteStoreOperationInput): Promise<void> {
  const {store, query, variables, variableFile, outputFile, version: userSpecifiedVersion, allowMutations, mock} =
    input

  validateSingleOperation(query)
  validateMutationsAllowed(query, allowMutations)

  const parsedVariables = await parseVariables(variables, variableFile)

  if (mock) {
    const result = buildMockResponse({
      store,
      query,
      variables: parsedVariables,
      version: userSpecifiedVersion,
    })

    await writeOrOutputResult(result, outputFile)
    return
  }

  const {adminSession, version} = await renderSingleTask({
    title: outputContent`Authenticating`,
    task: async (): Promise<{adminSession: AdminSession; version: string}> => {
      const adminSession = await ensureAuthenticatedAdmin(store)
      const version = await resolveApiVersion({adminSession, userSpecifiedVersion})
      return {adminSession, version}
    },
    renderOptions: {stdout: process.stderr},
  })

  try {
    const result = await renderSingleTask({
      title: outputContent`Executing GraphQL operation`,
      task: async () => {
        return graphqlRequest({
          query,
          api: 'Admin',
          url: adminUrl(adminSession.storeFqdn, version, adminSession),
          token: adminSession.token,
          variables: parsedVariables,
          responseOptions: {handleErrors: false},
        })
      },
      renderOptions: {stdout: process.stderr},
    })

    await writeOrOutputResult(result, outputFile)
  } catch (error) {
    if (isGraphQLClientError(error)) {
      renderError({
        headline: 'GraphQL operation failed.',
        body: JSON.stringify({errors: error.response.errors}, null, 2),
      })
      return
    }

    throw error
  }
}
